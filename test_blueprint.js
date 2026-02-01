/**
 * Test the Blueprint System
 * Run this with: node test_blueprint.js
 */

async function testBlueprint() {
    const baseUrl = 'http://localhost:3000/api/blueprint';

    console.log('🧪 Testing Blueprint System...\n');

    // Test 1: Generate Blueprint
    console.log('1️⃣ Generating blueprint...');
    try {
        const generateResponse = await fetch(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'generate' })
        });

        const generateData = await generateResponse.json();
        console.log('✅ Generate:', generateData.success ? 'SUCCESS' : 'FAILED');
        if (generateData.blueprint) {
            console.log(`   - Version: ${generateData.blueprint.version}`);
            console.log(`   - Components: ${generateData.blueprint.components.length}`);
            console.log(`   - APIs: ${generateData.blueprint.apis.length}`);
            console.log(`   - Features: ${generateData.blueprint.features.length}`);
            console.log(`   - HTML Projects: ${generateData.blueprint.htmlProjects.length}`);
        }
    } catch (error) {
        console.error('❌ Generate failed:', error.message);
    }

    console.log('');

    // Test 2: Get Latest Blueprint (JSON)
    console.log('2️⃣ Getting latest blueprint (JSON)...');
    try {
        const getResponse = await fetch(`${baseUrl}?action=latest&format=json`);
        const getData = await getResponse.json();
        console.log('✅ Get (JSON):', getData.blueprint ? 'SUCCESS' : 'FAILED');
        if (getData.blueprint) {
            console.log(`   - ID: ${getData.blueprint.id}`);
            console.log(`   - Name: ${getData.blueprint.metadata.name}`);
        }
    } catch (error) {
        console.error('❌ Get (JSON) failed:', error.message);
    }

    console.log('');

    // Test 3: Get Latest Blueprint (Markdown)
    console.log('3️⃣ Getting latest blueprint (Markdown)...');
    try {
        const mdResponse = await fetch(`${baseUrl}?action=latest&format=markdown`);
        const mdText = await mdResponse.text();
        console.log('✅ Get (Markdown): SUCCESS');
        console.log(`   - Length: ${mdText.length} characters`);
        console.log(`   - Preview: ${mdText.substring(0, 100)}...`);
    } catch (error) {
        console.error('❌ Get (Markdown) failed:', error.message);
    }

    console.log('');

    // Test 4: Export Blueprint
    console.log('4️⃣ Exporting blueprint...');
    try {
        const exportResponse = await fetch(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'export' })
        });

        const exportData = await exportResponse.json();
        console.log('✅ Export:', exportData.success ? 'SUCCESS' : 'FAILED');
        if (exportData.export) {
            console.log(`   - Has recreation script: ${!!exportData.export.recreationScript}`);
            console.log(`   - Has instructions: ${!!exportData.export.instructions}`);
            console.log(`   - Script length: ${exportData.export.recreationScript?.length || 0} chars`);
        }
    } catch (error) {
        console.error('❌ Export failed:', error.message);
    }

    console.log('\n✅ Blueprint system tests complete!');
}

testBlueprint().catch(console.error);
