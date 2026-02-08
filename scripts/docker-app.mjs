import { spawn } from "node:child_process";

const args = process.argv.slice(2);

const getArg = (name) => {
  const eqPrefix = `--${name}=`;
  const eqMatch = args.find((arg) => arg.startsWith(eqPrefix));
  if (eqMatch) return eqMatch.slice(eqPrefix.length);
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return undefined;
};

const appName = getArg("app") || process.env.APP_NAME;
const profile = getArg("profile") || process.env.PROFILE;
const devPort = getArg("dev-port") || process.env.DEV_PORT || "5050";
const prodPort = getArg("prod-port") || process.env.PROD_PORT || "8080";

if (!appName || !profile) {
  console.error("Usage: npm run docker:app -- --app <appName> --profile <dev|prod> [--dev-port 5050] [--prod-port 8080]");
  process.exit(1);
}

const env = {
  ...process.env,
  APP_NAME: appName,
  DEV_PORT: devPort,
  PROD_PORT: prodPort,
};

const dockerArgs = [
  "compose",
  "-f",
  "docker-compose.app.yml",
  "--profile",
  profile,
  "up",
  "--build",
];

const child = spawn("docker", dockerArgs, {
  stdio: "inherit",
  env,
});

child.on("exit", (code) => process.exit(code ?? 0));
