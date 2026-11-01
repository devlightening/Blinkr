#!/usr/bin/env node
/*
 * Demo data for store screenshots and the review team (plan-devam G12). Deterministic: the same places (the first
 * catalog places near the centre, ordered by id), the same texts and types every run; no photos of people (text
 * signals only), drawn avatars. Everything goes through the public Gateway API, so it flows through the real pipeline.
 *
 *   node scripts/seed-demo.cjs [--gateway http://localhost:5080] [--lat 37.0746 --lon 36.2464]
 *   node scripts/seed-demo.cjs --reset        deletes (through the API) only the signals this script created
 *
 * Accounts: demo_ayse, demo_mert, demo_elif (password below; birth year 1994). Created post ids are kept in
 * artifacts/demo/demo-manifest.json; --reset deletes exactly those, as their authors.
 */
const fs = require('node:fs');
const path = require('node:path');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, token, index, all) => {
  if (token.startsWith('--')) acc.push([token.slice(2), all[index + 1] && !all[index + 1].startsWith('--') ? all[index + 1] : 'true']);
  return acc;
}, []));
const GATEWAY = (args.gateway || 'http://localhost:5080').replace(/\/$/, '');
const CENTER = { lat: Number(args.lat || 37.0746), lon: Number(args.lon || 36.2464) };
const PASSWORD = 'DemoBlinkr!2026';
const MANIFEST = path.resolve(__dirname, '..', 'artifacts', 'demo', 'demo-manifest.json');
const USERS = [
  { userName: 'demo_ayse', avatarKey: '134' },
  { userName: 'demo_mert', avatarKey: '253' },
  { userName: 'demo_elif', avatarKey: '412' },
];
// type, value, text - short, concrete, the kind of thing that helps someone decide.
const SIGNALS = [
  ['Queue', '5To15', 'Kasada iki kişi bekliyor, hızlı ilerliyor.'],
  ['Crowd', 'Calm', 'Bahçede boş masa var, sessiz.'],
  ['Crowd', 'Busy', 'Öğle arası, içerisi dolu.'],
  ['TemporaryStatus', 'Open', 'Nöbetçi, kapı açık.'],
  ['Offer', 'Available', 'Simit + çay bugün indirimli.'],
  ['Event', 'Started', 'Akşam canlı müzik başladı.'],
  ['GeneralObservation', null, 'Yeni boyanmış, oturma alanı genişlemiş.'],
  ['Queue', 'None', 'Şu an sıra yok.'],
];

async function api(method, route, { token, body } = {}) {
  const response = await fetch(`${GATEWAY}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { status: response.status, json };
}

async function signIn(user) {
  const email = `${user.userName}@blinkr.demo`;
  let r = await api('POST', '/api/auth/login', { body: { userName: email, password: PASSWORD } });
  if (r.status !== 200) {
    r = await api('POST', '/api/auth/register', { body: { userName: user.userName, email, password: PASSWORD, birthYear: 1994 } });
    if (r.status !== 200) throw new Error(`${user.userName}: register HTTP ${r.status}`);
  }
  const token = r.json.token;
  await api('PUT', '/api/users/me/avatar', { token, body: { avatarKey: user.avatarKey } });
  return token;
}

const readManifest = () => { try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return { posts: [] }; } };
const writeManifest = (m) => { fs.mkdirSync(path.dirname(MANIFEST), { recursive: true }); fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2)); };

async function reset() {
  const manifest = readManifest();
  const tokens = {};
  let deleted = 0;
  for (const entry of manifest.posts) {
    const user = USERS.find((u) => u.userName === entry.userName);
    if (!user) continue;
    tokens[user.userName] ??= await signIn(user);
    const r = await api('DELETE', `/api/posts/${entry.postId}`, { token: tokens[user.userName] });
    if (r.status === 200 || r.status === 204 || r.status === 404) deleted++;
  }
  writeManifest({ posts: [] });
  console.log(`demo reset: ${deleted} of ${manifest.posts.length} signals removed`);
}

async function seed() {
  const tokens = [];
  for (const user of USERS) tokens.push(await signIn(user));
  const nearby = await api('GET', `/api/places/nearby?lat=${CENTER.lat}&lon=${CENTER.lon}&radiusMeters=1500`, { token: tokens[0] });
  const places = (Array.isArray(nearby.json) ? nearby.json : nearby.json?.items ?? [])
    .filter((p) => p.name).sort((a, b) => String(a.id).localeCompare(String(b.id))).slice(0, SIGNALS.length);
  if (places.length === 0) throw new Error('no catalog places near the centre - import the catalog first');
  const manifest = readManifest();
  for (const [index, [type, value, text]] of SIGNALS.entries()) {
    const place = places[index % places.length];
    const userIndex = index % USERS.length;
    const r = await api('POST', '/api/posts', {
      token: tokens[userIndex],
      body: {
        title: '', content: text, latitude: place.latitude, longitude: place.longitude, accuracyMeters: 15,
        observationLatitude: place.latitude, observationLongitude: place.longitude, observationAccuracyMeters: 15,
        locationName: place.name, placeId: place.id, signalType: type, signalValue: value,
        audienceType: 'Public', identityDisclosure: 'LimitedProfile', locationPrecision: 'PlaceCenter',
      },
    });
    if (r.status !== 201 && r.status !== 200) { console.log(`skip ${place.name}: HTTP ${r.status}`); continue; }
    manifest.posts.push({ postId: r.json.postId, userName: USERS[userIndex].userName });
    console.log(`${USERS[userIndex].userName} → ${place.name}: ${type}${value ? ` ${value}` : ''}`);
  }
  writeManifest(manifest);
  console.log(`demo seed: ${manifest.posts.length} signals in the manifest`);
}

(args.reset === 'true' ? reset() : seed()).catch((err) => { console.error(err.message); process.exit(1); });
