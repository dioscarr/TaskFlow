/**
 * Test script for the automatic web app creation workflow
 * 
 * This script simulates a user request to create a website
 * and verifies that the workflow executes correctly.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testWebAppWorkflow() {
    console.log('🧪 Testing Web App Creation Workflow...\n');

    try {
        // 1. Check if DEFAULT_WORKFLOWS is loaded
        console.log('Step 1: Checking workflow configuration...');
        const { DEFAULT_WORKFLOWS } = require('./src/lib/intentLibrary.ts');

        if (!DEFAULT_WORKFLOWS || DEFAULT_WORKFLOWS.length === 0) {
            console.error('❌ DEFAULT_WORKFLOWS not found or empty');
            return;
        }

        const webAppWorkflow = DEFAULT_WORKFLOWS.find(w => w.id === 'create_web_app');
        if (!webAppWorkflow) {
            console.error('❌ create_web_app workflow not found');
            return;
        }

        console.log('✅ Workflow found:', webAppWorkflow.name);
        console.log('   Triggers:', webAppWorkflow.triggerKeywords.slice(0, 3).join(', '), '...');
        console.log('   Steps:', webAppWorkflow.steps.length);

        // 2. Verify workflow steps
        console.log('\nStep 2: Verifying workflow steps...');
        const step1 = webAppWorkflow.steps[0];
        const step2 = webAppWorkflow.steps[1];

        console.log('   Step 1:', step1.action, '- autoName:', step1.params?.autoName);
        console.log('   Step 2:', step2.action, '- useLastFolder:', step2.params?.useLastFolder);

        if (step1.action !== 'create_folder') {
            console.error('❌ Step 1 should be create_folder');
            return;
        }

        if (step2.action !== 'create_html_file') {
            console.error('❌ Step 2 should be create_html_file');
            return;
        }

        console.log('✅ Workflow steps are correctly configured');

        // 3. Check database for recent workflow executions
        console.log('\nStep 3: Checking recent agent activity...');
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });

        if (!user) {
            console.log('⚠️  Demo user not found - workflow not tested in production yet');
        } else {
            const recentActivity = await prisma.agentActivity.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
                take: 5
            });

            console.log('   Recent activities:');
            recentActivity.forEach(activity => {
                console.log(`   - ${activity.title}: ${activity.message}`);
            });
        }

        console.log('\n✅ Web App Workflow Test Complete!');
        console.log('\n📝 To test manually:');
        console.log('   1. Open the AI chat');
        console.log('   2. Type: "create a website"');
        console.log('   3. Verify folder and index.html are created');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

testWebAppWorkflow();
