
import prisma from '../src/lib/prisma';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

async function main() {
    console.log('🚀 Setting up Docker Dev environment for ALL apps...');

    try {
        const user = await prisma.user.findUnique({ where: { email: 'demo@example.com' } });
        if (!user) {
            console.error('❌ Demo user not found');
            return;
        }

        const appsDir = path.resolve(process.cwd(), 'apps');

        // Ensure apps directory exists
        if (!existsSync(appsDir)) {
            console.error('❌ apps directory not found');
            return;
        }

        const entries = await fs.readdir(appsDir, { withFileTypes: true });
        const appFolders = entries.filter(e => e.isDirectory()).map(e => e.name);

        console.log(`Found ${appFolders.length} potential apps: ${appFolders.join(', ')}`);

        for (const appName of appFolders) {
            const appPath = path.join(appsDir, appName);
            const relativePath = `apps/${appName}`;

            // Check for package.json
            if (!existsSync(path.join(appPath, 'package.json'))) {
                console.log(`⚠️ Skipping ${appName} (no package.json)`);
                continue;
            }

            console.log(`\n📦 Processing ${appName}...`);

            // 1. Ensure Dockerfile.dev exists
            const dockerDevPath = path.join(appPath, 'Dockerfile.dev');
            if (!existsSync(dockerDevPath)) {
                console.log(`   Creating Dockerfile.dev for ${appName}...`);
                const dockerFileContent = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
`;
                await fs.writeFile(dockerDevPath, dockerFileContent);
            }

            // Clean up old entries
            // We use the top-level 'path' field which we populate with relativePath
            await prisma.processRegistry.deleteMany({
                where: {
                    userId: user.id,
                    OR: [
                        { name: `${appName} (Docker)` },
                        { path: relativePath }
                    ]
                }
            });

            // 3. Register in Database
            await prisma.processRegistry.create({
                data: {
                    name: `${appName} (Docker)`,
                    type: 'docker-app',
                    path: relativePath, // Use relative path for portability
                    command: 'Docker Dev Container',
                    status: 'stopped',
                    healthCheckType: 'port',
                    healthInterval: 10000,
                    metadata: {
                        source: 'repo-app',
                        appName: appName,
                        appPath: relativePath,
                        containerName: `taskflow-${appName}-dev`,
                        imageName: `taskflow-${appName}-dev`,
                        dockerFile: 'Dockerfile.dev',
                        startScript: 'dev'
                    },
                    userId: user.id
                }
            });

            console.log(`   ✅ Registered ${appName} successfully.`);
        }

        console.log('\n✨ All apps processed!');

    } catch (e) {
        console.error('❌ Error:', e);
    }
}

main().catch(console.error);
