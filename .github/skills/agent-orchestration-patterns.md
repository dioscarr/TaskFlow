# Agent Orchestration Patterns

Patterns for coordinating multiple AI agents, task decomposition, and workflow automation. Use this for building complex multi-agent systems.

---

## 1. Agent Architectures

### Single-Agent Loop (ReAct)
```
User Request → Agent
                ↓
         ┌──────────────┐
         │  Reasoning   │ (What should I do?)
         └──────┬───────┘
                ↓
         ┌──────────────┐
         │    Action    │ (Use tool, generate code)
         └──────┬───────┘
                ↓
         ┌──────────────┐
         │ Observation  │ (Result of action)
         └──────┬───────┘
                ↓
         Goal achieved?
         ├─ No → Loop back to Reasoning
         └─ Yes → Return final result
```

### Multi-Agent Hierarchical
```
       ┌─────────────────┐
       │  Orchestrator   │
       │   (GPT-4)       │
       └────────┬────────┘
                │
      ┌─────────┼─────────┬─────────┐
      ↓         ↓         ↓         ↓
  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
  │Planner│ │Research│ │Coding │ │Testing│
  │ Agent │ │ Agent  │ │ Agent │ │ Agent │
  └───────┘ └───────┘ └───────┘ └───────┘
```

### Multi-Agent Collaborative
```
  User Task
      ↓
  ┌───────────┐
  │ Agent Pool │
  └─────┬──────┘
        │
    ┌───┴───┬───────┬────────┐
    ↓       ↓       ↓        ↓
 Agent1  Agent2  Agent3  Agent4
    │       │       │        │
    └───┬───┴───┬───┴────┬───┘
        ↓       ↓        ↓
    Shared Message Bus
    (Results, Decisions)
```

---

## 2. Task Decomposition

### Automatic Task Breakdown
```typescript
interface Task {
  description: string;
  subtasks?: Task[];
  assignedAgent?: string;
  status: 'pending' | 'in_progress' | 'completed';
}

async function decomposeTask(task: string): Promise<Task[]> {
  const prompt = `Break down this task into independent subtasks:

Task: ${task}

Return as JSON array:
[
  {"description": "subtask 1", "estimatedComplexity": "low"},
  {"description": "subtask 2", "estimatedComplexity": "medium"}
]`;

  const response = await llm.generate(prompt, { temperature: 0.3 });
  const subtasks = JSON.parse(response);

  return subtasks.map(st => ({
    description: st.description,
    status: 'pending'
  }));
}

// Example
const task = "Build a user authentication system";
const subtasks = await decomposeTask(task);
// Result:
// [
//   { description: "Design database schema for users", status: "pending" },
//   { description: "Implement password hashing", status: "pending" },
//   { description: "Create login API endpoint", status: "pending" },
//   { description: "Add JWT token generation", status: "pending" },
//   { description: "Write integration tests", status: "pending" }
// ]
```

### Dependency Resolution
```typescript
interface TaskWithDeps extends Task {
  dependencies: string[];  // IDs of tasks that must complete first
}

function topologicalSort(tasks: TaskWithDeps[]): TaskWithDeps[] {
  const sorted: TaskWithDeps[] = [];
  const visited = new Set<string>();

  function visit(task: TaskWithDeps) {
    if (visited.has(task.description)) return;

    // Visit dependencies first
    for (const depId of task.dependencies) {
      const depTask = tasks.find(t => t.description === depId);
      if (depTask) visit(depTask);
    }

    visited.add(task.description);
    sorted.push(task);
  }

  for (const task of tasks) {
    visit(task);
  }

  return sorted;
}

// Execute tasks in dependency order
const orderedTasks = topologicalSort(tasksWithDeps);
for (const task of orderedTasks) {
  await executeTask(task);
}
```

---

## 3. Agent Communication Patterns

