# LLM Integration Patterns

Core patterns for integrating LLMs into coding tools and applications. Use this for building AI-powered development features.

---

## 1. Function Calling / Tool Use

### OpenAI Format
```typescript
const tools = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read contents of a file",
      parameters: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Path to file" }
        },
        required: ["file_path"]
      }
    }
  }
];

const response = await openai.chat.completions.create({
  model: "gpt-4-turbo",
  messages: [{ role: "user", content: "Show me the contents of config.json" }],
  tools
});

if (response.choices[0].message.tool_calls) {
  for (const toolCall of response.choices[0].message.tool_calls) {
    const result = await executeTool(toolCall.function.name, toolCall.function.arguments);
    // Feed result back to LLM
  }
}
```

### Anthropic Format
```typescript
const tools = [
  {
    name: "read_file",
    description: "Read file contents",
    input_schema: {
      type: "object",
      properties: {
        file_path: { type: "string" }
      },
      required: ["file_path"]
    }
  }
];

const response = await anthropic.messages.create({
  model: "claude-3-opus-20240229",
  max_tokens: 4096,
  messages: [{ role: "user", content: "Read config.json" }],
  tools
});
```

---

## 2. Context Management

### Sliding Window
```typescript
function manageContext(messages: Message[], maxTokens: number = 8000) {
  let totalTokens = 0;
  const contextWindow: Message[] = [];

  // Always keep system message
  if (messages[0].role === 'system') {
    contextWindow.push(messages[0]);
    totalTokens += estimateTokens(messages[0].content);
  }

  // Add messages from most recent, working backwards
  for (let i = messages.length - 1; i >= 1; i--) {
    const msgTokens = estimateTokens(messages[i].content);
    if (totalTokens + msgTokens > maxTokens) break;

    contextWindow.unshift(messages[i]);
    totalTokens += msgTokens;
  }

  return contextWindow;
}
```

### Summarization
```typescript
async function compressHistory(messages: Message[]): Promise<Message[]> {
  if (messages.length < 10) return messages;

  // Summarize middle messages, keep first and last
  const summary = await llm.generate(`Summarize this conversation concisely:

${messages.slice(1, -5).map(m => `${m.role}: ${m.content}`).join('\n')}

Summary:`);

  return [
    messages[0],  // System message
    { role: 'system', content: `Previous conversation summary: ${summary}` },
    ...messages.slice(-5)  // Recent messages
  ];
}
```

---

## 3. Streaming Responses

### Server-Sent Events (SSE)
```typescript
// Server (Next.js Route Handler)
export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4-turbo',
          messages,
          stream: true
        });

        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            const data = `data: ${JSON.stringify({ content })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}

// Client
function useStreamingChat() {
  const [content, setContent] = useState('');

  async function sendMessage(message: string) {
    const eventSource = new EventSource('/api/chat');

    eventSource.onmessage = (event) => {
      if (event.data === '[DONE]') {
        eventSource.close();
        return;
      }

      const { content: chunk } = JSON.parse(event.data);
      setContent(prev => prev + chunk);
    };

    eventSource.onerror = () => eventSource.close();
  }

  return { content, sendMessage };
}
```

---

## 4. Error Handling & Retries

### Exponential Backoff
```typescript
async function llmWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      // Retry on rate limits or temporary errors
      if (error.status === 429 || error.status >= 500) {
        const delay = Math.pow(2, attempt) * 1000;  // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;  // Don't retry on client errors
      }
    }
  }
}
```

### Fallback Models
```typescript
async function llmWithFallback(prompt: string): Promise<string> {
  const models = ['gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3-haiku'];

  for (const model of models) {
    try {
      return await llm.generate(prompt, { model });
    } catch (error) {
      console.warn(`Model ${model} failed, trying next...`);
      continue;
    }
  }

  throw new Error('All models failed');
}
```

---

## 5. Cost Tracking

### Token Counting
```typescript
import { encoding_for_model } from 'tiktoken';

function estimateTokens(text: string, model: string = 'gpt-4'): number {
  const encoding = encoding_for_model(model);
  const tokens = encoding.encode(text);
  encoding.free();
  return tokens.length;
}

function estimateCost(inputTokens: number, outputTokens: number, model: string): number {
  const costs = {
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }
  };

  const modelCosts = costs[model] || costs['gpt-3.5-turbo'];
  return (inputTokens / 1000) * modelCosts.input +
         (outputTokens / 1000) * modelCosts.output;
}
```

### Budget Enforcer
```typescript
class BudgetEnforcer {
  private spent: number = 0;
  private limit: number;

