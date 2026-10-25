#!/usr/bin/env node
// npm run android-release -> release/rollcam-<version>-vc<code>.aab, signed with the
// upload key. Signing values come from an env file outside the repo (ANDROID_SIGNING_ENV,
// default ~/.secrets/android-signing.env); the keystore never lives in this repo.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const SIGNING = ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'];

const envFile = process.env.ANDROID_SIGNING_ENV ?? join(homedir(), '.secrets', 'android-signing.env');
const secrets = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split('\n')
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
);
const missing = SIGNING.filter((k) => !secrets[k]);
if (missing.length) {
  console.error(`missing in ${envFile}: ${missing.join(', ')}`);
  process.exit(1);
}
if (!existsSync(secrets.ANDROID_KEYSTORE_PATH)) {
  console.error(`keystore not found: ${secrets.ANDROID_KEYSTORE_PATH}`);
  process.exit(1);
}

const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
const version = app.version;
const code = app.android?.versionCode ?? 1;

const env = {
  ...process.env,
  JAVA_HOME: process.env.JAVA_HOME ?? '/opt/homebrew/opt/openjdk@21',
  ANDROID_HOME: process.env.ANDROID_HOME ?? '/opt/homebrew/share/android-commandlinetools',
  NODE_ENV: 'production',
};

console.log(`ROLLCAM ${version} (vc${code}): prebuild`);
execFileSync('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], { cwd: root, env, stdio: 'inherit' });

console.log('gradle bundleRelease');
try {
  execFileSync(
    './gradlew',
    [
      'bundleRelease',
      `-Pandroid.injected.signing.store.file=${secrets.ANDROID_KEYSTORE_PATH}`,
      `-Pandroid.injected.signing.store.password=${secrets.ANDROID_KEYSTORE_PASSWORD}`,
      `-Pandroid.injected.signing.key.alias=${secrets.ANDROID_KEY_ALIAS}`,
      `-Pandroid.injected.signing.key.password=${secrets.ANDROID_KEY_PASSWORD}`,
    ],
    { cwd: join(root, 'android'), env, stdio: 'inherit' },
  );
} catch {
  // Node's error repeats the whole command line, signing passwords included: say only that it failed
  console.error('gradle bundleRelease failed (see the gradle output above)');
  process.exit(1);
}

const built = join(root, 'android/app/build/outputs/bundle/release/app-release.aab');
mkdirSync(join(root, 'release'), { recursive: true });
const out = join(root, 'release', `rollcam-${version}-vc${code}.aab`);
copyFileSync(built, out);
console.log(`\n${out}`);

// fail the build step if the bundle wouldn't match the store declarations
const { releaseCheck } = await import('./release-check.mjs');
const check = await releaseCheck(out, { offline: process.argv.includes('--offline') });
for (const p of check.problems) console.error(`  FAIL ${p}`);
if (check.problems.length) process.exit(1);
console.log('  release-check PASS');
