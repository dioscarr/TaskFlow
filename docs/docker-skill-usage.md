# Docker DevOps Expert Skill - Usage Guide

## Overview

The **Docker DevOps Expert** skill encapsulates comprehensive knowledge and best practices for Docker development workflows. It can be invoked in any AI conversation to get expert assistance with containerization, performance optimization, security hardening, and debugging.

---

## Installation

### 1. Import the Skill into Database

Run the import script:

```bash
npx tsx scripts/import-docker-skill.ts
```

Expected output:
```
🐳 Importing Docker DevOps Expert Skill...

Creating new skill: "Docker DevOps Expert"...

✅ Skill created successfully! (ID: abc123...)

📋 Skill Details:
   Name: Docker DevOps Expert
   Category: custom
   Capabilities: 12 features
   Tags: docker, containers, devops, hot-reload, security, performance...
   Handler: .github/agents/DockerDevOps.agent.md
   Enabled: ✅ Yes
```

### 2. Verify Installation

Check that the skill exists:

```sql
-- Query the database
SELECT id, name, enabled, category
FROM "Skill"
WHERE name = 'Docker DevOps Expert';
```

Or use the AI assistant:
```
User: "List all available skills"
AI: Shows Docker DevOps Expert in the list
```

---

## Usage in Conversations

### Invoking the Skill

Simply mention Docker-related tasks in a conversation, and the skill will be automatically activated. You can also explicitly invoke it:

**Automatic Activation:**
```
User: "I need to improve my Docker development workflow"
AI: [Activates Docker DevOps Expert skill automatically]
```

**Explicit Invocation:**
```
User: "Use the Docker DevOps Expert skill to help me set up hot reload"
AI: [Explicitly invokes the skill with context]
```

---

## Common Use Cases

### 1. Optimize Container Lifecycle

**Problem:** Containers being recreated on every start (slow, wasteful)

**Invocation:**
```
User: "My Docker containers take 30 seconds to start every time. Can you help?"
```

**What the Skill Does:**
1. Analyzes current setup (reads Dockerfile, docker-compose.yml)
2. Identifies issue (no state checking, always docker run)
3. Implements `startOrCreateContainer()` function
4. Shows performance improvement (30s → <1s)

**Deliverables:**
- Idempotent container start function
- Updated processActions.ts
- CLI helper script
- Documentation

---

### 2. Set Up Hot Reload

**Problem:** Need to rebuild container for every code change

**Invocation:**
```
User: "I want instant hot reload when I edit my React code in Docker"
```

**What the Skill Does:**
1. Configures Docker Compose Watch in docker-compose.yml
2. Sets up volume mounting strategy (bind mounts + named volumes)
3. Adds Vite HMR environment variables
4. Creates helper scripts for easy usage

**Deliverables:**
- docker-compose.yml with `develop.watch` section
- Updated Dockerfile.dev
- npm scripts for development
- Performance benchmarks (1-2s reload time)

---

### 3. Implement Live Log Streaming

**Problem:** No easy way to view container logs in real-time

**Invocation:**
```
User: "I need a live log viewer for my Docker containers in the UI"
```

**What the Skill Does:**
1. Creates SSE streaming API endpoint
2. Builds React component with live logs
3. Integrates logs button into VibeFileExplorer
4. Adds filtering, search, and auto-scroll

**Deliverables:**
- `/api/docker/logs-stream/route.ts`
- `ContainerLogs.tsx` component
- UI integration in VibeFileExplorer
- Usage documentation

---

### 4. Security Hardening

**Problem:** Security audit found command injection vulnerabilities

**Invocation:**
```
User: "Audit my Docker setup for security issues and fix any problems"
```

**What the Skill Does:**
1. Scans code for command injection risks
2. Audits Dockerfiles for root user issues
3. Fixes vulnerabilities (array args, non-root users)
4. Adds health checks and resource limits

**Deliverables:**
- Updated `dockerExec()` function with array args
- Hardened Dockerfiles with non-root users
- Health checks added to docker-compose.yml
- Security report with CVSS scores

---

### 5. Performance Optimization

**Problem:** Slow builds, poor volume performance

**Invocation:**
```
User: "My Docker builds are very slow. How can I speed them up?"
```

**What the Skill Does:**
1. Analyzes Dockerfile layer structure
2. Implements multi-stage builds
3. Configures named volumes for node_modules
4. Adds build caching directives

**Deliverables:**
- Optimized Dockerfile with layer caching
- docker-compose.yml with named volumes
- Build metrics tracking
- Performance comparison (before/after)

---

