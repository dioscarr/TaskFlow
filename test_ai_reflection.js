/**
 * AI Self-Reflection Test Script
 * 
 * This script tests the AI's thinking process and tool handling
 * by calling the chatWithAI function directly.
 */

const { execSync } = require('child_process');
const path = require('path');

// Test prompts for self-reflection
const testPrompts = [
    {
        name: "Self Analysis",
        query: "Analyze yourself. What are your capabilities? What tools do you have? Show your thinking.",
        expectedBehavior: [
            "Should display thinking process",
            "Should list available tools/skills",
            "Should explain its operational rules"
        ]
    },
    {
        name: "Tool Discovery",
        query: "What tools are available to you? List them all with descriptions.",
        expectedBehavior: [
            "Should enumerate tools from TOOL_LIBRARY",
            "Should show thinking about how to answer"
        ]
    },
    {
        name: "Simple Task",
        query: "Create a simple markdown file called 'test-reflection.md' with a summary of your capabilities.",
        expectedBehavior: [
            "Should think about how to approach the task",
            "Should use create_markdown_file or create_file tool",
            "Should NOT execute without approval (if not tool agent)"
        ]
    }
];

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    AI SELF-REFLECTION TEST                       ║
║                                                                  ║
║  This script will test the AI's thinking process and behavior   ║
╚══════════════════════════════════════════════════════════════════╝
`);

console.log(`
📋 Test Prompts Defined:

${testPrompts.map((t, i) => `${i + 1}. ${t.name}
   Query: "${t.query}"
   Expected:
   ${t.expectedBehavior.map(b => `   • ${b}`).join('\n')}`).join('\n\n')}

════════════════════════════════════════════════════════════════════

🔍 Areas to Observe:

1. THINKING PROCESS
   • Does the AI show <thinking> tags in its response?
   • Is the thinking logical and strategic?
   • Does it follow the "Prime Directive" operational rules?

2. TOOL HANDLING  
   • Does it identify the correct tool for the task?
   • Does it ask for approval before executing (if not tool agent)?
   • Does it explain WHY it chose a specific tool?

3. PRODUCTION QUALITY
   • Does it mention type safety, error handling, security?
   • Does it follow the execution workflow (Blueprint → Foundation → Implementation → Polish)?
   • Does it generate README files when creating projects?

════════════════════════════════════════════════════════════════════

📝 MANUAL TEST INSTRUCTIONS:

1. Open http://localhost:3000 in your browser
2. Open the AI Chat (look for chat icon)
3. Send each test prompt above
4. Observe the response for:
   - Thinking process visibility
   - Tool selection accuracy
   - Approval workflow compliance
   - Response quality

5. Report findings here for tuning.

════════════════════════════════════════════════════════════════════

⚙️ CURRENT CONFIGURATION:

Checking agent configuration files...
`);

// Check key configuration files
const filesToCheck = [
    { path: 'src/lib/agents/prompts.ts', desc: 'Agent Prompts Library' },
    { path: 'src/lib/toolLibrary.ts', desc: 'Tool Definitions' },
    { path: 'src/lib/skillsLibrary.ts', desc: 'Skills Definitions' },
    { path: 'src/app/actions.ts', desc: 'Server Actions (chatWithAI)' }
];

filesToCheck.forEach(file => {
    const fs = require('fs');
    const fullPath = path.join(process.cwd(), file.path);
    if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        console.log(`✓ ${file.desc}`);
        console.log(`  Path: ${file.path}`);
        console.log(`  Size: ${(stats.size / 1024).toFixed(1)}KB`);
    } else {
        console.log(`✗ ${file.desc} - NOT FOUND`);
    }
});

console.log(`
════════════════════════════════════════════════════════════════════

🎯 TUNING CHECKLIST:

After testing, consider adjusting:

□ If thinking is not visible:
  → Check ThinkingProcess component in AIChat.tsx
  → Verify THINKING PROTOCOL in system prompt
  → Ensure <thinking> tags are being extracted

□ If tools are not discovered:
  → Check TOOL_LIBRARY exports
  → Verify getToolSchemas function
  → Check skill/tool registration

□ If approval workflow is broken:
  → Verify isToolAgent flag logic
  → Check CONSULT FIRST rule in prompt
  → Review enqueue_agent_job tool

□ If response quality is low:
  → Extend SOFTWARE_ARCHITECT_PROMPT
  → Add more specific operational rules
  → Increase model temperature or tokens

════════════════════════════════════════════════════════════════════
`);
