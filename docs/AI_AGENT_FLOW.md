# AI Agent Tool + Chat Flow (Mermaid)

Below is a Mermaid flowchart visualizing the chat flow with tool shortcuts and tool execution.

```mermaid
flowchart TD
  %% UI inputs
  U[User] -->|Click tool chip| C[Tool shortcut chips]
  U -->|Type message| I[Chat input]
  C -->|Prefill prompt + set active tool| I
  U -->|Attach files (optional)| A[Attachments]

  %% Send flow
  I --> S[Send message]
  A --> S
  S --> M[AI chat handler]
  M -->|Detect active tool / intent| R{Tool selected?}

  %% Tool execution
  R -->|Yes| T[Tool router]
  T --> V[verify_dgii_rnc]
  T --> E[extract_alegra_bill]
  T --> P[record_alegra_payment]
  T --> F[create_markdown_file]

  %% Responses
  V --> O[Chat response]
  E --> O
  P --> O
  F --> O
  R -->|No| O
  O -->|Display reply| U

  %% State cleanup
  O -->|Clear active tool| C
```
