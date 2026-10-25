#!/usr/bin/env node
// npm run play-publish -- [--track internal|alpha|beta|production] [--status draft|completed]
//                         [--listing] [--images] [--no-bundle] [--dry-run]
//
// One Play Developer API edit: AAB from release/, store text from store/listing.json,
// icon/feature/screenshots from store/. Keyless auth (scripts/play-auth.mjs):
// the owner's OAuth token (PLAY_USER_TOKEN) impersonates
// PLAY_SERVICE_ACCOUNT through IAM Credentials. The app must already exist in Play
// Console (the API cannot create apps). Play only accepts draft releases until the
// app's first review, so the default is alpha (closed testing) + draft.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { API, PKG, PLAY_SA, call, editDeleted, token, withPlayLock } from './play-auth.mjs';
import { releaseCheck } from './release-check.mjs';

const root = new URL('..', import.meta.url).pathname;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PKG}`;
const CONTACT = { contactEmail: 'contact@deblockxlabs.com', contactWebsite: 'https://deblockxlabs.com' };

const args = process.argv.slice(2);
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
const flag = (name) => args.includes(name);
const track = opt('--track', 'alpha');
const status = opt('--status', 'draft');
const dry = flag('--dry-run');

const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
const p = {
  aab: flag('--no-bundle') ? null : join(root, 'release', `rollcam-${app.version}-vc${app.android.versionCode}.aab`),
  listing: flag('--listing') ? JSON.parse(readFileSync(join(root, 'store', 'listing.json'), 'utf8')) : null,
  images: flag('--images')
    ? { icon: [join(root, 'store/icon-512.png')], featureGraphic: [join(root, 'store/feature-1024x500.png')], phoneScreenshots: [1, 2, 3, 4, 5].map((i) => join(root, `store/out/screenshot-${i}.png`)) }
    : null,
};
// store/release-notes.json { "<version>": { "<lang>": "text" } }, Play limit 500 chars per language
// a store language with its own screenshots (store/out/<en|ko>/screenshot-N.png, scripts/store-frame.py --lang) uses
// them; the rest share store/out/screenshot-N.png
const shotsFor = (lang) => {
  const own = [1, 2, 3, 4, 5].map((i) => join(root, `store/out/${lang.split('-')[0]}/screenshot-${i}.png`));
  return existsSync(own[0]) ? own.filter((f) => existsSync(f)) : p.images.phoneScreenshots;
};
const notesFile = join(root, 'store', 'release-notes.json');
const notesFor = existsSync(notesFile) ? JSON.parse(readFileSync(notesFile, 'utf8'))[app.version] : null;
const releaseNotes = notesFor ? Object.entries(notesFor).map(([language, text]) => ({ language, text })) : null;
const missing = [p.aab, ...Object.values(p.images ?? {}).flat()].filter((f) => f && !existsSync(f));
for (const n of releaseNotes ?? []) if ([...n.text].length > 500) missing.push(`${n.language} release notes > 500 chars`);
for (const [lang, v] of Object.entries(p.listing?.listings ?? {})) {
  if ([...v.title].length > 30) missing.push(`${lang} title > 30 chars`);
  if ([...v.shortDescription].length > 80) missing.push(`${lang} short description > 80 chars`);
}
console.log(`${PKG}: ${[p.aab && `AAB ${app.version} vc${app.android.versionCode} -> ${track}/${status}`, p.listing && 'listing', p.images && 'images'].filter(Boolean).join(' · ') || 'nothing'}`);
// the AAB's own manifest must match what the store declares (finishes its read-only edit before ours opens)
if (p.aab && existsSync(p.aab)) missing.push(...(await releaseCheck(p.aab)).problems.map((x) => `release-check: ${x}`));
if (missing.length) {
  console.error(`PROBLEM ${missing.join(', ')}`);
  process.exit(1);
}
if (dry) process.exit(0);


async function publishOnce(tok) {
  const edit = await call(tok, 'POST', `${API}/edits`, {});
  const e = `${API}/edits/${edit.id}`;
  const u = `${UPLOAD}/edits/${edit.id}`;
  try {
    if (p.listing) {
      await call(tok, 'PATCH', `${e}/details`, { defaultLanguage: p.listing.defaultLanguage, ...CONTACT });
      for (const [lang, v] of Object.entries(p.listing.listings)) {
        await call(tok, 'PUT', `${e}/listings/${lang}`, { language: lang, ...v });
        console.log(`  listing ${lang}`);
      }
    }
    if (p.images) {
      // images go to every store language, even when the text isn't being updated
      const langs = Object.keys((p.listing ?? JSON.parse(readFileSync(join(root, 'store', 'listing.json'), 'utf8'))).listings);
      for (const lang of langs) {
        for (const [type, all] of Object.entries(p.images)) {
          const files = type === 'phoneScreenshots' ? shotsFor(lang) : all;
          await call(tok, 'DELETE', `${e}/listings/${lang}/${type}`);
          for (const f of files) await call(tok, 'POST', `${u}/listings/${lang}/${type}?uploadType=media`, readFileSync(f), 'image/png');
        }
        console.log(`  images ${lang}${shotsFor(lang) !== p.images.phoneScreenshots ? ' (own screenshots)' : ''}`);
      }
    }
    if (p.aab) {
      const b = await call(tok, 'POST', `${u}/bundles?uploadType=media`, readFileSync(p.aab), 'application/octet-stream');
      console.log(`  bundle versionCode ${b.versionCode}`);
      await call(tok, 'PUT', `${e}/tracks/${track}`, {
        track,
        releases: [{ name: `${app.version} (${b.versionCode})`, versionCodes: [String(b.versionCode)], status, ...(releaseNotes ? { releaseNotes } : {}) }],
      });
      console.log(`  track ${track} · ${status}`);
    }
    await call(tok, 'POST', `${e}:validate`);
    await call(tok, 'POST', `${e}:commit`);
    console.log(`  committed edit ${edit.id}`);
  } catch (err) {
    await call(tok, 'DELETE', e).catch(() => {});
    throw err;
  }
}

try {
  await withPlayLock(async () => {
    const tok = await token();
    try {
      await publishOnce(tok);
    } catch (err) {
      // someone outside these scripts opened an edit on the app mid-upload: nothing was committed, so redo once
      if (!editDeleted(err)) throw err;
      console.error('  edit was deleted by another Play client, retrying once');
      await publishOnce(tok);
    }
  });
} catch (err) {
  console.error(`FAILED ${err.message}`);
  if (/404|not found/i.test(err.message)) console.error('hint: create the app in Play Console first (package com.deblockx.rollcam)');
  if (/403|permission/i.test(err.message)) console.error(`hint: give ${PLAY_SA} access to this app in Play Console → Users and permissions`);
  process.exit(1);
}
