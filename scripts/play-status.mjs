#!/usr/bin/env node
// npm run play-status: read-only look at every track's releases. Opens an edit,
// reads, and deletes it without committing. Don't run while play-publish is
// running: a second edit on the same app deletes the first one.
import { API, PKG, call, token, withPlayLock } from './play-auth.mjs';

await withPlayLock(async () => {
  const tok = await token();
  const edit = await call(tok, 'POST', `${API}/edits`, {});
  try {
    const { tracks = [] } = await call(tok, 'GET', `${API}/edits/${edit.id}/tracks`);
    console.log(PKG);
    for (const t of tracks) {
      for (const r of t.releases ?? []) {
        console.log(`  ${t.track.padEnd(10)} ${String(r.status).padEnd(10)} ${r.name ?? ''} vc${(r.versionCodes ?? []).join(',')}`);
      }
      if (!t.releases?.length) console.log(`  ${t.track.padEnd(10)} (empty)`);
    }
  } finally {
    await call(tok, 'DELETE', `${API}/edits/${edit.id}`).catch(() => {});
  }
});
