import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import process from 'node:process';
import { spawn } from 'node:child_process';

const LOCAL_PORT = 5435;
const LOCAL_HOST = '127.0.0.1';
const LOCAL_DB = 'taskflow';
const LOCAL_USER = 'postgres';
const LOCAL_DATABASE_URL = `postgresql://${LOCAL_USER}@${LOCAL_HOST}:${LOCAL_PORT}/${LOCAL_DB}?schema=public`;
const WORKSPACE_ROOT = process.cwd();
const POSTGRES_ROOT = path.join(WORKSPACE_ROOT, '.local', 'postgres');
const DATA_DIR = path.join(POSTGRES_ROOT, 'data');
const LOG_FILE = path.join(POSTGRES_ROOT, 'postgres.log');

function envWithDatabaseUrl() {
  return Object.fromEntries(
    Object.entries({
      ...process.env,
      DATABASE_URL: LOCAL_DATABASE_URL,
    }).filter(([, value]) => value !== undefined)
  );
}

function run(command, args, options = {}) {
  const useShell = process.platform === 'win32' && !command.toLowerCase().endsWith('.exe');

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: useShell,
      ...options,
      env: options.env || envWithDatabaseUrl(),
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

function isPortOpen(port, host = LOCAL_HOST) {
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

async function waitForPort(port, host = LOCAL_HOST, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isPortOpen(port, host)) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for Postgres on ${host}:${port}`);
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function detectPostgresBin() {
  const baseDir = 'C:\\Program Files\\PostgreSQL';
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  const versions = entries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => Number(entry.name))
    .sort((a, b) => b - a);

  for (const version of versions) {
    const binDir = path.join(baseDir, String(version), 'bin');
    const pgCtl = path.join(binDir, 'pg_ctl.exe');
    const initdb = path.join(binDir, 'initdb.exe');
    const createdb = path.join(binDir, 'createdb.exe');
    const psql = path.join(binDir, 'psql.exe');

    if (
      await pathExists(pgCtl) &&
      await pathExists(initdb) &&
      await pathExists(createdb) &&
      await pathExists(psql)
    ) {
      return { version, binDir, pgCtl, initdb, createdb, psql };
    }
  }

  throw new Error('No PostgreSQL installation with pg_ctl/initdb/createdb/psql was found in C:\\Program Files\\PostgreSQL.');
}

async function ensureDirectories() {
  await fs.mkdir(POSTGRES_ROOT, { recursive: true });
}

async function ensureCluster(binaries) {
  await ensureDirectories();

  const pgVersionFile = path.join(DATA_DIR, 'PG_VERSION');
  if (await pathExists(pgVersionFile)) {
    return;
  }

  console.log(`Initializing local Postgres data directory in ${DATA_DIR}...`);
  await run(binaries.initdb, ['-D', DATA_DIR, '-U', LOCAL_USER, '-A', 'trust', '-E', 'UTF8']);

  const autoConfig = [
    `listen_addresses = '${LOCAL_HOST}'`,
    `port = ${LOCAL_PORT}`,
    `max_connections = 100`,
  ].join('\n') + '\n';

  await fs.writeFile(path.join(DATA_DIR, 'postgresql.auto.conf'), autoConfig, 'utf8');

  const pgHba = [
    'local   all             all                                     trust',
    'host    all             all             127.0.0.1/32            trust',
    'host    all             all             ::1/128                 trust',
  ].join('\n') + '\n';

  await fs.writeFile(path.join(DATA_DIR, 'pg_hba.conf'), pgHba, 'utf8');
}

async function startServer(binaries) {
  if (await isPortOpen(LOCAL_PORT)) {
    console.log(`Local Postgres already running on port ${LOCAL_PORT}.`);
    return;
  }

  console.log('Starting local Postgres server...');
  await run(binaries.pgCtl, ['-D', DATA_DIR, '-l', LOG_FILE, '-o', `-p ${LOCAL_PORT}`, 'start']);
  await waitForPort(LOCAL_PORT);
}

async function stopServer(binaries) {
  if (!(await isPortOpen(LOCAL_PORT))) {
    console.log(`No local Postgres server detected on port ${LOCAL_PORT}.`);
    return;
  }

  console.log('Stopping local Postgres server...');
  await run(binaries.pgCtl, ['-D', DATA_DIR, '-m', 'fast', 'stop']);
}

async function ensureDatabase(binaries) {
  console.log(`Ensuring database '${LOCAL_DB}' exists...`);
  try {
    await run(binaries.createdb, ['-h', LOCAL_HOST, '-p', String(LOCAL_PORT), '-U', LOCAL_USER, LOCAL_DB]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('already exists')) {
      console.log('Database may already exist, continuing...');
    }
  }
}

async function runMigrationsAndSeed() {
  console.log('Applying Prisma migrations...');
  await run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'migrate', 'deploy']);

  console.log('Seeding demo data...');
  await run(process.platform === 'win32' ? 'tsx.cmd' : 'tsx', ['prisma/seed.ts']);
}

async function main() {
  const binaries = await detectPostgresBin();
  const args = new Set(process.argv.slice(2));

  process.env.DATABASE_URL = LOCAL_DATABASE_URL;

  if (args.has('--stop-only')) {
    await stopServer(binaries);
    return;
  }

  await ensureCluster(binaries);
  await startServer(binaries);

  if (args.has('--start-only')) {
    console.log(`Local Postgres is running at ${LOCAL_HOST}:${LOCAL_PORT}.`);
    return;
  }

  await ensureDatabase(binaries);
  await runMigrationsAndSeed();

  console.log('\nLocal native database is ready.');
  console.log(`DATABASE_URL=${LOCAL_DATABASE_URL}`);
}

main().catch((error) => {
  console.error('\nNative local DB setup failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