### 6. Debugging Container Issues

**Problem:** Container failing to start, errors unclear

**Invocation:**
```
User: "My container keeps exiting with code 1. How do I debug this?"
```

**What the Skill Does:**
1. Inspects container state and logs
2. Diagnoses common issues (missing deps, port conflicts, etc.)
3. Provides actionable error messages
4. Suggests fixes with code examples

**Deliverables:**
- Detailed error diagnosis
- Step-by-step debugging guide
- Fixed configuration
- Testing instructions

---

## Skill Capabilities

### Core Features

1. **Idempotent Container Lifecycle:**
   - Smart start logic (check state first)
   - Reuse existing containers
   - Auto-restart on crash

2. **Hot Reload Systems:**
   - Docker Compose Watch configuration
   - Volume mounting optimization
   - File sync patterns

3. **Live Log Streaming:**
   - Server-Sent Events API
   - Real-time log viewing UI
   - Filtering and search

4. **Security Hardening:**
   - Command injection prevention
   - Non-root container configuration
   - Health checks and resource limits

5. **Performance Optimization:**
   - Build layer caching
   - Named volume strategy
   - Multi-stage builds

6. **Debugging & Troubleshooting:**
   - Container state inspection
   - Error diagnosis
   - Actionable solutions

---

## Example Conversations

### Conversation 1: Complete Setup

```
User: "I have a React+Vite app in apps/my-app. Help me set up a
      production-grade Docker development workflow."

AI: [Activates Docker DevOps Expert skill]

AI: "I'll set up a modern Docker workflow for your React+Vite app. This will include:

    1. Idempotent container management (instant restarts)
    2. Hot reload with Docker Compose Watch (1-2s for code changes)
    3. Live log streaming with beautiful UI
    4. Security hardening (non-root user, health checks)
    5. Performance optimization (named volumes, build caching)

    Let me start by analyzing your current setup..."

[Skill reads existing files, creates new configurations]

AI: "✅ Complete! Here's what I've implemented:

    Files Created:
    - apps/my-app/Dockerfile.dev (optimized, non-root user)
    - docker-compose.app.yml (with Watch)
    - src/lib/processActionsCore.ts (idempotent functions)
    - src/app/api/docker/logs-stream/route.ts (live logs)
    - src/components/ContainerLogs.tsx (log viewer)
    - scripts/docker-dev.mjs (CLI helper)

    Performance Improvements:
    - Container start: 30s → <1s (if already running)
    - Code changes: 30s rebuild → 1-2s hot reload
    - Dependency changes: Optimized with caching

    Try it now:
    npm run docker:dev my-app

    Documentation created in docs/docker-modern-workflow.md"
```

---

### Conversation 2: Quick Fix

```
User: "I'm getting 'container already exists' errors when starting my app"

AI: [Activates Docker DevOps Expert skill]

AI: "This is a common issue when using 'docker run' without checking if the
    container already exists. I'll implement an idempotent start function that:

    1. Checks if container is running → uses it immediately
    2. Checks if container is stopped → restarts it
    3. Only creates new container if missing

    [Creates startOrCreateContainer() function]

    ✅ Fixed! The function now handles all three states intelligently.

    Result:
    - No more 'already exists' errors
    - 30x faster when container is already running
    - Automatically restarts stopped containers"
```

---

### Conversation 3: Learning Mode

```
User: "Why do you use named volumes for node_modules instead of bind mounts?"

AI: [References Docker DevOps Expert knowledge base]

AI: "Great question! Named volumes for node_modules provide:

    1. **Performance (10-100x faster):**
       - Bind mount: Thousands of small files synced to host (slow I/O)
       - Named volume: Files stay in Docker-managed storage (fast)

    2. **Platform Compatibility:**
       - Bind mount: Linux binaries sync to Windows/macOS host (breaks)
       - Named volume: Binaries built in container, stay in container

    3. **Isolation:**
       - Each container gets its own dependency installation
       - No conflicts between different app versions

    Visual comparison:

    Bind Mount (❌ Slow):
    Host: apps/my-app/node_modules (15,000 files)
           ↕️ Constant sync overhead
    Container: /app/node_modules (15,000 files)

    Named Volume (✅ Fast):
    Host: (not visible)
    Container: /app/node_modules (managed by Docker)

    For source code (src/), we DO use bind mounts because we want:
    - Direct file access for hot reload
    - Ability to edit files on host

    Strategy:
    - src/ → Bind mount (for hot reload)
    - node_modules/ → Named volume (for speed)
    - .vite/ cache → Named volume (for speed)"
```

