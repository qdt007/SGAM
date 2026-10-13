/**
 * Assembles the debug APK with Gradle.
 *
 * Capacitor's own `cap build` wants a signing config; a debug APK is signed with the throwaway
 * debug key, which is all that is needed to sideload it onto a phone for a demo. Releasing to
 * the Play Store would need a real keystore — see mobile/README.md.
 */
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const android = join(here, '..', 'android');

if (!existsSync(android)) {
  console.error('No android/ directory yet. Run:  npx cap add android');
  process.exit(1);
}

/** Gradle finds the SDK through local.properties or ANDROID_HOME; neither is set by default. */
function resolveSdk() {
  if (process.env.ANDROID_HOME && existsSync(process.env.ANDROID_HOME)) return process.env.ANDROID_HOME;
  if (process.env.ANDROID_SDK_ROOT && existsSync(process.env.ANDROID_SDK_ROOT)) return process.env.ANDROID_SDK_ROOT;
  const guesses = [
    join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk'),
    join(homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
    join(homedir(), 'Library', 'Android', 'sdk'),
    join(homedir(), 'Android', 'Sdk'),
  ];
  return guesses.find((g) => g && existsSync(g)) ?? null;
}

const sdk = resolveSdk();
if (!sdk) {
  console.error('Could not find the Android SDK.');
  console.error('Install Android Studio, then set ANDROID_HOME to its SDK directory.');
  process.exit(1);
}

// Gradle reads local.properties as a Java properties file, where a backslash is an escape,
// so a Windows SDK path has to be written with forward slashes. Both characters are built
// from char codes: a bare backslash in this file is the one thing that does not survive
// being written by a tool, and it cost a failed build to learn.
const BACKSLASH = String.fromCharCode(92);
const LF = String.fromCharCode(10);

const props = join(android, 'local.properties');
if (!existsSync(props)) {
  // Gradle wants forward slashes even on Windows.
  writeFileSync(props, 'sdk.dir=' + sdk.split(BACKSLASH).join('/') + LF);
  console.log(`Wrote ${props}`);
}

// An absolute, quoted path to the wrapper. `gradlew.bat` on its own is not resolved when cmd
// runs with NoDefaultCurrentDirectoryInExePath set, which is how the first build failed with
// "'gradlew.bat' is not recognized" while the file was sitting right there.
/**
 * The wrapper ships networkTimeout=10000. Gradle's own distribution is a ~130MB zip, and ten
 * seconds is not enough to fetch it on an ordinary connection — the first build then dies with
 * "failed: timeout (10000ms)" and says nothing about the size of what it was fetching.
 */
const wrapperProps = join(android, 'gradle', 'wrapper', 'gradle-wrapper.properties');
if (existsSync(wrapperProps)) {
  const before = readFileSync(wrapperProps, 'utf8');
  const after = before.replace(/^networkTimeout=\d+$/m, 'networkTimeout=120000');
  if (after !== before) {
    writeFileSync(wrapperProps, after);
    console.log('Raised the Gradle download timeout to 120s.');
  }
}

const gradlew = JSON.stringify(join(android, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'));
console.log('Running Gradle. The first build downloads Gradle itself and takes a few minutes.\n');
execSync(`${gradlew} assembleDebug`, { cwd: android, stdio: 'inherit' });

const outDir = join(android, 'app', 'build', 'outputs', 'apk', 'debug');
const apk = readdirSync(outDir).find((f) => f.endsWith('.apk'));
console.log(`\nAPK: ${join(outDir, apk ?? '(not found)')}`);
console.log('Copy it to a phone and open it, or:  adb install -r <that path>');