### Message Passing
```typescript
interface Message {
  from: string;
  to: string;
  type: 'request' | 'response' | 'broadcast';
  payload: any;
  timestamp: Date;
}

class MessageBus {
  private subscribers: Map<string, ((msg: Message) => void)[]> = new Map();

  subscribe(agentId: string, handler: (msg: Message) => void) {
    if (!this.subscribers.has(agentId)) {
      this.subscribers.set(agentId, []);
    }
    this.subscribers.get(agentId)!.push(handler);
  }

  async publish(message: Message) {
    if (message.type === 'broadcast') {
      // Send to all agents
      for (const [agentId, handlers] of this.subscribers) {
        for (const handler of handlers) {
          handler(message);
        }
      }
    } else {
      // Send to specific agent
      const handlers = this.subscribers.get(message.to) || [];
      for (const handler of handlers) {
        handler(message);
      }
    }
  }
}

// Usage
const messageBus = new MessageBus();

// Agent 1: Research Agent
messageBus.subscribe('research-agent', async (msg) => {
  if (msg.type === 'request' && msg.payload.action === 'search') {
    const results = await searchCodebase(msg.payload.query);
    messageBus.publish({
      from: 'research-agent',
      to: msg.from,
      type: 'response',
      payload: { results },
      timestamp: new Date()
    });
  }
});

// Agent 2: Coding Agent requests research
messageBus.publish({
  from: 'coding-agent',
  to: 'research-agent',
  type: 'request',
  payload: { action: 'search', query: 'authentication patterns' },
  timestamp: new Date()
});
```

### Shared State
```typescript
class SharedState {
  private state: Map<string, any> = new Map();
  private listeners: Map<string, ((value: any) => void)[]> = new Map();

  set(key: string, value: any) {
    this.state.set(key, value);

    // Notify listeners
    const callbacks = this.listeners.get(key) || [];
    callbacks.forEach(cb => cb(value));
  }

  get(key: string): any {
    return this.state.get(key);
  }

  watch(key: string, callback: (value: any) => void) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key)!.push(callback);
  }
}

// Usage
const sharedState = new SharedState();

// Agent 1: Writes to state
sharedState.set('codebase_analysis', {
  files: 150,
  functions: 450,
  complexity: 'medium'
});

// Agent 2: Watches for updates
sharedState.watch('codebase_analysis', (analysis) => {
  console.log('Codebase analysis updated:', analysis);
  // Adjust strategy based on new information
});
```

---

## 4. Orchestration Strategies

### Sequential Execution
```typescript
async function sequentialWorkflow(tasks: Task[]): Promise<Result[]> {
  const results: Result[] = [];

  for (const task of tasks) {
    const agent = selectAgentForTask(task);
    const result = await agent.execute(task);
    results.push(result);

    // Each task can use results from previous tasks
    if (tasks[tasks.indexOf(task) + 1]) {
      tasks[tasks.indexOf(task) + 1].context = result;
    }
  }

  return results;
}
```

### Parallel Execution
```typescript
async function parallelWorkflow(tasks: Task[]): Promise<Result[]> {
  // Execute all independent tasks concurrently
  const promises = tasks.map(task => {
    const agent = selectAgentForTask(task);
    return agent.execute(task);
  });

  return await Promise.all(promises);
}
```

### Dynamic Workflow
```typescript
async function dynamicWorkflow(initialTask: Task): Promise<Result> {
  const taskQueue = [initialTask];
  const completedTasks: Task[] = [];

  while (taskQueue.length > 0) {
    const task = taskQueue.shift()!;
    const agent = selectAgentForTask(task);
    const result = await agent.execute(task);

    completedTasks.push(task);

    // Agent can generate new tasks based on results
    if (result.nextTasks) {
      taskQueue.push(...result.nextTasks);
    }

    // Check if goal achieved
    if (await isGoalAchieved(completedTasks)) {
      return synthesizeResults(completedTasks);
    }
  }

  throw new Error('Workflow completed without achieving goal');
}
```

