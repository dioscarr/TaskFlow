# Worker B Instructions - Reliability + UX (Phase 2)

## Mission
Own Phase 2 enhancements: streaming reliability, status events, preview controls.

## Scope
- Backend: stream retry/backoff and status events.
- Frontend: render status timeline and preview toggle behavior.
- Shared status updates: update STATUS.md entries for assigned features.

## Guardrails
- Preserve partial stream content on retry.
- Do not duplicate tool execution on retries.
- Preview auto-open must be user-controlled.

## Work Items

1. Stream retry policy
   - Add retry once for transient errors with exponential backoff.
   - Keep partial output; resume without duplicating text.

2. Status events
   - Emit status events (tool start/finish) from stream.
   - UI: show compact timeline with tool name and elapsed time.

3. Preview control
   - Add user setting: auto-open preview links.
   - When off, show explicit "Open preview" action.

## Acceptance Criteria
- Retry recovers without duplicated text or tool calls.
- Status events appear in order and are human-readable.
- Preview behavior honors setting.

## Coordination
- Update STATUS.md after each meaningful step.
- Note integration points with Worker A (shared settings model).
- Post blockers/questions in QUESTIONS.md and link to related STATUS entry.

## Checking for Updates
1. Review STATUS.md for any status or scope changes.
2. Review QUESTIONS.md for new handoff requests or clarifications and respond to any open questions you can resolve.
3. Add new questions to QUESTIONS.md as soon as they arise, and update status when answered.
3. Scan recent changes in relevant files before editing:
   - src/app/api/chat/stream/route.ts
   - src/components/AIChat.tsx
   - src/components/ai-chat/ToolTimeline.tsx
   - src/lib/toolLibrary.ts
4. If changes are unexpected, ask for guidance in QUESTIONS.md before proceeding.
