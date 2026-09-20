#!/usr/bin/env node
/*
 * Synthetic test data for Osmaniye, created ONLY through the public Gateway API so every post flows
 * through the real pipeline (EventStoreDB -> RabbitMQ -> projection worker -> Mongo).
 *
 *   node scripts/seed-osmaniye.cjs [--gateway http://localhost:5080] [--ahmet-total 20030]
 *                                  [--concurrency 4] [--places 24] [--free-signals 250] [--skip-bulk]
 *
 * What it creates
 *   1. Synthetic users sentetik_01..sentetik_08 (password below).
 *   2. Place-anchored posts on REAL Osmaniye places from the catalog, observed at the place itself
 *      (so the server marks them VERIFIED_LIVE), some with generated photos.
 *   3. Free-coordinate signals scattered over the city.
 *   4. Bulk posts for the existing user ahmet until he has --ahmet-total posts in total. These expire
 *      after 30 minutes so the live map is not flooded for hours; the profile list keeps them.
 *
 * Every created post id is written to artifacts/synthetic/osmaniye-manifest.json so
 * scripts/cleanup-synthetic.cjs can remove them again. The run is resumable: it only creates what
 * ahmet is still missing.
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, token, index, all) => {
  if (token.startsWith('--')) acc.push([token.slice(2), all[index + 1] && !all[index + 1].startsWith('--') ? all[index + 1] : 'true']);
  return acc;
}, []));
const GATEWAY = (args.gateway || 'http://localhost:5080').replace(/\/$/, '');
const AHMET = { userName: 'ahmet@gmail.com', password: 'ahmet' };
const AHMET_TOTAL = Number(args['ahmet-total'] || 20030);
const CONCURRENCY = Math.max(1, Math.min(12, Number(args.concurrency || 4)));
const PLACE_COUNT = Number(args.places || 24);
const FREE_SIGNALS = Number(args['free-signals'] || 250);
const SYNTHETIC_PASSWORD = 'Sentetik!2026';
const OSMANIYE = { lat: 37.0746, lon: 36.2464, box: { minLat: 37.03, maxLat: 37.13, minLon: 36.19, maxLon: 36.31 } };
const MANIFEST = path.resolve(__dirname, '..', 'artifacts', 'synthetic', 'osmaniye-manifest.json');

// ---------- small helpers ----------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (items) => items[Math.floor(Math.random() * items.length)];
const weighted = (items) => { let r = Math.random() * items.reduce((s, i) => s + i.w, 0); for (const item of items) { r -= item.w; if (r <= 0) return item; } return items[0]; };

async function api(method, route, { token, body, raw, headers } = {}) {
  const init = { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(headers || {}) } };
  if (raw) init.body = raw;
  else if (body !== undefined) { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
  for (let attempt = 0; ; attempt += 1) {
    let response;
    try { response = await fetch(GATEWAY + route, init); } catch (error) {
      if (attempt >= 5) throw error;
      await sleep(500 * 2 ** attempt); continue;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < 5) { await sleep(500 * 2 ** attempt); continue; }
    const text = await response.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
    return { status: response.status, json, text, headers: response.headers };
  }
}

// ---------- generated photo (no dependencies): flat gradient PNG ----------
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buffer) => { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([length, body, crc]); };
function makePng(width, height, hue) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x += 1) {
      const t = (x / width + y / height) / 2;
      const [r, g, b] = hsl((hue + t * 40) % 360, 0.45, 0.28 + 0.22 * t);
      row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}
function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l); const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [f(0), f(8), f(4)];
}
async function uploadPhoto(token, hue) {
  const png = makePng(320, 240, hue);
  const presign = await api('POST', '/api/v1/media/presign', { token, body: { contentType: 'image/png', fileName: 'osmaniye.png', mediaType: 'Image', sizeBytes: png.length } });
  if (presign.status !== 200 && presign.status !== 201) throw new Error(`presign failed: HTTP ${presign.status} ${presign.text.slice(0, 120)}`);
  const uploadPath = presign.json.uploadUrl.startsWith('http') ? new URL(presign.json.uploadUrl).pathname + new URL(presign.json.uploadUrl).search : presign.json.uploadUrl;
  const put = await api('PUT', uploadPath, { token, raw: png, headers: { 'Content-Type': 'image/png', ...(presign.json.headers || {}) } });
  if (put.status >= 300) throw new Error(`upload failed: HTTP ${put.status}`);
  return { mediaId: presign.json.mediaId, mediaType: 'Image' };
}

// ---------- content ----------
const NEIGHBOURHOODS = ['Osmaniye Merkez', 'Yıldırım Beyazıt Mh.', 'Raufbey Mh.', 'Adnan Menderes Mh.', 'Mimar Sinan Mh.', 'Alparslan Türkeş Bulvarı', 'Kent Meydanı', 'Masal Parkı'];
const SIGNALS = [
  { type: 'Crowd', w: 30, texts: [['Şu an kalabalık', 'Busy'], ['Yer bulmak zor', 'Busy'], ['Sakin, rahat oturulur', 'Calm'], ['Biraz hareketli', 'Moderate']] },
  { type: 'Queue', w: 18, texts: [['Sıra yok', 'None'], ['Kısa bir bekleme var', '5To15'], ['Uzun sıra var', 'Over15']] },
  { type: 'TemporaryStatus', w: 8, texts: [['Geçici olarak kapalı', 'Closed'], ['Açık, çalışıyor', 'Open']] },
  { type: 'Event', w: 8, texts: [['Etkinlik başladı', 'Started'], ['Etkinlik bitti', 'Ended']] },
  { type: 'Offer', w: 6, texts: [['Bugün indirim var', 'Available'], ['Kampanya sona erdi', 'Ended']] },
  { type: 'GeneralObservation', w: 30, texts: [['Ortam çok güzel', null], ['Hava güzel, herkes dışarıda', null], ['Yol çalışması var', null], ['Park dolu', null], ['Trafik yoğun', null]] },
];
const buildSignal = () => { const kind = weighted(SIGNALS); const [text, value] = pick(kind.texts); return { type: kind.type, text, value }; };
const iso = (minutesFromNow) => new Date(Date.now() + minutesFromNow * 60_000).toISOString();

// ---------- manifest ----------
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { createdAt: new Date().toISOString(), users: {}, ahmet: [], synthetic: [] };
manifest.users ||= {}; manifest.ahmet ||= []; manifest.synthetic ||= [];
const saveManifest = () => { fs.mkdirSync(path.dirname(MANIFEST), { recursive: true }); fs.writeFileSync(MANIFEST, JSON.stringify(manifest)); };

// ---------- users ----------
async function ensureUser(userName) {
  const email = `${userName}@blinkr.local`;
  let response = await api('POST', '/api/auth/login', { body: { userName: email, password: SYNTHETIC_PASSWORD } });
  if (response.status !== 200) {
    response = await api('POST', '/api/auth/register', { body: { userName, email, password: SYNTHETIC_PASSWORD } });
    if (response.status !== 200 && response.status !== 201) throw new Error(`cannot create ${userName}: HTTP ${response.status} ${response.text.slice(0, 120)}`);
  }
  manifest.users[userName] = { userId: response.json.userId, email };
  return { userName, token: response.json.token, userId: response.json.userId };
}

async function createPost(user, post) {
  const response = await api('POST', '/api/posts', { token: user.token, body: post });
  if (response.status !== 201) return { ok: false, status: response.status, error: response.text.slice(0, 160) };
  const id = response.json && (response.json.postId || response.json.PostId || response.json.id);
  return { ok: true, id };
}

// ---------- main ----------
(async () => {
  const started = Date.now();
  console.log(`Gateway ${GATEWAY} | concurrency ${CONCURRENCY}`);
  const health = await api('GET', '/health').catch(() => ({ status: 0 }));
  if (health.status !== 200) throw new Error('Gateway is not healthy; start the backend first.');

  const login = await api('POST', '/api/auth/login', { body: AHMET });
  if (login.status !== 200) throw new Error(`Cannot log in as ahmet@gmail.com: HTTP ${login.status}`);
  const ahmet = { userName: login.json.userName, token: login.json.token, userId: login.json.userId };
  manifest.users.ahmet = { userId: ahmet.userId, email: AHMET.userName };
  console.log(`Logged in as ${ahmet.userName} (${ahmet.userId})`);

  // 1-3) supporting map data (skipped when already present in the manifest)
  if (manifest.synthetic.length === 0) {
    const users = [];
    for (let i = 1; i <= 8; i += 1) users.push(await ensureUser(`sentetik_${String(i).padStart(2, '0')}`));
    console.log(`Synthetic users ready: ${users.length} (password ${SYNTHETIC_PASSWORD})`);

    const nearby = await api('GET', `/api/places/nearby?lat=${OSMANIYE.lat}&lon=${OSMANIYE.lon}&radiusMeters=1500&limit=${PLACE_COUNT}`);
    const places = (nearby.json || []).filter((p) => p.externalProvider === 'osm').slice(0, PLACE_COUNT);
    console.log(`Real Osmaniye places found: ${places.length}`);
    let withPhotos = 0;
    for (const place of places) {
      const posts = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < posts; i += 1) {
        const user = pick(users); const signal = buildSignal();
        let media;
        if (withPhotos < 12 && Math.random() < 0.45) { try { media = [await uploadPhoto(user.token, Math.floor(rand(0, 360)))]; withPhotos += 1; } catch (error) { console.log('  photo skipped:', error.message); } }
        const result = await createPost(user, {
          title: signal.text, content: `${place.name}: ${signal.text.toLowerCase()}.`, latitude: place.latitude, longitude: place.longitude, accuracyMeters: 20,
          observationLatitude: place.latitude, observationLongitude: place.longitude, observationAccuracyMeters: 20, locationName: place.name, placeId: place.id,
          signalType: signal.type, signalValue: signal.value, audienceType: 'Public', identityDisclosure: 'LimitedProfile', locationPrecision: 'PlaceCenter',
          expiresAt: iso(180), ...(media ? { media } : {}),
        });
        if (result.ok) manifest.synthetic.push({ id: result.id, user: user.userName }); else console.log(`  place post rejected (${result.status}) ${place.name}`);
      }
    }
    console.log(`Place posts: ${manifest.synthetic.length} (photos: ${withPhotos})`);

    let free = 0;
    for (let i = 0; i < FREE_SIGNALS; i += 1) {
      const user = pick(users); const signal = buildSignal();
      const result = await createPost(user, {
        title: signal.text, content: `${pick(NEIGHBOURHOODS)}: ${signal.text.toLowerCase()}.`, latitude: rand(OSMANIYE.box.minLat, OSMANIYE.box.maxLat), longitude: rand(OSMANIYE.box.minLon, OSMANIYE.box.maxLon),
        accuracyMeters: 25, locationName: pick(NEIGHBOURHOODS), signalType: signal.type, signalValue: signal.value, audienceType: 'Public',
        identityDisclosure: Math.random() < 0.15 ? 'AnonymousMap' : 'LimitedProfile', locationPrecision: 'ApproximateArea', expiresAt: iso(180),
      });
      if (result.ok) { manifest.synthetic.push({ id: result.id, user: user.userName }); free += 1; }
    }
    console.log(`Free-coordinate signals: ${free}`);
    saveManifest();
  } else {
    console.log(`Supporting data already in manifest (${manifest.synthetic.length} posts) - skipping`);
  }

  // 4) bulk posts for ahmet
  if (args['skip-bulk']) { console.log('--skip-bulk: done.'); return; }
  const current = await api('GET', `/api/posts-read/author/${ahmet.userId}?page=1&pageSize=1`, { token: ahmet.token });
  const have = Number(current.headers.get('x-total-count') || 0);
  const missing = Math.max(0, AHMET_TOTAL - have);
  console.log(`ahmet has ${have} posts; creating ${missing} to reach ${AHMET_TOTAL}`);
  let done = 0; let failed = 0; let next = 0; const startBulk = Date.now();
  const worker = async () => {
    while (next < missing) {
      const n = have + (++next); // running number shown in the post, so ordering can be checked in the app
      const signal = buildSignal(); const hood = pick(NEIGHBOURHOODS);
      const result = await createPost(ahmet, {
        title: signal.text, content: `${hood}: ${signal.text.toLowerCase()}. (#${String(n).padStart(5, '0')})`, latitude: rand(OSMANIYE.box.minLat, OSMANIYE.box.maxLat), longitude: rand(OSMANIYE.box.minLon, OSMANIYE.box.maxLon),
        accuracyMeters: 25, locationName: hood, signalType: signal.type, signalValue: signal.value, audienceType: 'Public',
        identityDisclosure: Math.random() < 0.1 ? 'AnonymousMap' : 'LimitedProfile', locationPrecision: 'ApproximateArea', expiresAt: iso(30),
      });
      if (result.ok) { manifest.ahmet.push(result.id); done += 1; } else { failed += 1; if (failed > 50 && failed > done * 0.05) throw new Error(`Too many failures (${failed}); last: ${result.status} ${result.error}`); }
      if ((done + failed) % 500 === 0) {
        saveManifest();
        const rate = done / ((Date.now() - startBulk) / 1000);
        console.log(`  ${done + failed}/${missing}  ok=${done} failed=${failed}  ${rate.toFixed(1)}/s  eta ${Math.round((missing - done - failed) / Math.max(rate, 0.1) / 60)} min`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  saveManifest();
  console.log(`Bulk finished: ok=${done} failed=${failed} in ${Math.round((Date.now() - started) / 1000)}s`);
})().catch((error) => { saveManifest(); console.error('SEED FAILED:', error.message); process.exit(1); });