  constructor(dailyLimit: number) {
    this.limit = dailyLimit;
  }

  async execute<T>(fn: () => Promise<T>, estimatedCost: number): Promise<T> {
    if (this.spent + estimatedCost > this.limit) {
      throw new Error(`Budget limit exceeded: $${this.spent.toFixed(2)}/$${this.limit}`);
    }

    const result = await fn();
    this.spent += estimatedCost;
    return result;
  }

  getUsage(): { spent: number; remaining: number } {
    return { spent: this.spent, remaining: this.limit - this.spent };
  }
}
```

---

## 6. Prompt Caching

### Anthropic Prompt Caching
```typescript
// Cache expensive context like large codebases
const response = await anthropic.messages.create({
  model: "claude-3-opus-20240229",
  max_tokens: 1024,
  system: [
    {
      type: "text",
      text: "You are a coding assistant.",
      cache_control: { type: "ephemeral" }  // Cache this
    },
    {
      type: "text",
      text: largeCodebaseContext,  // Expensive to send each time
      cache_control: { type: "ephemeral" }  // Cache this too
    }
  ],
  messages: [
    { role: "user", content: "Explain this function: ..." }
  ]
});

// Subsequent requests reuse cached context (90% cost savings!)
```

### Semantic Caching
```typescript
class SemanticCache {
  private vectorStore: VectorStore;

  async get(query: string, threshold: number = 0.95): Promise<string | null> {
    const embedding = await embed(query);
    const results = await this.vectorStore.search(embedding, { limit: 1 });

    if (results.length > 0 && results[0].score >= threshold) {
      return results[0].metadata.response;
    }

    return null;
  }

  async set(query: string, response: string): Promise<void> {
    const embedding = await embed(query);
    await this.vectorStore.upsert([{
      id: crypto.randomUUID(),
      vector: embedding,
      metadata: { query, response }
    }]);
  }
}

// Usage
const cached = await semanticCache.get("How do I reverse a string?");
if (cached) return cached;

const response = await llm.generate(query);
await semanticCache.set(query, response);
```

---

## 7. Structured Output

### JSON Mode
```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4-turbo",
  messages: [
    {
      role: "system",
      content: "You are a code analyzer. Always respond with valid JSON."
    },
    {
      role: "user",
      content: "Analyze this function and return metrics as JSON"
    }
  ],
  response_format: { type: "json_object" }
});

const data = JSON.parse(response.choices[0].message.content);
```

### Schema Validation
```typescript
import Ajv from 'ajv';

const schema = {
  type: "object",
  properties: {
    functionName: { type: "string" },
    parameters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string" }
        },
        required: ["name", "type"]
      }
    },
    returnType: { type: "string" }
  },
  required: ["functionName", "parameters", "returnType"]
};

const ajv = new Ajv();
const validate = ajv.compile(schema);

const llmOutput = await llm.generate(prompt);
const parsed = JSON.parse(llmOutput);

if (!validate(parsed)) {
  console.error("Validation errors:", validate.errors);
  // Retry with schema in prompt
}
```

---

## 8. Multi-Turn Conversations

### Session Management
```typescript
interface Session {
  id: string;
  messages: Message[];
  metadata: {
    userId: string;
    createdAt: Date;
    lastActivity: Date;
  };
}

class ConversationManager {
  private sessions: Map<string, Session> = new Map();

  createSession(userId: string): string {
    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, {
      id: sessionId,
      messages: [],
      metadata: {
        userId,
        createdAt: new Date(),
        lastActivity: new Date()
      }
    });
    return sessionId;
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.messages.push(message);
    session.metadata.lastActivity = new Date();

    // Persist to database
    await db.sessions.update(sessionId, session);
  }

  getHistory(sessionId: string): Message[] {
    return this.sessions.get(sessionId)?.messages || [];
  }
}
```

---

## Quick Reference

| Pattern | Use Case | Cost | Complexity |
|---------|----------|------|------------|
| Function Calling | Tool execution, structured actions | Medium | Medium |
| Streaming | Real-time UX, long responses | Same | Low |
| Context Compression | Long conversations | High (extra LLM call) | Medium |
| Prompt Caching | Repeated context (RAG, codebase) | Very Low (90% savings) | Low |
| Semantic Caching | Similar queries | Very Low | Medium |
| Retries | Rate limits, transient errors | Variable | Low |
| Fallback Models | Reliability | Variable | Low |

---

**Reference these patterns when building LLM-powered coding tools.**
