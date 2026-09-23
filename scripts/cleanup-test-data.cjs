#!/usr/bin/env node
/*
 * Removes everything the smoke/acceptance scripts leave behind in the local development stack
 * (plan-devam Faz A1/A2), so Keşfet, the map and search show real and demo data only.
 *
 *   node scripts/cleanup-test-data.cjs [--gateway http://localhost:5080] [--backup] [--dry-run]
 *
 * Test accounts are local accounts (@blinkr.local / @blinkr.test) that are NOT demo data. Demo data is
 * kept: sentetik_01..08 (seed-osmaniye.cjs) and the seed-chat.cjs contacts (first_last names).
 * New test accounts all start with "e2e_".
 *
 * Order matters and follows the real pipeline:
 *   1. Their signals are deleted through the API (DELETE /api/posts/{id}) by a short-lived admin account,
 *      so EventStore gets a PostDeleted event and the worker and PlaceService projections follow.
 *   2. Their chat conversations/messages, notifications and stories are removed from Mongo
 *      (the chat API has no delete endpoint).
 *   3. The accounts are deleted from Postgres (follows, friendships, blocks, reports, saved places cascade).
 * --backup first writes pg_dump + mongodump into artifacts/backups/<time>/ (git-ignored).
 * Idempotent: running it again only finds what is left.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, token, index, all) => {
  if (token.startsWith('--')) acc.push([token.slice(2), all[index + 1] && !all[index + 1].startsWith('--') ? all[index + 1] : 'true']);
  return acc;
}, []));
const GATEWAY = (args.gateway || 'http://localhost:5080').replace(/\/$/, '');
const DRY = args['dry-run'] === 'true';
const PG = 'blinkr_postgres';
const MONGO = 'blinkr_mongodb';
// Demo accounts that must survive: synthetic users and the seed-chat contacts.
const DEMO = '^(sentetik_[0-9]{2}|[a-z]+_[a-z]+)$';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const psql = (sql) => execFileSync('docker', ['exec', '-i', PG, 'sh', '-c', 'psql -U "$POSTGRES_USER" -d blinkr_identity -t -A -v ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' }).trim();
// Scripts go in as a file: the id lists are too long for a command line, and stdin makes mongosh echo its prompt.
const mongo = (db, script) => {
  const local = path.join(require('node:os').tmpdir(), `blinkr-cleanup-${process.pid}.js`);
  fs.writeFileSync(local, script);
  execFileSync('docker', ['cp', local, `${MONGO}:/tmp/blinkr-cleanup.js`]);
  fs.unlinkSync(local);
  return execFileSync('docker', ['exec', MONGO, 'mongosh', '--quiet', db, '/tmp/blinkr-cleanup.js'], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
};

async function api(method, route, { token, body } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    let response;
    try {
      response = await fetch(GATEWAY + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    } catch (error) { if (attempt >= 6) throw error; await sleep(500 * 2 ** attempt); continue; }
    if ((response.status === 429 || response.status >= 500) && attempt < 8) {
      const retry = Number(response.headers.get('retry-after')) || 0;
      await sleep(Math.max(retry * 1000, 500 * 2 ** Math.min(attempt, 5))); continue;
    }
    const text = await response.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
    return { status: response.status, json };
  }
}

async function main() {
  const ids = psql(`SELECT "Id" FROM "Users" WHERE ("Email" LIKE '%@blinkr.local' OR "Email" LIKE '%@blinkr.test') AND "UserName" !~ '${DEMO}';`)
    .split('\n').map((s) => s.trim()).filter(Boolean);
  console.log(`Test accounts: ${ids.length}`);
  if (ids.length === 0) return;

  const idList = JSON.stringify(ids);
  const postIds = JSON.parse(mongo('BlinkrReadModel', `const ids=${idList};
    print(JSON.stringify([...db.posts.find({AuthorId:{$in:ids}},{_id:1}).toArray(), ...db.posts_moderated.find({AuthorId:{$in:ids}},{_id:1}).toArray()].map(d=>String(d._id))));`) || '[]');
  console.log(`Their signals: ${postIds.length}`);
  if (DRY) { console.log('Dry run: nothing deleted.'); return; }

  if (args.backup === 'true') {
    const dir = path.resolve(__dirname, '..', 'artifacts', 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'identity.sql'), execFileSync('docker', ['exec', PG, 'sh', '-c', 'pg_dump -U "$POSTGRES_USER" blinkr_identity'], { encoding: 'utf8', maxBuffer: 1 << 30 }));
    execFileSync('docker', ['exec', MONGO, 'sh', '-c', 'rm -rf /tmp/blinkr-backup && mongodump --quiet --out /tmp/blinkr-backup']);
    execFileSync('docker', ['cp', `${MONGO}:/tmp/blinkr-backup`, path.join(dir, 'mongo')]);
    console.log(`Backup written to ${dir}`);
  }

  // 1. Signals, through the API, by a temporary admin (deleted with the other test accounts at the end).
  if (postIds.length > 0) {
    const name = `e2e_cleanup_${Date.now()}`.slice(0, 30);
    const password = `Cleanup!${Math.random().toString(36).slice(2)}A1`;
    const reg = await api('POST', '/api/auth/register', { body: { userName: name, email: `${name}@blinkr.local`, password } });
    if (!reg.json?.userId) throw new Error(`Could not create the cleanup account: HTTP ${reg.status}`);
    ids.push(reg.json.userId);
    psql(`UPDATE "Users" SET "Role"='Admin' WHERE "Id"='${reg.json.userId}';`);
    const login = await api('POST', '/api/auth/login', { body: { userName: `${name}@blinkr.local`, password } });
    const token = login.json?.token;
    if (!token) throw new Error('Cleanup admin could not sign in.');
    let done = 0; let failed = 0;
    const queue = [...postIds];
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length > 0) {
        const id = queue.shift();
        const r = await api('DELETE', `/api/posts/${id}`, { token });
        if (r.status === 204 || r.status === 404) done += 1; else { failed += 1; console.warn(`  ${id}: HTTP ${r.status}`); }
        if ((done + failed) % 100 === 0) console.log(`  ${done + failed}/${postIds.length}`);
      }
    }));
    console.log(`Signals deleted: ${done}, failed: ${failed}`);
    // Let the projections catch up before the accounts disappear.
    for (let i = 0; i < 60; i += 1) {
      const left = Number(mongo('BlinkrReadModel', `print(db.posts.countDocuments({AuthorId:{$in:${idList}}}) + db.posts_moderated.countDocuments({AuthorId:{$in:${idList}}}))`));
      if (left === 0) break;
      await sleep(1000);
    }
  }

  // 2. Mongo data without a delete API.
  const allIds = JSON.stringify(ids);
  console.log(mongo('blinkr_notifications', `const ids=${allIds};
    const convs=db.conversations.find({ParticipantIds:{$in:ids}},{_id:1}).toArray().map(c=>String(c._id));
    const m=db.chat_messages.deleteMany({ConversationId:{$in:convs}}).deletedCount;
    const c=db.conversations.deleteMany({ParticipantIds:{$in:ids}}).deletedCount;
    const n=db.notifications.deleteMany({$or:[{UserId:{$in:ids}},{ActorUserId:{$in:ids}}]}).deletedCount;
    const s=db.stories.deleteMany({AuthorId:{$in:ids}}).deletedCount;
    print("Conversations "+c+", messages "+m+", notifications "+n+", stories "+s);`));
  console.log(mongo('BlinkrPlaces', `const ids=${allIds};
    print("Place signals "+(db.place_signals.deleteMany({AuthorId:{$in:ids}}).deletedCount + db.place_signals_moderated.deleteMany({AuthorId:{$in:ids}}).deletedCount));`));

  // 3. The accounts themselves (dependent rows cascade).
  const deleted = psql(`WITH d AS (DELETE FROM "Users" WHERE "Id" IN (${ids.map((id) => `'${id}'`).join(',')}) RETURNING 1) SELECT count(*) FROM d;`);
  console.log(`Accounts deleted: ${deleted}`);
}

main().catch((error) => { console.error(error.message); process.exit(1); });