---

## Knowledge Persistence

The skill maintains knowledge across conversations through:

### 1. Agent File
**Location:** `.github/agents/DockerDevOps.agent.md`

**Contains:**
- Complete persona and communication style
- Implementation patterns (code templates)
- Troubleshooting procedures
- Industry standards and benchmarks
- Task templates and workflows

### 2. Skill Definition
**Location:** `.github/skills/docker-devops-expert.json`

**Contains:**
- Structured capability list
- Workflow steps
- Example usage scenarios
- Knowledge base (common issues, solutions)
- Function schema for invocation

### 3. Code Templates
**Locations:**
- `src/lib/processActionsCore.ts` - Idempotent functions
- `src/app/api/docker/logs-stream/route.ts` - Live logging
- `docker-compose.app.yml` - Watch configuration
- `Dockerfile.dev.template` - Optimized template

---

## Extending the Skill

### Adding New Capabilities

1. **Update Agent File:**
   Edit `.github/agents/DockerDevOps.agent.md` with new knowledge

2. **Update Skill Definition:**
   Add to `capabilities` array in `.github/skills/docker-devops-expert.json`

3. **Re-import:**
   ```bash
   npx tsx scripts/import-docker-skill.ts
   ```

### Example: Adding Kubernetes Support

```json
// In docker-devops-expert.json
"capabilities": [
  // ... existing capabilities ...
  "Kubernetes manifest generation from Docker Compose",
  "Helm chart creation for containerized apps",
  "Kubernetes development with Tilt/Skaffold"
]
```

Then update the agent file with Kubernetes knowledge.

---

## Troubleshooting

### Skill Not Activating

**Symptom:** AI doesn't use Docker expertise even when asked about Docker

**Solutions:**
1. Check skill is enabled in database:
   ```sql
   SELECT * FROM "Skill" WHERE name = 'Docker DevOps Expert';
   ```

2. Explicitly mention the skill:
   ```
   User: "Use the Docker DevOps Expert skill to help me..."
   ```

3. Re-import the skill:
   ```bash
   npx tsx scripts/import-docker-skill.ts
   ```

### Outdated Knowledge

**Symptom:** Skill gives outdated recommendations

**Solution:** Update agent file and re-import:
```bash
# 1. Edit .github/agents/DockerDevOps.agent.md
# 2. Re-import
npx tsx scripts/import-docker-skill.ts
```

---

## Best Practices

### When to Use This Skill

✅ **Use for:**
- Setting up Docker development workflows
- Optimizing container performance
- Debugging container issues
- Security audits and hardening
- Learning Docker best practices

❌ **Don't use for:**
- Production deployment (use proper orchestration)
- Docker Swarm (skill focuses on development)
- Basic Docker education (skill assumes some familiarity)

### Getting the Most Out of the Skill

1. **Be Specific:**
   ```
   ✅ "Set up hot reload for my React app with 1-2s response time"
   ❌ "Make Docker faster"
   ```

2. **Provide Context:**
   ```
   ✅ "I'm on Windows with WSL2, using Vite, and builds take 45s"
   ❌ "Docker is slow"
   ```

3. **Ask for Explanations:**
   ```
   ✅ "Why use named volumes instead of bind mounts for node_modules?"
   ✅ "Explain the idempotent container start pattern"
   ```

---

## Integration with Other Skills

The Docker DevOps Expert skill works well with:

- **File Management Skills:** For reading/writing Dockerfiles
- **Git Skills:** For committing Docker configuration changes
- **Testing Skills:** For validating Docker setups
- **Documentation Skills:** For creating Docker guides

---

## Version History

**v1.0 (Current):**
- ✅ Idempotent container lifecycle
- ✅ Docker Compose Watch integration
- ✅ Live log streaming
- ✅ Security hardening patterns
- ✅ Performance optimization strategies
- ✅ Comprehensive documentation

**Future Enhancements:**
- Kubernetes migration support
- Multi-container orchestration
- Advanced networking patterns
- CI/CD pipeline integration

---

## Quick Reference

### Import Skill
```bash
npx tsx scripts/import-docker-skill.ts
```

### Use in Conversation
```
User: "Help me optimize my Docker workflow"
User: "Set up hot reload for my app"
User: "Debug why my container keeps crashing"
```

### Files
- Agent: `.github/agents/DockerDevOps.agent.md`
- Skill: `.github/skills/docker-devops-expert.json`
- Import: `scripts/import-docker-skill.ts`

---

**The Docker DevOps Expert skill brings production-grade Docker knowledge to every conversation!** 🐳🚀
