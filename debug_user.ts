
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const prompts = await prisma.aIPromptSet.findMany({ where: { isActive: true } });
    console.log('Active prompts:', JSON.stringify(prompts, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
