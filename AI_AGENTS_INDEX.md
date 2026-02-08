# AI Coding Agents - Complete Reference

Master index for all AI coding agent personas, skills, and implementation patterns. Use this as your starting point for building AI-powered development tools.

---

## Agent Personas

### Core AI Coding Agents
Located in `.github/agents/`

1. **[AI Agent Architect](./agents/AIAgentArchitect.agent.md)**
   - Design autonomous agent systems
   - Multi-agent orchestration
   - Tool selection & planning algorithms
   - When to use: Building agentic frameworks, designing agent workflows

2. **[Code Generation Engineer](./agents/CodeGenEngineer.agent.md)**
   - Intelligent code completion
   - Function generation from descriptions
   - Code translation & refactoring
   - When to use: IDE plugins, code generation features, autocomplete

3. **[Agentic AI Systems Engineer](./agents/AgenticAISystemsEngineer.agent.md)**
   - Production agent infrastructure
   - Tool execution frameworks
   - Distributed agent systems
   - When to use: Scalable agent backends, production deployment

### Applied AI & Developer Tools

4. **[Applied AI Engineer](./agents/AppliedAIEngineer.agent.md)**
   - RAG systems for documentation
   - AI chatbots
   - IDE integration
   - When to use: User-facing AI features, chatbots, search

5. **[Prompt Engineer](./agents/PromptEngineer.agent.md)**
   - Optimize prompts for code generation
   - Few-shot learning
   - Chain-of-thought reasoning
   - When to use: Improving LLM accuracy, prompt optimization

### Model & Algorithm Specialists

6. **[NLP Engineer / LLM Architect](./agents/NLPEngineer.agent.md)**
   - Model fine-tuning (LoRA, PEFT)
   - Quantization & optimization
   - Evaluation & benchmarking
   - When to use: Model training, fine-tuning, performance optimization

7. **[AI Solution Architect](./agents/AISolutionArchitect.agent.md)**
   - End-to-end system design
   - Cost-performance trade-offs
   - Enterprise integration
   - When to use: Architecture planning, system design, scaling strategy

### Quality & Training

8. **[AI Trainer / Code Evaluator](./agents/AITrainerEvaluator.agent.md)**
   - Benchmark creation
   - RLHF implementation
   - Quality scoring
   - When to use: Model improvement, evaluation frameworks, feedback collection

---

## Skills & Patterns

### Quick Reference Guides
Located in `.github/skills/`

- **[AI Agent Skills Reference](./skills/ai-agent-skills-reference.md)**
  - Agent selection guide
  - Common implementation patterns
  - Quick commands
  - Best practices

- **[LLM Integration Patterns](./skills/llm-integration-patterns.md)**
  - Function calling / tool use
  - Context management
  - Streaming responses
  - Cost tracking & optimization

- **[Agent Orchestration Patterns](./skills/agent-orchestration-patterns.md)**
  - Multi-agent architectures
  - Task decomposition
  - Communication patterns
  - Error handling & recovery

### Existing Docker Skills
- **[Docker Containerization](./skills/docker-containerize.md)**
- **[Docker Operations](./skills/docker-ops.md)**
- **[Error Handling Patterns](./skills/error-handling-patterns.md)**
- **[Next.js Server Actions](./skills/nextjs-server-actions.md)**
- **[Ngrok Tunnel Management](./skills/ngrok-tunnel-management.md)**

---

## Decision Tree: Which Agent to Use?

### Task: Code Generation
```
Simple autocomplete → Code Gen Engineer (inline completion)
Full function → Code Gen Engineer (few-shot prompting)
Complex refactoring → Code Gen Engineer + Prompt Engineer
Multi-file changes → Agentic Systems Engineer (orchestration)
```

### Task: System Design
```
Architecture review → AI Solution Architect
Cost optimization → AI Solution Architect
Enterprise integration → AI Solution Architect
```

### Task: Model Work
```
Improve accuracy → Prompt Engineer (prompt optimization)
Fine-tune model → NLP Engineer (LoRA training)
Benchmark performance → AI Trainer/Evaluator
```

