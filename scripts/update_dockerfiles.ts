/**
 * Update All Dockerfile.dev Files
 *
 * Adds security hardening to all app Dockerfiles:
 * - Non-root user execution
 * - Health checks
 * - Proper layer caching
 *
 * Usage: npx tsx scripts/update_dockerfiles.ts
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const SECURE_DOCKERFILE = `FROM node:20-alpine

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install dependencies as root
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose preview port
EXPOSE 5050

# Health check for automated recovery
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s \\
    CMD wget -qO- http://localhost:5050 || exit 1

# Start development server with host binding
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5050"]
`;

async function updateDockerfiles() {
    const appsDir = join(process.cwd(), 'apps');

    try {
        const apps = await readdir(appsDir);
        let updated = 0;
        let skipped = 0;

        for (const app of apps) {
            const dockerfilePath = join(appsDir, app, 'Dockerfile.dev');

            try {
                // Check if Dockerfile.dev exists
                const currentContent = await readFile(dockerfilePath, 'utf-8');

                // Check if it already has non-root user
                if (currentContent.includes('USER appuser')) {
                    console.log(`⏭️  ${app}/Dockerfile.dev - Already secure (skipping)`);
                    skipped++;
                    continue;
                }

                // Update the Dockerfile
                await writeFile(dockerfilePath, SECURE_DOCKERFILE);
                console.log(`✅ ${app}/Dockerfile.dev - Updated with security hardening`);
                updated++;
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    console.log(`⚠️  ${app} - No Dockerfile.dev found (skipping)`);
                    skipped++;
                } else {
                    console.error(`❌ ${app} - Error: ${error.message}`);
                }
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Updated: ${updated}`);
        console.log(`   ⏭️  Skipped: ${skipped}`);
        console.log(`   📦 Total: ${apps.length}`);

        console.log(`\n🔒 Security improvements applied:`);
        console.log(`   • Non-root user execution (USER appuser)`);
        console.log(`   • Automated health checks (HEALTHCHECK)`);
        console.log(`   • Optimized layer caching (package*.json first)`);
        console.log(`   • Proper file ownership (chown)`);

    } catch (error) {
        console.error('Error updating Dockerfiles:', error);
        process.exit(1);
    }
}

updateDockerfiles();
