// Shared Play Developer API auth for play-publish / play-status: the owner's OAuth
// token (PLAY_USER_TOKEN, an authorized-user JSON) impersonates PLAY_SA via IAM
// Credentials, so no service account key file exists anywhere.
import { closeSync, openSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const PKG = 'com.deblockx.rollcam';
export const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const USER_TOKEN = process.env.PLAY_USER_TOKEN ?? join(homedir(), '.secrets', 'google', 'play-user-token.json');
// the service account with Play Console access, e.g. play@your-project.iam.gserviceaccount.com
export const PLAY_SA = process.env.PLAY_SERVICE_ACCOUNT ?? '';

export async function token() {
  if (!PLAY_SA) throw new Error('set PLAY_SERVICE_ACCOUNT to the service account that has Play Console access');
  const u = JSON.parse(readFileSync(USER_TOKEN, 'utf8'));
  const r = await fetch(u.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: u.refresh_token, client_id: u.client_id, client_secret: u.client_secret }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`user token refresh: ${r.status} ${JSON.stringify(j)}`);
  const s = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${PLAY_SA}:generateAccessToken`, {
    method: 'POST',
    headers: { authorization: `Bearer ${j.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ scope: [SCOPE], lifetime: '3600s' }),
  });
  const k = await s.json();
  if (!s.ok) throw new Error(`impersonate ${PLAY_SA}: ${s.status} ${JSON.stringify(k).slice(0, 300)}`);
  return k.accessToken;
}

export async function call(tok, method, url, body, contentType = 'application/json') {
  const r = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${tok}`, ...(body !== undefined ? { 'content-type': contentType } : {}) },
    body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${url.replace(/\?.*/, '')}: ${r.status} ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

// Play keeps one open edit per app: opening a second one deletes the first
// ("This Edit has been deleted"). Every rollcam script that opens an edit runs
// inside this lock so two of them never overlap.
const LOCK = new URL('../.play-edit.lock', import.meta.url).pathname;
const STALE_MS = 15 * 60 * 1000;

export async function withPlayLock(fn, waitMs = 5 * 60 * 1000) {
  const until = Date.now() + waitMs;
  for (;;) {
    try {
      closeSync(openSync(LOCK, 'wx'));
      break;
    } catch {
      try {
        if (Date.now() - statSync(LOCK).mtimeMs > STALE_MS) unlinkSync(LOCK); // crashed holder
      } catch {}
      if (Date.now() > until) throw new Error(`another Play edit is running (lock ${LOCK})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  try {
    return await fn();
  } finally {
    try {
      unlinkSync(LOCK);
    } catch {}
  }
}

// Deleted (another edit was opened) or expired (a slow upload outlived it): both are retried once.
export const editDeleted = (err) => /This Edit has been deleted|This edit has expired/i.test(String(err?.message ?? err));
