# 🚀 TaskFlow Interactive Shell

A premium, bash-like CLI for commanding the Omni-Agent Army directly from your terminal.

## ✨ Features

- **Interactive REPL**: Bash/PowerShell-style prompt with command history and auto-completion
- **Agent Control**: Deploy agents, track jobs, and monitor execution in real-time
- **Workflow Management**: Execute workflows like `/scaffold-vite` directly from the CLI
- **Database Access**: Run raw SQL queries and inspect data
- **App Management**: List, scaffold, and manage apps in the `apps/` folder
- **Rich Terminal UI**: Colored output, tables, spinners, and progress indicators

## 🎯 Quick Start

### Installation

First, install the required dependencies:

```bash
npm install chalk ora cli-table3 @types/cli-table3 --save
```

### Launch the Shell

```bash
npm run shell
```

You'll see:

```
╔════════════════════════════════════════════╗
║   TaskFlow Interactive Shell v1.0          ║
║   Omni-Agent Army Command Center          ║
╚════════════════════════════════════════════╝

Type "help" for available commands

TaskFlow>
```

## 📋 Available Commands

### Agent Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `agent` | Deploy an agent to execute a task | `agent <objective>` |
| `jobs` | List all agent jobs | `jobs [--status <status>] [--limit <n>]` |
| `job` | Get details of a specific job | `job <job-id>` |

**Examples:**

```bash
TaskFlow> agent create a landing page for my SaaS product
✔ Agent deployed! Job ID: cml64p5mk000q8z0gqwmhozhy
Track progress with: job cml64p5mk000q8z0gqwmhozhy

TaskFlow> jobs
┌────────────────────────────────┬───────────────┬────────────┬──────────────────────┬──────────┐
│ ID                             │ Type          │ Status     │ Created              │ Duration │
├────────────────────────────────┼───────────────┼────────────┼──────────────────────┼──────────┤
│ cml64p5mk000q8z0gqwmhozhy      │ chat_task     │ succeeded  │ 2/2/2026, 9:00:00 PM │ 45s      │
└────────────────────────────────┴───────────────┴────────────┴──────────────────────┴──────────┘

TaskFlow> job cml64p5mk000q8z0gqwmhozhy
📋 Job Details

ID: cml64p5mk000q8z0gqwmhozhy
Type: chat_task
Status: succeeded
Created: 2/2/2026, 9:00:00 PM
Finished: 2/2/2026, 9:00:45 PM
Result: { finalOutput: "Landing page created successfully!" }
```

### Workflow Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `workflows` | List available workflows | `workflows` |
| `workflow` | Execute a workflow | `workflow <name> [args...]` |

**Examples:**

```bash
TaskFlow> workflows
📂 Available Workflows

  /scaffold-vite
  /scaffold-remix
  /landing
  /blueprint-workflow

TaskFlow> workflow scaffold-vite my-new-app
Executing workflow: scaffold-vite
Args: my-new-app
```

### App Management

| Command | Description | Usage |
|---------|-------------|-------|
| `apps` | List all apps in the apps/ folder | `apps` |
| `scaffold` | Scaffold a new Vite app | `scaffold <project-name>` |

**Examples:**

```bash
TaskFlow> apps
📱 Apps (13)

  • another-app
  • call
  • command
  • crm-app
  • dinner-recipes
  • my-restaurant-app
  • salon-premium
  • scaffold-vite
  • test-app-2

TaskFlow> scaffold youtube-transcriber
✔ Scaffolded youtube-transcriber successfully!
Location: apps/youtube-transcriber
```

### Database Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `db` | Execute raw SQL query | `db <query>` |
| `users` | List all users | `users` |

**Examples:**

```bash
TaskFlow> users
┌────────────────────────────────┬─────────────────────┬──────────┬────────────┐
│ ID                             │ Email               │ Name     │ Created    │
├────────────────────────────────┼─────────────────────┼──────────┼────────────┤
│ cml1vgltz00008zh0x2feeuvt      │ demo@example.com    │ Demo     │ 1/15/2026  │
└────────────────────────────────┴─────────────────────┴──────────┴────────────┘

TaskFlow> db SELECT COUNT(*) FROM "AgentJob"
[
  { "count": 42 }
]
```

### System Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `status` | Show system status | `status` |
| `clear` | Clear the terminal | `clear` |
| `help` | Show available commands | `help [command]` |
| `exit` | Exit the shell | `exit` |

**Examples:**

```bash
TaskFlow> status
⚡ TaskFlow System Status

Users: 1
Total Jobs: 42
Running Jobs: 2
Omni-Agent Army: OPERATIONAL

TaskFlow> help agent
agent

Description: Deploy an agent to execute a task
Usage: agent <objective>
```

## 🎨 Features in Detail

### Command History

Use **Up/Down arrow keys** to navigate through command history, just like bash.

### Auto-Completion

Press **Tab** to auto-complete command names.

### Colored Output

- ✅ **Green**: Success messages
- ❌ **Red**: Error messages
- ⚠️ **Yellow**: Warnings
- ℹ️ **Cyan**: Info and headers
- 🔍 **Gray**: Secondary information

### Spinners & Progress

Long-running commands show animated spinners:

```
⠋ Deploying agent for: create a landing page...
✔ Agent deployed! Job ID: cml64p5mk000q8z0gqwmhozhy
```

### Tables

Results are displayed in beautiful ASCII tables for easy reading.

## 🔧 Advanced Usage

### Chaining Commands

You can run multiple commands in sequence:

```bash
TaskFlow> scaffold my-app
TaskFlow> apps
TaskFlow> agent add authentication to my-app
```

### Querying Job Status

Monitor a long-running job:

```bash
TaskFlow> agent build a full-stack e-commerce app
✔ Agent deployed! Job ID: abc123

# Wait a bit...

TaskFlow> job abc123
📋 Job Details
Status: running
...

# Check again later

TaskFlow> job abc123
📋 Job Details
Status: succeeded
Result: { finalOutput: "E-commerce app created successfully!" }
```

### Database Queries

Run complex SQL queries:

```bash
TaskFlow> db SELECT type, COUNT(*) as count FROM "AgentJob" GROUP BY type
[
  { "type": "chat_task", "count": 35 },
  { "type": "workflow", "count": 7 }
]
```

## 🚀 Power User Tips

1. **Use `status` frequently** to monitor system health
2. **Check `jobs` to see what the agents are working on**
3. **Use `workflow` instead of manual commands** for common tasks
4. **Leverage `db` for quick data inspection** without opening a DB client
5. **Use `help <command>` to learn command syntax**

## 🛠️ Troubleshooting

### Command Not Found

If you see "Unknown command", type `help` to see all available commands.

### Database Errors

Ensure your Prisma database is properly set up:

```bash
npm run db:migrate
```

### Agent Not Responding

Check if the agent worker is running:

```bash
npm run agent:start
```

## 🎯 Roadmap

- [ ] **Natural Language Commands**: "create a landing page" instead of `agent create a landing page`
- [ ] **Workflow Execution**: Full workflow support with parameter passing
- [ ] **File System Operations**: `ls`, `cd`, `cat` commands for file navigation
- [ ] **Real-Time Logs**: Stream agent logs directly to the shell
- [ ] **Batch Operations**: Execute multiple commands from a script file
- [ ] **SSH-like Remote Control**: Connect to remote TaskFlow instances

## 📚 Related Documentation

- [Omni-Agent Army Architecture](../OMNI_AGENT_ARMY.md)
- [Workflow System](../.agent/workflows/)
- [Agent Worker](./agent-worker.ts)

---

**Built with ❤️ by the Omni-Agent Army**