---

## 5. Agent Selection & Routing

### Capability-Based Routing
```typescript
interface AgentCapability {
  name: string;
  taskTypes: string[];
  costPerTask: number;
  avgLatency: number;
  reliability: number;
}

const agents: AgentCapability[] = [
  {
    name: 'fast-coder',
    taskTypes: ['code_generation', 'simple_refactor'],
    costPerTask: 0.01,
    avgLatency: 2000,
    reliability: 0.85
  },
  {
    name: 'expert-coder',
    taskTypes: ['complex_refactor', 'architecture_design'],
    costPerTask: 0.10,
    avgLatency: 10000,
    reliability: 0.98
  },
  {
    name: 'researcher',
    taskTypes: ['code_search', 'documentation'],
    costPerTask: 0.02,
    avgLatency: 3000,
    reliability: 0.92
  }
];

function selectAgent(task: Task, priority: 'cost' | 'speed' | 'quality'): AgentCapability {
  // Filter agents that can handle this task type
  const capable = agents.filter(a => a.taskTypes.includes(task.type));

  if (priority === 'cost') {
    return capable.sort((a, b) => a.costPerTask - b.costPerTask)[0];
  } else if (priority === 'speed') {
    return capable.sort((a, b) => a.avgLatency - b.avgLatency)[0];
  } else {  // quality
    return capable.sort((a, b) => b.reliability - a.reliability)[0];
  }
}
```

### Load Balancing
```typescript
class AgentPool {
  private agents: Agent[] = [];
  private activeTaskCounts: Map<string, number> = new Map();

  addAgent(agent: Agent) {
    this.agents.push(agent);
    this.activeTaskCounts.set(agent.id, 0);
  }

  async execute(task: Task): Promise<Result> {
    // Select least busy agent
    const agent = this.agents.reduce((least, current) => {
      const leastCount = this.activeTaskCounts.get(least.id) || 0;
      const currentCount = this.activeTaskCounts.get(current.id) || 0;
      return currentCount < leastCount ? current : least;
    });

    this.activeTaskCounts.set(agent.id, (this.activeTaskCounts.get(agent.id) || 0) + 1);

    try {
      const result = await agent.execute(task);
      return result;
    } finally {
      this.activeTaskCounts.set(agent.id, (this.activeTaskCounts.get(agent.id) || 0) - 1);
    }
  }
}
```

---

## 6. Error Handling & Recovery

### Retry with Different Agent
```typescript
async function executeWithFallback(task: Task, agents: Agent[]): Promise<Result> {
  for (const agent of agents) {
    try {
      return await agent.execute(task);
    } catch (error) {
      console.warn(`Agent ${agent.name} failed, trying next...`);
      continue;
    }
  }

  throw new Error('All agents failed to complete task');
}
```

### Task Reassignment
```typescript
class ResilientOrchestrator {
  private failureCount: Map<string, number> = new Map();

  async execute(task: Task, assignedAgent: Agent): Promise<Result> {
    try {
      const result = await assignedAgent.execute(task);
      this.failureCount.set(assignedAgent.id, 0);  // Reset on success
      return result;
    } catch (error) {
      const failures = (this.failureCount.get(assignedAgent.id) || 0) + 1;
      this.failureCount.set(assignedAgent.id, failures);

      if (failures >= 3) {
        // Agent struggling, reassign to different agent
        const alternativeAgent = this.selectAlternativeAgent(task, assignedAgent);
        return await this.execute(task, alternativeAgent);
      }

      throw error;
    }
  }
}
```

---

## 7. Monitoring & Observability

