import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AgentSymphony } from '../lib/agents/AgentSymphony';
import { GeminiAgentAdapter } from '../lib/agents/symphony/adapters';
import AI_CONFIG from '../lib/aiConfig';

async function runSymphonyTest() {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ GOOGLE_GEMINI_API_KEY is missing');
        process.exit(1);
    }

    console.log('🎻 Initializing Agent Symphony...');

    // Initialize Gemini Models
    const genAI = new GoogleGenerativeAI(apiKey);
    const orchestratorModel = genAI.getGenerativeModel({ model: AI_CONFIG.smartModel });
    const workerModel = genAI.getGenerativeModel({ model: AI_CONFIG.fastModel });

    // Setup Symphony
    const symphony = new AgentSymphony({
        orchestrator: new GeminiAgentAdapter("Orchestrator", orchestratorModel),
        critic: new GeminiAgentAdapter("Critic", orchestratorModel),
        workers: {
            researcher: new GeminiAgentAdapter("Researcher", workerModel),
            analyst: new GeminiAgentAdapter("Analyst", workerModel),
            writer: new GeminiAgentAdapter("Writer", workerModel),
            developer: new GeminiAgentAdapter("Developer", workerModel),
            qa: new GeminiAgentAdapter("QA Engineer", orchestratorModel),
            generic: new GeminiAgentAdapter("Generic Worker", workerModel)
        },
        options: {
            maxIterations: 3,
            maxRetries: 2,
            logger: (msg, type) => {
                const safeType = type || 'info';
                const icon = safeType === 'thinking' ? '🧠' : safeType === 'error' ? '❌' : 'ℹ️';
                console.log(`${icon} [${safeType.toUpperCase()}] ${msg}`);
            }
        }
    });

    // The Objective
    const objective = `
    Diagnose the status of the local development environment.
    
    1. Check if the 'marketing-app' is running on port 5174.
    2. Check if the 'test-app-demo' is running on port 5173.
    3. Check if the main 'TaskFlow' app is running on port 3000.
    4. Validate that the marketing app has a "Processes" link in the main app (this was a recent change).
    
    Output a report of what is working and what is not.
    `;

    console.log('\n🎼 Starting Symphony Flow...');
    console.log('Objective:', objective.trim());
    console.log('='.repeat(50));

    const result = await symphony.run(objective, "Use system commands (curl/powershell/netstat) to verify open ports and HTTP status.");

    console.log('\n' + '='.repeat(50));
    console.log('🏁 Final Symphony Result:');
    console.log('Status:', result.status);
    console.log('\n📜 Internal Plan:', JSON.stringify(result.plan, null, 2));

    if (result.finalOutput) {
        console.log('\n📝 Final Report:\n', result.finalOutput);
    } else {
        console.log('\n⚠️ No final output generated.');
        console.log('Worker Results:', JSON.stringify(result.workerResults, null, 2));
    }
}

runSymphonyTest().catch(console.error);