### Task: Application Integration
```
Build chatbot → Applied AI Engineer (RAG)
IDE plugin → Applied AI Engineer (LSP)
API development → Agentic Systems Engineer (production)
```

### Task: Multi-Agent System
```
Design workflow → AI Agent Architect
Implement orchestration → Agentic Systems Engineer
Monitor & debug → All agents (observability patterns)
```

---

## Quick Start Templates

### 1. Simple Code Generation API
```typescript
// Uses: Code Gen Engineer + LLM Integration Patterns

import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/generate', async (req, res) => {
  const { description } = req.body;

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      {
        role: "system",
        content: "You are an expert TypeScript developer. Generate clean, production-quality code."
      },
      {
        role: "user",
        content: `Generate a function: ${description}`
      }
    ]
  });

  res.json({ code: completion.choices[0].message.content });
});
```

### 2. RAG-Powered Documentation Assistant
```typescript
// Uses: Applied AI Engineer + RAG Patterns

// Index documentation
const chunks = await chunkDocuments(docs, { size: 500, overlap: 50 });
const embeddings = await embedModel.encode(chunks.map(c => c.content));
await vectorStore.upsert(chunks.map((chunk, i) => ({
  id: chunk.id,
  vector: embeddings[i],
  content: chunk.content
})));

// Query
app.post('/api/docs/ask', async (req, res) => {
  const { question } = req.body;

  const queryEmbedding = await embedModel.encode([question]);
  const results = await vectorStore.search(queryEmbedding[0], { limit: 3 });

  const context = results.map(r => r.content).join('\n\n');
  const answer = await llm.generate(`Context:\n${context}\n\nQuestion: ${question}`);

  res.json({ answer, sources: results.map(r => r.metadata) });
});
```

### 3. Multi-Agent Code Review
```typescript
// Uses: Agent Architect + Orchestration Patterns

async function reviewCode(pullRequest: PullRequest) {
  // Parallel execution of specialized agents
  const [securityReview, styleReview, logicReview] = await Promise.all([
    securityAgent.scan(pullRequest.diff),
    styleAgent.check(pullRequest.diff),
    logicAgent.review(pullRequest.diff)
  ]);

  // Synthesize results
  const summary = await summaryAgent.synthesize({
    security: securityReview,
    style: styleReview,
    logic: logicReview
  });

  return {
    approved: securityReview.issues.length === 0,
    reviews: { securityReview, styleReview, logicReview },
    summary
  };
}
```

### 4. Fine-Tuning Pipeline
```python
# Uses: NLP Engineer + Model Training Patterns

from peft import LoraConfig, get_peft_model

# Configure LoRA
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05
)

# Apply to base model
model = AutoModelForCausalLM.from_pretrained("codellama/7b")
model = get_peft_model(model, lora_config)

# Train
trainer = Trainer(
    model=model,
    train_dataset=code_dataset,
    args=TrainingArguments(
        output_dir="./lora-weights",
        num_train_epochs=3,
        learning_rate=2e-4
    )
)

trainer.train()
```

---

## Implementation Checklist

### Building a Code Generation Feature
- [ ] Define use case (autocomplete, function generation, refactoring)
- [ ] Select appropriate model (GPT-4, Claude, Code Llama)
- [ ] Design prompt template (see Prompt Engineer)
- [ ] Implement context gathering (relevant code, imports)
- [ ] Add streaming for UX (see LLM Integration Patterns)
- [ ] Implement cost tracking
- [ ] Add evaluation metrics (see AI Trainer/Evaluator)
- [ ] Deploy with monitoring (see Solution Architect)

### Building a Multi-Agent System
- [ ] Identify required agent types
- [ ] Design communication pattern (message bus, shared state)
- [ ] Implement task decomposition
- [ ] Add agent selection logic
- [ ] Implement error handling & retries
- [ ] Add execution tracing
- [ ] Test end-to-end workflow
- [ ] Deploy with observability

### Fine-Tuning a Model
- [ ] Collect high-quality training data
- [ ] Prepare dataset (tokenization, formatting)
- [ ] Choose fine-tuning method (LoRA, full fine-tuning)
- [ ] Configure training parameters
- [ ] Train and evaluate
- [ ] Benchmark against baseline
- [ ] Deploy and monitor performance

