
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tasks = await prisma.task.findMany();
    console.log(JSON.stringify(tasks, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
