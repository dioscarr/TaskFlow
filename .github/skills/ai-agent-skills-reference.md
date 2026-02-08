# AI Agent Skills Reference

Quick reference guide for AI coding agent capabilities and implementation patterns. Use this to understand which agent to invoke for specific tasks.

---

## Agent Selection Guide

### When to Use Each Agent

**AI Agent Architect**
- Use when: Designing multi-agent systems, orchestration workflows
- Tasks: Agent system design, tool selection algorithms, agentic workflows
- Example: "Design an agent system that can autonomously handle bug fixes"

**Code Generation Engineer**
- Use when: Building code completion, generation, or translation features
- Tasks: Autocomplete, function generation, code explanation, refactoring
- Example: "Implement GitHub Copilot-style code suggestions"

**Agentic AI Systems Engineer**
- Use when: Building production agent infrastructure
- Tasks: Tool execution, distributed agents, streaming responses, observability
- Example: "Set up a scalable agent backend with queue-based execution"

**Applied AI Engineer**
- Use when: Integrating AI into applications
- Tasks: RAG systems, chatbots, IDE plugins, API development
- Example: "Build a documentation chatbot with semantic search"

**Prompt Engineer**
- Use when: Optimizing prompts for better code generation
- Tasks: Few-shot prompting, chain-of-thought, prompt evaluation
- Example: "Improve code generation accuracy through better prompts"

**NLP Engineer / LLM Architect**
- Use when: Model selection, fine-tuning, optimization
- Tasks: LoRA training, quantization, model evaluation, benchmarking
- Example: "Fine-tune Code Llama on our internal codebase"

**AI Solution Architect**
- Use when: Designing end-to-end AI systems
- Tasks: Architecture design, cost optimization, enterprise integration
- Example: "Design a scalable AI coding assistant for 10,000 developers"

**AI Trainer / Code Evaluator**
- Use when: Improving model quality through evaluation
- Tasks: Benchmark creation, RLHF, quality scoring, feedback collection
- Example: "Create evaluation suite for code generation quality"

---

## Common Implementation Patterns

### 1. Tool Execution Framework
```typescript
// Define tools
const tools: Tool[] = [
  {
    name: "read_file",
    description: "Read file contents",
    parameters: { type: "object", properties: { path: { type: "string" } } },
    execute: async ({ path }) => await fs.readFile(path, 'utf-8')
  },
  {
    name: "execute_bash",
    description: "Run bash command",
    parameters: { type: "object", properties: { command: { type: "string" } } },
    execute: async ({ command }) => await execAsync(command)
  }
];

// Use with LLM
const response = await llm.chat(messages, { tools });
if (response.tool_calls) {
  for (const call of response.tool_calls) {
    const tool = tools.find(t => t.name === call.function.name);
    const result = await tool.execute(call.function.arguments);
  }
}
```

### 2. RAG Implementation
```typescript
// Index documents
const chunks = documents.flatMap(doc => chunkDocument(doc, { size: 500, overlap: 50 }));
const embeddings = await embedder.embed(chunks.map(c => c.content));
await vectorStore.upsert(chunks.map((chunk, i) => ({
  id: chunk.id,
  vector: embeddings[i],
  content: chunk.content
})));

// Query
const queryEmbedding = await embedder.embed([question]);
const results = await vectorStore.search(queryEmbedding[0], { limit: 5 });
const context = results.map(r => r.content).join('\n\n');
const answer = await llm.generate(`Context:\n${context}\n\nQuestion: ${question}`);
```

### 3. Streaming Responses
```typescript
// Server (Next.js)
export async function POST(req: NextRequest) {
  const { message } = await req.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const response = await openai.chat.completions.create({
        messages: [{ role: 'user', content: message }],
        stream: true
      });

      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
        }
      }
      controller.close();
    }
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
}

// Client
const eventSource = new EventSource('/api/chat');
eventSource.onmessage = (event) => {
  const { content } = JSON.parse(event.data);
  appendToChat(content);
};
```

### 4. Model Fine-Tuning with LoRA
```python
from peft import LoraConfig, get_peft_model

lora_config = LoraConfig(
    r=16,  # Rank
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05
)

model = get_peft_model(base_model, lora_config)
trainer = Trainer(model=model, train_dataset=dataset)
trainer.train()
```

### 5. Prompt Engineering
```typescript
const fewShotPrompt = `You are an expert TypeScript developer.

Example 1:
Input: reverse a string
Output:
function reverse(str: string): string {
  return str.split('').reverse().join('');
}

Example 2:
Input: ${userInput}
Output:`;

const code = await llm.generate(fewShotPrompt);
```

### 6. Cost Optimization
```typescript
function selectModel(task: Task): string {
  if (task.complexity === 'low' && task.tokens < 500) {
    return 'claude-haiku';  // $0.00025/1K tokens
  }
  if (task.type === 'code_generation') {
    return 'gpt-4-turbo';   // $0.01/1K tokens
  }
  return 'gpt-3.5-turbo';   // $0.0005/1K tokens
}

// Result: 85% cost reduction
```