---

## Cost Estimates

### Typical Costs per 1000 Requests

| Feature | Primary Model | Cost Range | Optimization Strategy |
|---------|--------------|------------|----------------------|
| Autocomplete | GPT-3.5-turbo | $0.50-2.00 | Semantic caching, prompt compression |
| Function Generation | GPT-4-turbo | $10-30 | Route to GPT-3.5 for simple cases |
| Code Review | Claude Opus | $15-40 | Use haiku for style checks |
| Documentation Q&A | GPT-3.5 + Embeddings | $1-3 | Cache popular queries |
| Multi-Agent Workflow | Mixed models | $20-100 | Model routing, early termination |

### Cost Optimization Strategies
1. **Model Routing:** Use cheaper models for simple tasks (85% savings)
2. **Semantic Caching:** Cache similar queries (70% hit rate typical)
3. **Prompt Caching:** (Anthropic) Cache expensive context (90% savings)
4. **Batch Processing:** Reduce API overhead
5. **Early Termination:** Stop generation when sufficient

---

## Performance Benchmarks

### Response Times (P95)
- Autocomplete: 50-200ms
- Function Generation: 1-3s
- Multi-Agent Workflow: 5-15s
- Fine-Tuning: Hours to days

### Model Throughput (tokens/second)
- API Models: 50-100 tokens/s
- Self-Hosted (vLLM): 100-500 tokens/s
- Quantized Models: 200-1000 tokens/s

---

## Common Pitfalls

❌ **Don't:** Send entire codebase as context (token limits, cost)
✅ **Do:** Use semantic search to retrieve relevant snippets

❌ **Don't:** Use GPT-4 for everything (expensive)
✅ **Do:** Route to appropriate model based on task complexity

❌ **Don't:** Ignore evaluation (hallucinations, security issues)
✅ **Do:** Implement automated quality checks

❌ **Don't:** Block UI during generation
✅ **Do:** Use streaming responses

❌ **Don't:** Assume first generation is perfect
✅ **Do:** Implement retry logic, validation

---

## Resources

### Official Documentation
- OpenAI API: https://platform.openai.com/docs
- Anthropic Claude: https://docs.anthropic.com
- Hugging Face Transformers: https://huggingface.co/docs/transformers

### Tools & Libraries
- LangChain: Multi-agent orchestration
- LlamaIndex: RAG framework
- PEFT: Parameter-efficient fine-tuning
- vLLM: High-throughput inference

### Benchmarks
- HumanEval: Code generation benchmark
- MBPP: Mostly Basic Python Problems
- CodeXGLUE: Code understanding & generation

### Community
- GitHub Copilot: Reference implementation
- AutoGPT: Autonomous agent example
- BabyAGI: Task-driven agent

---

## Getting Started

1. **Start with a simple use case**: Code completion or documentation Q&A
2. **Choose one agent persona**: Begin with Code Gen Engineer or Applied AI Engineer
3. **Reference implementation patterns**: Use skills guides for proven patterns
4. **Build, measure, iterate**: Start simple, add complexity as needed
5. **Scale when ready**: Use Solution Architect patterns for production

---

## Next Steps

Ready to build? Start here:

- **New to AI coding tools?** → Read [Code Gen Engineer](./agents/CodeGenEngineer.agent.md)
- **Building a chatbot?** → Read [Applied AI Engineer](./agents/AppliedAIEngineer.agent.md)
- **Need multi-agent system?** → Read [Agent Architect](./agents/AIAgentArchitect.agent.md)
- **Optimizing prompts?** → Read [Prompt Engineer](./agents/PromptEngineer.agent.md)
- **Fine-tuning models?** → Read [NLP Engineer](./agents/NLPEngineer.agent.md)
- **Designing architecture?** → Read [Solution Architect](./agents/AISolutionArchitect.agent.md)

---

**Version:** 1.0
**Last Updated:** 2026-02-08
**Maintained by:** TaskFlow AI Development Team
