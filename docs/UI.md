# UI Plan

Build the UI only in the planned frontend phases. The UI should be clear and usable rather than decorative; prioritize privacy, status clarity, responsive forms, and predictable workflows.

## Shared navigation
- Project name/logo; Browse Items; Report Item (signed-in users); My Reports; My Claims; Notifications; Login/Register or profile menu.
- Staff sees report review, claim review, and custody/return links.
- Admin sees dashboard, users/roles, categories, custody locations, report moderation, and audit links.
- Do not render links/buttons the actor cannot use, but still enforce every permission on the backend.

## Public pages
- Home page with clear Browse and Report/Sign-in actions; recent verified public reports only.
- Browse/search page with keyword, lost/found type, category, date range, approximate location, colour, status, and pagination. Show active filters and a reset action.
- Report detail with case reference, item summary, approximate date/location, permitted photos/details, moderation/lifecycle status, and claim action only when eligible and signed in.
- Registration/login with field-level validation and safe authentication errors.

## Registered-user pages
- Create/edit lost or found report. Require the appropriate fields; distinguish approximate public location from restricted custody/contact details. Optional colour, brand, marks, and image upload.
- My Reports with case reference, moderation/lifecycle status, history where allowed, and edit/close actions only when allowed.
- My Claims with status, submitted evidence access for the claimant, and permitted reviewer notes/status updates.
- My Matches with advisory explanations and safe links to related reports.
- Notifications with unread state and read actions; profile page for own permitted personal fields.

## Staff pages
- Pending reports queue with safe search/filtering; report review detail shows restricted information only after authorization.
- Claim review queue with private evidence, request-more-information, approve/reject, reason/notes, and reviewer context.
- Custody view/change form; return/handover form available only for an approved claim. Confirm before Returned, Archived, or Disposed and capture required reason/confirmation.
- Show relevant status/custody history, not the unrestricted system audit log.

## Admin pages
- Dashboard counts for Open, Matched, Claimed, Returned, Archived, and Disposed with clear definitions.
- User management and role provisioning; category management; custody-location management; report moderation/visibility; paginated audit log.
- Confirm role changes and sensitive moderation/retention actions.

## UX, accessibility, and privacy rules
- Responsive layouts down to 360px; labels, keyboard focus, readable status text, adequate contrast, and accessible error associations.
- Include loading, success, error, empty, and permission-denied states.
- Keep public approximate location separate from exact custody address/contact fields.
- Never show claim evidence, private review notes, password/session data, or restricted custody/contact information on public pages, cards, URLs, notifications, or client logs.
- Confirmation dialogs do not replace backend policy checks. Route guards improve UX but do not provide security.
- Avoid excessive animation or visual complexity; forms and status history should remain easy to understand in a college demonstration.
