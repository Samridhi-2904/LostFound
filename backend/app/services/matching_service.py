from datetime import datetime, timezone
import json
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import LifecycleStatus, MatchStatus, NotificationType, ReportType
from app.models.history import AuditLog
from app.models.match import MatchSuggestion
from app.models.notification import Notification
from app.models.report import ItemReport

STOP_WORDS = {
    "a", "an", "the", "in", "on", "at", "of", "with", "is", "and", "or", "to", "for",
    "by", "my", "it", "this", "that", "was", "near", "from", "left", "some", "found", "lost"
}


def tokenize(text: Optional[str]) -> Set[str]:
    """Extract lowercase alpha tokens excluding stop words."""
    if not text:
        return set()
    words = re.findall(r"\b[a-zA-Z0-9]{2,}\b", text.lower())
    return {w for w in words if w not in STOP_WORDS}


class MatchingService:
    """Deterministic, explainable matching engine between lost and found item reports."""

    MATCH_THRESHOLD = 0.40  # Minimum 40% confidence score to record suggestion

    @staticmethod
    def calculate_score(
        lost_report: ItemReport,
        found_report: ItemReport,
    ) -> Tuple[float, Dict[str, Any]]:
        """Compute multi-attribute match score and return explainable signal breakdown."""
        reasons: Dict[str, Any] = {}
        total_score = 0.0

        # Signal 1: Category Match (35%)
        category_matched = lost_report.category_id == found_report.category_id
        reasons["category_match"] = category_matched
        if category_matched:
            total_score += 0.35

        # Signal 2: Text Attributes Similarity (35%)
        # Combine name, description, brand, colour
        lost_text = f"{lost_report.item_name} {lost_report.description} {lost_report.brand or ''} {lost_report.colour or ''}"
        found_text = f"{found_report.item_name} {found_report.description} {found_report.brand or ''} {found_report.colour or ''}"

        lost_tokens = tokenize(lost_text)
        found_tokens = tokenize(found_text)

        common_tokens = lost_tokens.intersection(found_tokens)
        union_tokens = lost_tokens.union(found_tokens)

        jaccard = (len(common_tokens) / len(union_tokens)) if union_tokens else 0.0
        text_score = min(0.35, round(jaccard * 0.70, 2))  # Scale to max 0.35
        total_score += text_score
        reasons["text_similarity"] = round(jaccard, 2)
        reasons["common_keywords"] = sorted(list(common_tokens))

        # Signal 3: Date Proximity (15%)
        # Item found should ideally be on or after the date it was lost
        delta_days = (found_report.date_lost_found - lost_report.date_lost_found).days
        reasons["date_delta_days"] = delta_days

        if 0 <= delta_days <= 14:
            # Linear decay from 0.15 (0 days) down to 0.05 (14 days)
            date_score = round(0.15 - (delta_days * (0.10 / 14.0)), 2)
            total_score += date_score
            reasons["date_proximity_match"] = True
        elif -2 <= delta_days < 0:
            # Small leeway for estimated loss time
            total_score += 0.05
            reasons["date_proximity_match"] = True
        else:
            reasons["date_proximity_match"] = False

        # Signal 4: Location Keyword Match (15%)
        lost_loc_tokens = tokenize(lost_report.location)
        found_loc_tokens = tokenize(found_report.location)
        common_loc = lost_loc_tokens.intersection(found_loc_tokens)
        if common_loc:
            total_score += 0.15
            reasons["location_match"] = True
            reasons["common_locations"] = sorted(list(common_loc))
        else:
            reasons["location_match"] = False

        final_score = min(1.0, round(total_score, 2))
        reasons["score"] = final_score
        return final_score, reasons

    @staticmethod
    def run_matching_for_report(
        db: Session,
        report: ItemReport,
    ) -> List[MatchSuggestion]:
        """Find potential matches for a newly created or updated report and persist suggestions."""
        if report.lifecycle_status != LifecycleStatus.OPEN:
            return []

        # Determine target candidates
        is_lost = report.report_type == ReportType.LOST
        candidate_type = ReportType.FOUND if is_lost else ReportType.LOST

        candidates = db.scalars(
            select(ItemReport).where(
                ItemReport.report_type == candidate_type,
                ItemReport.lifecycle_status == LifecycleStatus.OPEN,
                ItemReport.report_id != report.report_id,
            )
        ).all()

        created_matches: List[MatchSuggestion] = []

        for candidate in candidates:
            lost_rep = report if is_lost else candidate
            found_rep = candidate if is_lost else report

            # Check if match suggestion already exists between this pair
            existing = db.scalar(
                select(MatchSuggestion).where(
                    MatchSuggestion.lost_report_id == lost_rep.report_id,
                    MatchSuggestion.found_report_id == found_rep.report_id,
                )
            )
            if existing:
                continue

            score, reasons = MatchingService.calculate_score(lost_rep, found_rep)

            if score >= MatchingService.MATCH_THRESHOLD:
                match_suggestion = MatchSuggestion(
                    lost_report_id=lost_rep.report_id,
                    found_report_id=found_rep.report_id,
                    score=score,
                    match_reasons=json.dumps(reasons),
                    status=MatchStatus.NEW,
                )
                db.add(match_suggestion)
                created_matches.append(match_suggestion)

                # Persist in-app privacy-safe notification for both reporters
                pct = int(score * 100)
                # Notification for lost item owner
                notif_lost = Notification(
                    user_id=lost_rep.created_by,
                    title="Potential Match Found",
                    message=f"A potential match ({pct}% match) was identified for your lost report '{lost_rep.item_name}' (Case: {lost_rep.case_reference}).",
                    type=NotificationType.MATCH_FOUND,
                    related_report_id=lost_rep.report_id,
                )
                # Notification for found item reporter
                notif_found = Notification(
                    user_id=found_rep.created_by,
                    title="Potential Match Found",
                    message=f"A potential match ({pct}% match) was identified for your found report '{found_rep.item_name}' (Case: {found_rep.case_reference}).",
                    type=NotificationType.MATCH_FOUND,
                    related_report_id=found_rep.report_id,
                )
                db.add_all([notif_lost, notif_found])

                audit = AuditLog(
                    actor_user_id=None,
                    action="MATCH_SUGGESTION_GENERATED",
                    entity_type="MatchSuggestion",
                    entity_id=f"{lost_rep.report_id}_{found_rep.report_id}",
                    summary=json.dumps({"score": score, "reasons": reasons}),
                )
                db.add(audit)

        if created_matches:
            db.commit()
            for m in created_matches:
                db.refresh(m)

        return created_matches