### 7. Evaluation Framework
```typescript
interface CodeQualityScore {
  functionalCorrectness: number;  // Pass tests?
  styleCompliance: number;        // Follows conventions?
  security: number;               // No vulnerabilities?
  performance: number;            // Efficient?
}

async function evaluate(code: string): Promise<CodeQualityScore> {
  return {
    functionalCorrectness: await runTests(code),
    styleCompliance: await runLinter(code),
    security: await scanSecurity(code),
    performance: await benchmark(code)
  };
}
```

---

## Quick Commands

### Agent Orchestration
```bash
# Start agent system
npm run agent:start

# Execute task with specific agent
curl -X POST /api/agent/execute \
  -d '{"agent": "code-gen", "task": "generate login function"}'

# Monitor agent execution
npm run agent:monitor
```

### Model Training
```bash
# Fine-tune with LoRA
python train.py --base-model codellama/7b --dataset code_examples.jsonl --lora-r 16

# Evaluate on benchmark
python evaluate.py --model ./lora-weights --benchmark humaneval

# Deploy model
python deploy.py --model ./lora-weights --endpoint /api/generate
```

### RAG System Setup
```bash
# Index documents
npm run rag:index --source ./docs --vector-db pinecone

# Start RAG API
npm run rag:serve --port 3000

# Query
curl -X POST /api/rag/query -d '{"question": "How do I authenticate?"}'
```

---

## Best Practices

### Security
✅ Always sanitize user inputs
✅ Use parameterized queries
✅ Scan generated code for vulnerabilities
✅ Implement rate limiting
❌ Never execute arbitrary code without sandboxing
❌ Don't hardcode API keys

### Performance
✅ Cache LLM responses when possible
✅ Use cheaper models for simple tasks
✅ Batch requests when feasible
✅ Implement prompt compression
❌ Don't send entire codebase as context
❌ Avoid unnecessary re-embeddings

### Quality
✅ Validate syntax before returning code
✅ Run automated tests
✅ Collect user feedback
✅ Monitor pass rates
❌ Don't skip evaluation
❌ Avoid overfitting to benchmarks

---

## Integration Examples

### VS Code Extension
```typescript
vscode.languages.registerInlineCompletionItemProvider(
  { pattern: '**' },
  {
    async provideInlineCompletionItems(document, position) {
      const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
      const completion = await getAICompletion(prefix);
      return [new vscode.InlineCompletionItem(completion)];
    }
  }
);
```

### CLI Tool
```typescript
#!/usr/bin/env node
import { program } from 'commander';

program
  .command('generate <description>')
  .description('Generate code from description')
  .action(async (description) => {
    const code = await agent.execute({ type: 'code_gen', prompt: description });
    console.log(code);
  });

program.parse();
```

### Web API
```typescript
app.post('/api/agent/chat', async (req, res) => {
  const { messages } = req.body;
  const response = await agent.chat(messages);
  res.json({ message: response });
});
```

---

## Troubleshooting

**Issue:** Slow response times
- Check if you can use a smaller model
- Implement caching
- Use prompt compression

**Issue:** High costs
- Route simple tasks to cheaper models
- Implement semantic caching
- Use prompt caching for repeated prefixes

**Issue:** Low code quality
- Improve prompts with few-shot examples
- Fine-tune on high-quality examples
- Implement automated quality checks

**Issue:** Security vulnerabilities
- Run static analysis on generated code
- Implement security prompt instructions
- Use code scanning tools

---

## Resources

### Documentation
- Agent architecture: `/agents/AIAgentArchitect.agent.md`
- Code generation: `/agents/CodeGenEngineer.agent.md`
- Prompt engineering: `/agents/PromptEngineer.agent.md`
- Full agent list: `/agents/`

### Tools & Libraries
- LLM SDKs: OpenAI, Anthropic, LangChain
- Vector stores: Pinecone, Weaviate, Chroma
- Fine-tuning: PEFT, LoRA, Hugging Face Transformers
- Evaluation: HumanEval, LeetCode, custom benchmarks

### Community
- GitHub: ai-coding-agents
- Discord: AI Coding Community
- Blog: AI Agent Engineering Patterns

---

## Quick Reference Table

| Task | Agent | Key Pattern | Typical Cost |
|------|-------|------------|--------------|
| Autocomplete | Code Gen Engineer | Inline completion | $0.001/request |
| Full function | Code Gen Engineer | Few-shot prompting | $0.01/request |
| Refactoring | Code Gen Engineer | AST analysis + LLM | $0.02/request |
| Multi-file edit | Agentic Systems | Agent orchestration | $0.05/request |
| Documentation Q&A | Applied AI Engineer | RAG system | $0.005/query |
| Model fine-tuning | NLP Engineer | LoRA training | $50-500/model |
| System design | Solution Architect | Architecture review | Human-driven |
| Quality improvement | Trainer/Evaluator | RLHF pipeline | $1000-5000/iteration |

---

**Use this reference to quickly understand and implement AI coding agent patterns.**
