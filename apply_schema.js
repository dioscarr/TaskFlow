const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
    const prisma = new PrismaClient();
    try {
        const sql = fs.readFileSync('schema.sql', 'utf8');
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        console.log(`Executing ${statements.length} statements...`);
        for (const stmt of statements) {
            await prisma.$executeRawUnsafe(stmt);
        }
        console.log('✅ Schema applied successfully!');
    } catch (e) {
        console.error('❌ Error applying schema:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
