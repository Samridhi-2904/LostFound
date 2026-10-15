# Lab File and Viva Notes

> Keep this document aligned with the actual code. A design requirement is not proof that the feature is implemented or tested.

## Project title
Lost and Found Management System

## Aim
To develop a role-based web application for reporting and searching lost/found items, identifying potential matches, reviewing ownership claims, tracking custody, and recording item returns.

## Problem statement
Lost-item information is often scattered across people and locations. The system centralizes reports and search while giving authorized staff a controlled way to verify reports, review claims, and document handovers without exposing private ownership evidence or precise custody information publicly.

## Objectives
- Provide registration, authentication, and role-based access for Visitor, Registered User, Staff Member, and Administrator.
- Create and manage lost/found reports with unique case references and status history.
- Search using keyword, type, category, date range, location, colour, and status.
- Suggest potential lost/found matches using explainable attributes.
- Submit private ownership evidence and support staff/admin decisions.
- Track custody locations, notifications, returns, and audit history.
- Provide admin management and dashboard summaries.
- Verify security and workflow rules with automated tests.

## Main modules
1. Authentication and user roles.
2. Categories, reports, and image uploads.
3. Search and filters.
4. Match suggestions and notifications.
5. Claims and staff review.
6. Custody, return/handover, and status history.
7. Administration, dashboard, and audit log.

## Main entities
`User`, `StaffProfile`, `Category`, `CustodyLocation`, `ItemReport`, `LostItem`, `FoundItem`, `ItemImage`, `MatchSuggestion`, `Claim`, `Return`, `Notification`, `ReportStatusHistory`, `AuditLog`.

## Key workflow
User reports an item → report is moderated → search/matching suggests a possible related report → claimant submits private evidence → staff/admin reviews evidence and records a decision → after approval, authorized staff records handover → status, custody, history, and audit records update.

A match is not proof of ownership. A report cannot be marked Returned before an approved claim and saved handover confirmation.

## Viva answers
**What is the project?** A role-based web system for reporting and searching lost/found items and managing the claim and return process.

**Why are there four actors?** Visitors need public search; registered users create reports and claims; staff review cases and record returns; administrators manage system configuration and oversight.

**What is an entity?** A concept whose data is stored in the database, such as User, ItemReport, Claim, or CustodyLocation.

**What is a foreign key?** A field linking one record to another, such as `ItemReport.created_by` referencing `User`.

**What is a MatchSuggestion?** A stored, explainable indication that a lost report may correspond to a found report. It helps discovery but does not prove ownership or approve a claim.

**Why store ReportStatusHistory?** To know who changed a report's status, when it changed, and why, rather than losing the earlier state.

**Why store AuditLog?** To trace important security and administrative actions, such as role changes and claim decisions.

**Why hash passwords?** A password hash prevents the application from storing users' original passwords; the original password should never be logged or returned.

**Why separate public and private schemas?** To prevent public responses from exposing claim evidence, internal notes, precise custody addresses, or restricted contact details.

**Why does Returned require a Claim and Return record?** The system must verify that ownership was approved and that handover confirmation was recorded; changing a status alone is not enough.

**What is an API?** A defined interface through which the frontend sends requests to the backend and receives structured responses.

**What is a migration?** A versioned database schema change that can be applied consistently to development/test environments.

**How is matching performed?** The initial design uses explainable signals such as category, description/attributes, date proximity, and location. The exact algorithm and measured quality must be described from the actual implementation.

**How is the system tested?** Automated tests check expected behaviour, invalid inputs, role/ownership permissions, privacy, and workflow transitions. Only report tests that were actually run.

## Demonstration checklist
- Show public search without exposing restricted data.
- Create a report and show its unique case reference.
- Show staff verification and report status history.
- Show a potential match as advisory, not an automatic decision.
- Submit a claim and demonstrate that private evidence is not public.
- Show staff decision metadata and the approved-claim requirement for return.
- Record handover and show Return, lifecycle status, and audit/history records.
- Demonstrate that a normal user cannot call staff/admin endpoints or read another user's data.

## Implementation status
Before submission, fill in what is actually implemented, what tests were run, and what remains incomplete. Do not describe planned modules as completed.
