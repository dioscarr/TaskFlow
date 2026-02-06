# TaskFlow AI Refactoring Plan - "Antigravity Level"

## 1. Objective
Transform the current `AIChat` and `AgentSymphony` into a high-intelligence, agentic development environment capable of building applications with the same level of capability as the "Antigravity" model.

## 2. current State Analysis
### Components
- **Frontend**: `AIChat.tsx` - Handles UI, streaming, tool rendering.
- **Orchestration**: `AgentSymphony.ts` - Custom Plan/Execute/Review loop.
- **Tools**: `toolLibrary.ts` - Standard set (`write_file` (overwrite), `execute_command`, `search_web`).
- **Skills**: `skillsLibrary.ts` - Defined but seemingly underutilized.

### Limitations (vs Antigravity)
1.  **File Editing**: `edit_file` overwrites entire files. Antigravity uses `replace_file_content` (chunks) for precision and token efficiency.
2.  **Exploration**: Antigravity has `view_file` (chunks/lines), `list_dir`, `find_by_name`. TaskFlow has `read_file` (full) and `search_files`.
3.  **Command Execution**: TaskFlow `execute_command` is basic. Antigravity has interactive `run_command` with background monitoring.
4.  **Context**: Antigravity has deep context of the IDE state. TaskFlow needs to better ingest workspace state.

## 3. Requirements for "Modern AI Tooling"
To achieve parity, we need to implement:

### A. Enhanced Toolset (The "Hands")
- [ ] **Smart File Editor**: Implement `apply_diff` or `replace_chunk` logic instead of full overwrites.
- [ ] **FileSystem Explorer**: `ls`, `read_partial_file` (for large files).
- [ ] **Code Search**: `grep` or ast-based search.

### B. Cognitive Architecture (The "Brain")
- [ ] **Refined Symphony**: Improve the loop. Maybe adopt a "ReAct" style or a State Machine (like LangGraph concepts, even if custom).
- [ ] **Memory**: Short-term (conversation) vs Long-term (summaries, docs).
- [ ] **Planning**: Explicit "Architecture" step before coding.

### C. Skills & Patterns
- [ ] **Feature Development Skill**: "Plan -> Scaffold -> Implement -> Verify".
- [ ] **Debugging Skill**: "Analyze Error -> Read Code -> Formulate Hypothesis -> Fix".

## 4. Proposed Steps
1.  **Dismantle**: Audit and deprecate "overwrite" style tools and rigid agent loops.
2.  **Re-Tool**: Implement the primitive tools (File, Shell, Search) with high fidelity.
3.  **Re-Agent**: Rebuild `AgentSymphony` to leverage these fine-grained tools effectively.
4.  **UI Update**: Update `AIChat` to support the new interactive tool flows (e.g. "Approving a command").

## 5. User Confirmation
- Do these requirements align with your vision?
- Are there specific frameworks (Vercel AI SDK, LangChain, etc.) you want to standardize on, or keep custom?