### Execution Tracing
```typescript
interface ExecutionTrace {
  taskId: string;
  agentId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

class ExecutionTracer {
  private traces: ExecutionTrace[] = [];

  startTrace(taskId: string, agentId: string): ExecutionTrace {
    const trace: ExecutionTrace = {
      taskId,
      agentId,
      startTime: new Date(),
      status: 'running'
    };
    this.traces.push(trace);
    return trace;
  }

  endTrace(taskId: string, result: any) {
    const trace = this.traces.find(t => t.taskId === taskId);
    if (trace) {
      trace.endTime = new Date();
      trace.status = 'completed';
      trace.result = result;
    }
  }

  failTrace(taskId: string, error: string) {
    const trace = this.traces.find(t => t.taskId === taskId);
    if (trace) {
      trace.endTime = new Date();
      trace.status = 'failed';
      trace.error = error;
    }
  }

  getMetrics() {
    return {
      totalTasks: this.traces.length,
      completed: this.traces.filter(t => t.status === 'completed').length,
      failed: this.traces.filter(t => t.status === 'failed').length,
      avgDuration: this.calculateAvgDuration()
    };
  }
}
```

---

## 8. Real-World Patterns

### Code Review Multi-Agent System
```typescript
async function codeReviewWorkflow(pullRequest: PullRequest): Promise<ReviewResult> {
  // 1. Security Agent scans for vulnerabilities
  const securityIssues = await securityAgent.execute({
    type: 'security_scan',
    code: pullRequest.diff
  });

  // 2. Style Agent checks conventions
  const styleIssues = await styleAgent.execute({
    type: 'style_check',
    code: pullRequest.diff
  });

  // 3. Logic Agent reviews complexity and logic
  const logicReview = await logicAgent.execute({
    type: 'logic_review',
    code: pullRequest.diff,
    context: pullRequest.description
  });

  // 4. Test Agent verifies test coverage
  const testCoverage = await testAgent.execute({
    type: 'coverage_check',
    code: pullRequest.diff
  });

  // 5. Summary Agent synthesizes all reviews
  const summary = await summaryAgent.execute({
    type: 'summarize_reviews',
    inputs: { securityIssues, styleIssues, logicReview, testCoverage }
  });

  return {
    approved: securityIssues.length === 0 && styleIssues.length === 0,
    reviews: { securityIssues, styleIssues, logicReview, testCoverage },
    summary
  };
}
```

### Bug Fix Multi-Agent System
```typescript
async function bugFixWorkflow(bug: BugReport): Promise<Fix> {
  // 1. Diagnosis Agent identifies root cause
  const diagnosis = await diagnosisAgent.execute({
    type: 'diagnose',
    errorMessage: bug.error,
    stackTrace: bug.stackTrace,
    code: bug.relatedCode
  });

  // 2. Search Agent finds similar bugs
  const similarBugs = await searchAgent.execute({
    type: 'find_similar',
    query: diagnosis.rootCause
  });

  // 3. Fix Agent generates patch
  const fix = await fixAgent.execute({
    type: 'generate_fix',
    diagnosis,
    similarFixes: similarBugs.map(b => b.fix),
    code: bug.relatedCode
  });

  // 4. Test Agent validates fix
  const testResult = await testAgent.execute({
    type: 'test_fix',
    originalCode: bug.relatedCode,
    fixedCode: fix.code,
    testCases: bug.reproducibilitySteps
  });

  if (!testResult.passed) {
    // Retry with feedback
    return await bugFixWorkflow({
      ...bug,
      additionalContext: testResult.failures
    });
  }

  return fix;
}
```

---

## Quick Reference

| Pattern | Use Case | Complexity | Best For |
|---------|----------|------------|----------|
| Sequential | Linear workflows | Low | Step-by-step processes |
| Parallel | Independent tasks | Low | Speed optimization |
| Hierarchical | Complex projects | High | Enterprise systems |
| Message Bus | Loose coupling | Medium | Distributed agents |
| Shared State | Collaborative work | Medium | Real-time coordination |
| Capability-Based | Specialized agents | Medium | Heterogeneous tasks |

---

**Use these patterns to build sophisticated multi-agent systems for complex coding tasks.**
