# Worker A Instructions - Safety + Control (Phase 1)

## Mission
Own Phase 1 enhancements: approvals, tool gating, and risk tiering.

## Scope
- Frontend: settings toggle, approval UI state, session persistence.
- Backend: approval enforcement and tool risk tiers.
- Shared status updates: update STATUS.md entries for assigned features.

## Guardrails
- Keep tool IDs limited to registry entries.
- Approval UX must be consistent between streaming and fallback paths.
- High-risk tools always require explicit approval.

## Work Items

1. Approval toggle (per session)
   - FE: add toggle in AIChat settings modal; persist to session state.
   - BE: read `allowToolExecution` from request; honor for stream + fallback.
   - Integration: session metadata stored and restored on open.

2. Tool risk tiers
   - Add `risk` to tool registry entries (low, medium, high).
   - Enforce approval for `risk=high` even if global toggle is on.
   - Update UI to show risk label in approval prompt.

3. Approval UI
   - Show proposed tool list and risk level.
   - Provide actions: "Allow once" and "Always allow for session".

## Acceptance Criteria
- Stream and fallback both return `requiresApproval` if tool use disallowed.
- High-risk tools always ask for approval.
- Toggle state persists across reloads.

## Coordination
- Update STATUS.md after each meaningful step.
- Add integration notes if another worker must complete a dependency.
- Post blockers/questions in QUESTIONS.md and link to related STATUS entry.
