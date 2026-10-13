/**
 * Builds the web client for the phone and copies it into www/.
 *
 * The APK ships the built client inside it, so the bundle cannot talk to a relative /api the way
 * the browser build does — there is no server on the phone. API_URL is baked in at build time
 * and must be the deployed API, which is why this script refuses to run without it.
 */
import { execSync } from 'node:child_process';
import { cpSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const mobile = join(here, '..');
const client = join(mobile, '..', 'client');

const API_URL = process.env.API_URL ?? readApiUrlFromFile();

function readApiUrlFromFile() {
  const f = join(mobile, 'api-url.txt');
  return existsSync(f) ? readFileSync(f, 'utf8').trim() : null;
}

if (!API_URL) {
  console.error('No API URL.\n');
  console.error('The phone needs an absolute address for the API. Either:');
  console.error('  echo https://pm-api-zdtj.onrender.com/api > mobile/api-url.txt');
  console.error('or set it for one run:');
  console.error('  API_URL=https://pm-api-zdtj.onrender.com/api npm run apk');
  process.exit(1);
}

if (!/^https:\/\//.test(API_URL)) {
  // Android 9+ blocks cleartext HTTP by default, and allowMixedContent is off in the config.
  console.error(`API_URL must be https. Got: ${API_URL}`);
  process.exit(1);
}

console.log(`Building the client against ${API_URL} ...`);
execSync('npm run build', {
  cwd: client,
  stdio: 'inherit',
  env: { ...process.env, VITE_API_URL: API_URL },
});

const dist = join(client, 'dist');
const www = join(mobile, 'www');
rmSync(www, { recursive: true, force: true });
cpSync(dist, www, { recursive: true });
console.log(`Copied ${dist} -> ${www}`);
