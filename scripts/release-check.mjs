#!/usr/bin/env node
// npm run release-check [-- path/to.aab] [--offline]
// Reads the AAB's own manifest (bundletool) and fails on anything that would
// get the build rejected or contradict what the store says about the app:
// package, version vs app.json, versionCode above everything on Play, target
// SDK, not debuggable, no Android auto backup (privacy policy: photos stay on
// the device), and permissions limited to what the Data safety form and the
// privacy policy declare. play-publish runs this before every upload.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const PKG = 'com.deblockx.rollcam';
const MIN_TARGET_SDK = 35; // Play requirement for new apps and updates

// Declared in Data safety / privacy policy, or harmless platform plumbing.
const ALLOWED = new Set([
  'android.permission.CAMERA',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.VIBRATE',
  'android.permission.WAKE_LOCK',
  'android.permission.RECEIVE_BOOT_COMPLETED', // re-arm local reminders after reboot
  'android.permission.READ_APP_BADGE',
  'com.google.android.c2dm.permission.RECEIVE', // expo-notifications pulls in FCM; no remote push is sent
  'com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE',
  `${PKG}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`,
]);
// launcher badge plumbing from expo-notifications (vendor launchers)
const BADGE = /^(com\.(sec\.android\.provider\.badge|htc\.launcher|sonyericsson\.home|sonymobile\.home|anddoes\.launcher|majeur\.launcher|huawei\.android\.launcher|oppo\.launcher)|me\.everything\.badger)\.permission\./;

/**
 * @param {string} xml bundletool manifest dump
 * @param {{ version: string, android: { versionCode: number } }} app expo config
 * @param {number | null} [playMax] highest versionCode on any Play track
 */
export function checkManifest(xml, app, playMax = null) {
  const problems = [];
  const attr = (name, scope = xml) => scope.match(new RegExp(`${name}="([^"]*)"`))?.[1];
  const head = xml.match(/<manifest[^>]*>/)?.[0] ?? '';
  const appTag = xml.match(/<application[^>]*>/)?.[0] ?? '';
  const sdk = xml.match(/<uses-sdk[^>]*>/)?.[0] ?? '';

  if (attr('package', head) !== PKG) problems.push(`package ${attr('package', head)} (want ${PKG})`);
  const vc = Number(attr('android:versionCode', head));
  if (vc !== app.android.versionCode) problems.push(`versionCode ${vc} != app.json ${app.android.versionCode} (stale build?)`);
  if (attr('android:versionName', head) !== app.version) problems.push(`versionName ${attr('android:versionName', head)} != app.json ${app.version}`);
  if (playMax !== null && vc <= playMax) problems.push(`versionCode ${vc} is not above Play's highest (${playMax})`);
  const target = Number(attr('android:targetSdkVersion', sdk));
  if (!(target >= MIN_TARGET_SDK)) problems.push(`targetSdkVersion ${target} < ${MIN_TARGET_SDK}`);
  if (attr('android:debuggable', appTag) === 'true') problems.push('debuggable build');
  if (attr('android:allowBackup', appTag) !== 'false') problems.push('allowBackup is on: Android auto backup would copy photos to Google Drive (policy says they stay on the device)');

  const perms = [...xml.matchAll(/<uses-permission[^>]*android:name="([^"]+)"/g)].map((m) => m[1]);
  for (const p of perms) if (!ALLOWED.has(p) && !BADGE.test(p)) problems.push(`undeclared permission ${p}`);
  return { problems, versionCode: vc, target, perms };
}

async function playMaxVersionCode() {
  const { API, call, token, withPlayLock } = await import('./play-auth.mjs');
  return withPlayLock(async () => {
    const tok = await token();
    const edit = await call(tok, 'POST', `${API}/edits`, {});
    try {
      const { tracks = [] } = await call(tok, 'GET', `${API}/edits/${edit.id}/tracks`);
      return Math.max(0, ...tracks.flatMap((t) => (t.releases ?? []).flatMap((r) => (r.versionCodes ?? []).map(Number))));
    } finally {
      await call(tok, 'DELETE', `${API}/edits/${edit.id}`).catch(() => {});
    }
  });
}

export async function releaseCheck(aab, { offline = false } = {}) {
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
  aab ??= join(root, 'release', `rollcam-${app.version}-vc${app.android.versionCode}.aab`);
  if (!existsSync(aab)) return { aab, problems: [`no AAB at ${aab}`] };
  const xml = execFileSync('bundletool', ['dump', 'manifest', '--bundle', aab], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: process.env.JAVA_HOME ?? '/opt/homebrew/opt/openjdk@21' },
  });
  const playMax = offline ? null : await playMaxVersionCode();
  return { aab, playMax, ...checkManifest(xml, app, playMax) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const r = await releaseCheck(args.find((a) => a.endsWith('.aab')), { offline: args.includes('--offline') });
  console.log(`${r.aab}\n  vc${r.versionCode ?? '?'} · targetSdk ${r.target ?? '?'} · Play max ${r.playMax ?? 'skipped'} · ${r.perms?.length ?? 0} permissions`);
  for (const p of r.problems) console.log(`  FAIL ${p}`);
  if (r.problems.length) process.exit(1);
  console.log('  PASS');
}
