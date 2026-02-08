import { spawn } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

const getArgValue = (name, short) => {
    const args = process.argv.slice(2);
    const longIndex = args.indexOf(name);
    if (longIndex !== -1 && args[longIndex + 1]) return args[longIndex + 1];
    const shortIndex = short ? args.indexOf(short) : -1;
    if (shortIndex !== -1 && args[shortIndex + 1]) return args[shortIndex + 1];
    const eqArg = args.find(arg => arg.startsWith(`${name}=`));
    if (eqArg) return eqArg.split('=')[1];
    return null;
};

const listApps = () => {
    const appsDir = resolve(process.cwd(), 'apps');
    if (!existsSync(appsDir)) return [];
    return readdirSync(appsDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
};

const appName = getArgValue('--app', '-a') || process.env.APP;
if (!appName) {
    const available = listApps();
    console.error('Missing required --app <name>.');
    if (available.length) {
        console.error(`Available apps: ${available.join(', ')}`);
    }
    process.exit(1);
}

const appPath = resolve(process.cwd(), 'apps', appName);
if (!existsSync(appPath)) {
    console.error(`App not found at ${appPath}.`);
    process.exit(1);
}

const packageJsonPath = resolve(appPath, 'package.json');
if (!existsSync(packageJsonPath)) {
    console.error(`No package.json found for app ${appName}.`);
    process.exit(1);
}

const devProcess = spawn('npm', ['run', 'dev'], {
    cwd: appPath,
    stdio: 'inherit',
    shell: true
});

devProcess.on('exit', (code) => {
    process.exit(code ?? 0);
});
