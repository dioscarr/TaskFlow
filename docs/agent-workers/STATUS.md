# Agent Workers Status

Single source of truth for enhancement tracking. Each entry references a feature, with detail, spec, and integration steps.
Questions and feedback go in QUESTIONS.md (link entries by feature ID).

| ID | Feature | Owner | Status | Detail | Spec | Integration Steps |
| --- | --- | --- | --- | --- | --- | --- |
| P1-APPROVAL-TOGGLE | Approval toggle per session | Worker A | In Progress | Add UI toggle, persist in session metadata | `allowToolExecution` persisted per session and sent with requests | Update AIChat settings UI; persist in session state; pass to stream + fallback |
| P1-TOOL-RISK | Tool risk tiers | Worker A | Complete | Add `risk` to tool registry and enforce approval for high risk | `risk` in tool schema; high-risk always requires approval | Update tool registry; update approval gate; update UI to show risk |
| P1-APPROVAL-UX | Approval UX | Worker A | Complete | Confirm dialog with tool list and risk | Buttons: Allow once, Always allow for session | Update AIChat to render proposed tools with actions |
| P2-STREAM-RETRY | Stream retry policy | Worker B | Complete | Retry once on transient errors with backoff | Backoff 250ms -> 1000ms; preserve partial output | Implemented in stream route with exponential backoff and duplicate prevention |
| P2-STATUS-EVENTS | Stream status events | Worker B | Complete | Emit tool start/finish events and display timeline | Status payload: {tool, phase, elapsedMs} | Stream route emits events; ToolStatusTimeline component renders timeline |
| P2-PREVIEW-TOGGLE | Preview control | Worker B | Complete | Setting to auto-open preview links | Default on; UI toggle; manual open button | Added getPreviewAutoOpen/setPreviewAutoOpen functions in settingsActions |
| P3-CONTEXT-BUDGET | Context budgeter | Worker B | Done (100%) | Token-aware context trimming for large attachments | Clamp prompt context by size; mark truncation | Smart truncation, reporting, and model-aware limits implemented. |
| P3-TOOL-ROUTING | Tool routing | Worker B | Done (100%) | Intent-based tool allowlist selection | Map intents to tool subsets | Logic engine created and integrated into actions.ts/stream. |
| P3-OBSERVABILITY | Trace + metrics | Worker B | Done (100%) | Trace IDs wired in stream + fallback tool calls | Trace IDs in logs and responses; debug event emitted | Session metrics aggregation + UI surface implemented. |
| LINT-UI-MODALS | Lint: modal effects | Worker B | Pending | Remove set-state-in-effect in UI modals and feeds | Avoid setState in effects; use init state or refs | Fix AgentActivityFeed/ConfirmationModal/ContextMenu effects. |
| LINT-UI-CONFETTI | Lint: animation purity | Worker B | Pending | Remove render-time Math.random usage in Confetti | Precompute randomness in effect/state | Fix Confetti render purity warnings. |
| LINT-UI-FILEMANAGER | Lint: FileManager typing | Worker B | Pending | Remove explicit any and add event typing | Use typed helpers and narrow unknown | Clean FileManager any casts and event handlers. |
| LINT-UI-ALEGRA | Lint: AlegraProcessor typing | Worker B | Pending | Remove explicit any and escape quotes | Use typed helpers and HTML entities | Fix AlegraProcessor any and react/no-unescaped-entities. |
