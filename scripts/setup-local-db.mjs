import net from 'node:net';
import process from 'node:process';
import { spawn } from 'node:child_process';

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/taskflow?schema=public';
const DEFAULT_LOCAL_PORT = 5433;

function bin(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function run(command, args, options = {}) {
  const env = Object.fromEntries(
    Object.entries({
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
    }).filter(([, value]) => value !== undefined)
  );

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
      env,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

function waitForPort(port, host = '127.0.0.1', timeoutMs = 60000) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = new net.Socket();

      socket.setTimeout(2000);
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('timeout', () => {
        socket.destroy();
        retry();
      });
      socket.once('error', () => {
        socket.destroy();
        retry();
      });

      socket.connect(port, host);
    };

    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for Postgres on ${host}:${port}`));
        return;
      }
      setTimeout(tryConnect, 1500);
    };

    tryConnect();
  });
}

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(1500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;

  const existingDb = await isPortOpen(DEFAULT_LOCAL_PORT);

  if (!existingDb) {
    console.log('Starting local TaskFlow Postgres...');
    try {
      await run('docker', ['compose', '-f', 'docker-compose.db.yml', 'up', '-d']);
    } catch (error) {
      const nowAvailable = await isPortOpen(DEFAULT_LOCAL_PORT);
      if (!nowAvailable) {
        throw error;
      }
      console.warn('Docker could not be started, but a local Postgres instance is already listening on port 5433. Continuing with that instance.');
    }
  } else {
    console.log('Detected an existing local Postgres instance on port 5433. Reusing it.');
  }

  console.log('Waiting for Postgres to accept connections...');
  await waitForPort(DEFAULT_LOCAL_PORT);

  console.log('Applying Prisma migrations...');
  await run(bin('npx'), ['prisma', 'migrate', 'deploy']);

  console.log('Seeding demo data...');
  await run(bin('tsx'), ['prisma/seed.ts']);

  console.log('\nLocal database is ready.');
  console.log('DATABASE_URL=' + databaseUrl);
}

main().catch((error) => {
  console.error('\nLocal DB setup failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
