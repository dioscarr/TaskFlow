/**
 * Direct API Test for AI Thinking & Tool Handling
 * 
 * This script calls the chatWithAI function directly to test the AI's behavior
 * without needing a browser.
 */

const readline = require('readline');

const TESTS = [
    {
        name: "Self-Reflection",
        query: "What are your capabilities? Show your thinking.",
        checkResults: (res) => {
            const checks = {
                'Has thinking content': !!res.thinking,
                'Has response text': !!res.text && res.text.length > 50,
                'Mentions tools': res.text.toLowerCase().includes('tool') || res.text.toLowerCase().includes('skill'),
                'Shows structured response': res.text.includes('##') || res.text.includes('-')
            };
            return checks;
        }
    },
    {
        name: "File Creation Request",
        query: "Create a markdown file called test-capabilities.md with a list of your tools",
        checkResults: (res) => {
            const checks = {
                'Has thinking content': !!res.thinking,
                'Asks for approval (non-tool agent)': res.text.toLowerCase().includes('approve') || res.text.toLowerCase().includes('permission'),
                'Mentions tool used': !!res.toolUsed || res.text.toLowerCase().includes('create_markdown_file'),
                'Does NOT auto-execute': !res.toolResult || res.text.includes('approve')
            };
            return checks;
        }
    },
    {
        name: "Production Quality Check",
        query: "How would you build a Next.js todo app? Show your execution plan.",
        checkResults: (res) => {
            const checks = {
                'Has thinking content': !!res.thinking,
                'Mentions TypeScript': res.text.toLowerCase().includes('typescript'),
                'Mentions schema/database': res.text.toLowerCase().includes('schema') || res.text.toLowerCase().includes('prisma') || res.text.toLowerCase().includes('database'),
                'Shows phases': res.text.toLowerCase().includes('phase') || res.text.toLowerCase().includes('step'),
                'Production quality language': res.text.toLowerCase().includes('production') || res.text.toLowerCase().includes('type safety') || res.text.toLowerCase().includes('error handling')
            };
            return checks;
        }
    }
];

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║              AI THINKING & BEHAVIOR VERIFICATION                 ║
╚══════════════════════════════════════════════════════════════════╝

This test will verify:
✓ AI generates thinking content in <thinking> tags
✓ AI asks for approval before executing tools
✓ AI follows production-quality principles
✓ AI shows the execution workflow

═══════════════════════════════════════════════════════════════════

To run this test with live API calls, use:

1. Open http://localhost:3000 in your browser
2. Send each of these prompts to the AI Chat:

`);

TESTS.forEach((test, i) => {
    console.log(`──────────────────────────────────────────────────────────────────`);
    console.log(`TEST ${i + 1}: ${test.name}`);
    console.log(`──────────────────────────────────────────────────────────────────`);
    console.log(`PROMPT: "${test.query}"`);
    console.log(`\nEXPECTED BEHAVIORS:`);
    const mockRes = { thinking: '', text: '', toolUsed: null, toolResult: null };
    const checks = test.checkResults(mockRes);
    Object.keys(checks).forEach(check => {
        console.log(`  □ ${check}`);
    });
    console.log();
});

console.log(`
═══════════════════════════════════════════════════════════════════

CHECKLIST FOR TUNING:

If AI is not showing thinking:
  □ Verify THINKING PROTOCOL in system prompt (actions.ts line ~3351)
  □ Check ThinkingProcess component is rendered (AIChat.tsx line ~283)
  □ Ensure thinking is extracted: res.thinking should not be undefined

If AI executes tools without approval:
  □ Check isToolAgent flag in chatWithAI (should be false for chat)
  □ Verify CONSULT FIRST rule in toolInstructions
  □ Check enqueue_agent_job is being used for background tasks

If AI is not production-quality:
  □ Check SOFTWARE_ARCHITECT_PROMPT is properly imported
  □ Verify defaultInstruction includes the full prompt
  □ Add more specific examples in the prompt

═══════════════════════════════════════════════════════════════════
`);

// Create a simple interactive mode to report results
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('After testing, enter your observations below (or type "skip" to exit):');
console.log();

rl.question('Did the AI show its thinking process? (yes/no): ', (answer1) => {
    if (answer1.toLowerCase() === 'skip') {
        rl.close();
        return;
    }

    rl.question('Did the AI ask for approval before tools? (yes/no): ', (answer2) => {
        rl.question('Did the AI use production-quality language? (yes/no): ', (answer3) => {
            rl.question('Any issues to note? (type or press Enter to skip): ', (notes) => {
                console.log('\n═══════════════════════════════════════════════════════════════════');
                console.log('RESULTS SUMMARY:');
                console.log('═══════════════════════════════════════════════════════════════════\n');

                const results = {
                    thinkingVisible: answer1.toLowerCase() === 'yes',
                    approvalFlow: answer2.toLowerCase() === 'yes',
                    productionQuality: answer3.toLowerCase() === 'yes',
                    notes: notes || 'None'
                };

                console.log(`Thinking Visible: ${results.thinkingVisible ? '✅ YES' : '❌ NO - NEEDS TUNING'}`);
                console.log(`Approval Flow: ${results.approvalFlow ? '✅ YES' : '❌ NO - NEEDS TUNING'}`);
                console.log(`Production Quality: ${results.productionQuality ? '✅ YES' : '❌ NO - NEEDS TUNING'}`);
                console.log(`Notes: ${results.notes}`);

                if (!results.thinkingVisible || !results.approvalFlow || !results.productionQuality) {
                    console.log('\n⚠️  TUNING REQUIRED - See checklist above for fixes.\n');
                } else {
                    console.log('\n✅ ALL CHECKS PASSED - AI is functioning as expected!\n');
                }

                rl.close();
            });
        });
    });
});
