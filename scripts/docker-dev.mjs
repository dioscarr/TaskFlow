#!/usr/bin/env node

/**
 * Smart Docker Development Helper Script
 *
 * Implements industry best practices:
 * - Idempotent container operations (start/create as needed)
 * - Docker Compose Watch for instant hot reload
 * - Container reuse (no unnecessary rebuilds)
 * - Live log streaming
 *
 * Usage:
 *   npm run docker:dev <app-name>       # Start with hot reload
 *   npm run docker:dev <app-name> --logs # Show live logs
 *   npm run docker:dev <app-name> --rebuild # Force rebuild
 *   npm run docker:status               # Show all running containers
 */

import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const command = args[0];
const appName = args[1];
const flags = {
    logs: args.includes('--logs'),
    rebuild: args.includes('--rebuild'),
    watch: args.includes('--watch') || !args.includes('--no-watch'), // Watch enabled by default
    port: args.find(a => a.startsWith('--port='))?.split('=')[1] || '5050'
};

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkDockerRunning() {
    try {
        execSync('docker info', { stdio: 'ignore', timeout: 10000 });
        return true;
    } catch {
        return false;
    }
}

function getContainerStatus(containerName) {
    try {
        const status = execSync(`docker inspect -f "{{.State.Status}}" ${containerName}`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore']
        }).trim();
        return status;
    } catch {
        return 'not_found';
    }
}

function isContainerRunning(containerName) {
    const status = getContainerStatus(containerName);
    return status === 'running';
}

function listRunningContainers() {
    try {
        const output = execSync('docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"', {
            encoding: 'utf8'
        });
        log('\n=== Running Docker Containers ===\n', 'cyan');
        console.log(output);
    } catch (error) {
        log('Failed to list containers', 'red');
    }
}

async function startAppDev(appName) {
    const appPath = join(process.cwd(), 'apps', appName);
    const containerName = `${appName}-dev`;

    // Validate app exists
    if (!existsSync(appPath)) {
        log(`❌ App not found: ${appName}`, 'red');
        log(`   Looked in: ${appPath}`, 'red');
        process.exit(1);
    }

    // Check Docker is running
    if (!checkDockerRunning()) {
        log('❌ Docker is not running. Please start Docker Desktop.', 'red');
        process.exit(1);
    }

    // Check container status
    const status = getContainerStatus(containerName);
    log(`\n🔍 Checking container status: ${containerName}`, 'cyan');

    if (status === 'running' && !flags.rebuild) {
        log('✅ Container already running!', 'green');
        log(`   Preview: http://localhost:${flags.port}`, 'blue');

        if (flags.logs) {
            log('\n📜 Streaming logs (Ctrl+C to exit)...\n', 'yellow');
            const logsProcess = spawn('docker', ['logs', '-f', '--tail', '100', containerName], {
                stdio: 'inherit'
            });

            process.on('SIGINT', () => {
                logsProcess.kill();
                process.exit(0);
            });

            return;
        }

        if (flags.watch) {
            log('🔄 Starting watch mode for live reload...', 'yellow');
            startComposeWatch(appName);
        }

        return;
    }

    if (status === 'exited' && !flags.rebuild) {
        log('🔄 Container exists but stopped. Restarting...', 'yellow');
        try {
            execSync(`docker start ${containerName}`, { stdio: 'inherit' });
            log('✅ Container restarted successfully!', 'green');
            log(`   Preview: http://localhost:${flags.port}`, 'blue');

            if (flags.watch) {
                startComposeWatch(appName);
            }
            return;
        } catch (error) {
            log('⚠️  Failed to restart container. Will create new one...', 'yellow');
            execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
        }
    }

    // Need to create container
    log('🏗️  Creating new container...', 'yellow');

    const env = {
        ...process.env,
        APP_NAME: appName,
        DEV_PORT: flags.port,
        COMPOSE_PROJECT_NAME: appName
    };

    const composeArgs = [
        'compose',
        '-f', 'docker-compose.app.yml',
        '--profile', 'dev',
        'up'
    ];

    if (flags.rebuild) {
        composeArgs.push('--build');
    }

    if (flags.watch) {
        composeArgs.push('--watch');
        log('✨ Starting with hot reload (Docker Compose Watch)...', 'cyan');
    } else {
        composeArgs.push('-d');
    }

    const composeProcess = spawn('docker', composeArgs, {
        stdio: 'inherit',
        env
    });

    composeProcess.on('close', (code) => {
        if (code === 0) {
            log('\n✅ Container started successfully!', 'green');
            log(`   Preview: http://localhost:${flags.port}`, 'blue');
            log(`   Logs: npm run docker:dev ${appName} --logs`, 'blue');
        } else {
            log(`\n❌ Failed to start container (exit code: ${code})`, 'red');
            process.exit(code);
        }
    });
}

function startComposeWatch(appName) {
    const env = {
        ...process.env,
        APP_NAME: appName,
        DEV_PORT: flags.port,
        COMPOSE_PROJECT_NAME: appName
    };

    log('\n🔥 Hot reload enabled - Edit your files and see changes instantly!', 'green');
    log('   Press Ctrl+C to stop\n', 'yellow');

    const watchProcess = spawn('docker', [
        'compose',
        '-f', 'docker-compose.app.yml',
        '--profile', 'dev',
        'watch'
    ], {
        stdio: 'inherit',
        env
    });

    process.on('SIGINT', () => {
        log('\n\n👋 Stopping watch mode...', 'yellow');
        log('   Container is still running. Use `docker stop ${appName}-dev` to stop it.', 'cyan');
        watchProcess.kill();
        process.exit(0);
    });
}

// Main command router
if (!command) {
    log('Usage:', 'cyan');
    log('  npm run docker:dev <app-name>           # Start with hot reload', 'blue');
    log('  npm run docker:dev <app-name> --logs    # Show live logs', 'blue');
    log('  npm run docker:dev <app-name> --rebuild # Force rebuild', 'blue');
    log('  npm run docker:status                   # Show running containers', 'blue');
    process.exit(1);
}

switch (command) {
    case 'status':
        listRunningContainers();
        break;

    default:
        // Treat first arg as app name
        if (!command) {
            log('❌ Please specify an app name', 'red');
            process.exit(1);
        }
        startAppDev(command);
        break;
}
