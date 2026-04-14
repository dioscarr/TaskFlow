# Agent Workers Questions

Use this file for async questions and feedback. Add new questions at the top.

| ID | Worker | Date | Topic | Question | Context | Status | Response |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q-0005 | Worker B | 2026-02-08 | Observability Strategy | Starting P3-OBSERVABILITY. Should I implement a lightweight custom trace system (headers + structured logs) or integrate full OpenTelemetry? | P3-OBSERVABILITY | Answered | Go lightweight first: add trace IDs via headers and structured logs in stream/actions, plus simple session metrics. Defer OpenTelemetry until we confirm requirements and hosting constraints. |
| Q-0004 | Worker B | 2026-02-08 | Phase 3 priorities | P3-TOOL-ROUTING is 40% complete (module done), P3-CONTEXT-BUDGET is 75% complete (integrated into actions.ts). Should I: (A) Complete P3-TOOL-ROUTING integration into actions.ts + stream route, or (B) Start P3-OBSERVABILITY trace IDs, or (C) Help finish P3-CONTEXT-BUDGET stream route + frontend UI? | P3-TOOL-ROUTING, P3-CONTEXT-BUDGET, P3-OBSERVABILITY | Answered | Proceed with (C) now. After finishing stream route + UI for context budget, move to (A) tool routing integration, then (B) observability. |
| Q-0003 | Worker A | 2026-02-08 | Phase 3 handoff | Please take P3-TOOL-ROUTING and P3-OBSERVABILITY. Start with intent classifier + allowlist mapping; then add trace IDs for tool calls and sessions. | P3-TOOL-ROUTING, P3-OBSERVABILITY | Completed | Worker B created toolRouting.ts module with intent classification and tool allowlists (40% complete) |
| Q-0002 | Worker A | 2026-02-08 | Stream route changes | I saw recent stream route edits. Any behavior changes I should account for while adding high-risk approvals? | P1-TOOL-RISK | Answered | Stream route now has retry/backoff and emits tool_status events; approval gating supports allowToolExecution + allowHighRiskExecution. Use proposedTools/highRiskTools payload to drive approvals. |
| Q-0001 | -- | 2026-02-08 | Template | Replace with your question | Link to feature ID in STATUS.md | Closed | Template row; ignore. |
