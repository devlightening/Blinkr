#!/usr/bin/env node
/*
 * Removes what scripts/seed-osmaniye.cjs created, through the public API as each post's owner
 * (DELETE /api/posts/{id}), so the deletion is an event like any other and projections follow.
 *
 *   node scripts/cleanup-synthetic.cjs [--gateway http://localhost:5080] [--concurrency 4]
 *                                      [--only ahmet|synthetic] [--limit N] [--dry-run]
 *
 * Reads artifacts/synthetic/osmaniye-manifest.json. Only ids listed there are touched; ahmet's 6
 * pre-existing posts are never in the manifest. Deleting many posts is throttled by the same
 * per-device rate limit as creating them (100/min); for a full clean-up start BlogService with
 * RateLimiting__GlobalPermitLimit=30000, exactly as for the seed.
 */
const fs = require('node:fs');
const path = require('node:path');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, token, index, all) => {
  if (token.startsWith('--')) acc.push([token.slice(2), all[index + 1] && !all[index + 1].startsWith('--') ? all[index + 1] : 'true']);
  return acc;
}, []));
const GATEWAY = (args.gateway || 'http://localhost:5080').replace(/\/$/, '');
const CONCURRENCY = Math.max(1, Math.min(12, Number(args.concurrency || 4)));
const LIMIT = Number(args.limit || Infinity);
const DRY = args['dry-run'] === 'true';
const MANIFEST = path.resolve(__dirname, '..', 'artifacts', 'synthetic', 'osmaniye-manifest.json');
const SYNTHETIC_PASSWORD = 'Sentetik!2026';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function api(method, route, { token, body } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    let response;
    try {
      response = await fetch(GATEWAY + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    } catch (error) { if (attempt >= 5) throw error; await sleep(500 * 2 ** attempt); continue; }
    if ((response.status === 429 || response.status >= 500) && attempt < 5) { await sleep(500 * 2 ** attempt); continue; }
    const text = await response.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
    return { status: response.status, json };
  }
}

(async () => {
  if (!fs.existsSync(MANIFEST)) { console.log('No manifest found - nothing to clean up.'); return; }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const work = []; // { id, userName }
  if (args.only !== 'synthetic') for (const id of manifest.ahmet || []) work.push({ id, userName: 'ahmet' });
  if (args.only !== 'ahmet') for (const item of manifest.synthetic || []) work.push({ id: item.id, userName: item.user });
  const todo = work.slice(0, LIMIT);
  console.log(`${todo.length} post(s) to delete${DRY ? ' (dry run)' : ''}`);
  if (DRY || todo.length === 0) return;

  const tokens = {};
  const tokenFor = async (userName) => {
    if (tokens[userName]) return tokens[userName];
    const credentials = userName === 'ahmet' ? { userName: 'ahmet@gmail.com', password: 'ahmet' } : { userName: `${userName}@blinkr.local`, password: SYNTHETIC_PASSWORD };
    const login = await api('POST', '/api/auth/login', { body: credentials });
    if (login.status !== 200) throw new Error(`cannot log in as ${userName}: HTTP ${login.status}`);
    return (tokens[userName] = login.json.token);
  };

  let next = 0; let deleted = 0; let missing = 0; let failed = 0;
  const removed = new Set();
  const worker = async () => {
    while (next < todo.length) {
      const item = todo[next++];
      const response = await api('DELETE', `/api/posts/${item.id}`, { token: await tokenFor(item.userName) });
      if (response.status === 204 || response.status === 200) { deleted += 1; removed.add(item.id); }
      else if (response.status === 404) { missing += 1; removed.add(item.id); }
      else failed += 1;
      if ((deleted + missing + failed) % 500 === 0) console.log(`  ${deleted + missing + failed}/${todo.length} deleted=${deleted} alreadyGone=${missing} failed=${failed}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  manifest.ahmet = (manifest.ahmet || []).filter((id) => !removed.has(id));
  manifest.synthetic = (manifest.synthetic || []).filter((item) => !removed.has(item.id));
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest));
  console.log(`Done: deleted=${deleted} alreadyGone=${missing} failed=${failed}. Left in manifest: ahmet=${manifest.ahmet.length} synthetic=${manifest.synthetic.length}`);
})().catch((error) => { console.error('CLEANUP FAILED:', error.message); process.exit(1); });
