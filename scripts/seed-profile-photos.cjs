#!/usr/bin/env node
/*
 * Profile photos and display names for the seeded test people (D-032).
 *
 *   node scripts/seed-profile-photos.cjs --photos <folder> [--gateway http://localhost:5080]
 *
 * The folder holds <userName>-l.jpg (640 px) and <userName>-s.jpg (160 px) per person, the same two sizes the app
 * makes on the phone. Use AI-generated faces of people who do not exist (never photos of real people) and no children.
 * People without files keep their drawn avatar, as some real users do. Works for the seed-insta.cjs and
 * seed-scenarios.cjs people (both passwords are tried).
 */
const fs = require('node:fs');
const path = require('node:path');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, token, index, all) => {
  if (token.startsWith('--')) acc.push([token.slice(2), all[index + 1] && !all[index + 1].startsWith('--') ? all[index + 1] : 'true']);
  return acc;
}, []));
const GATEWAY = (args.gateway || 'http://localhost:5080').replace(/\/$/, '');
const PHOTOS = args.photos ? path.resolve(args.photos) : null;
const PASSWORDS = ['Blinkr!Insta2026', 'Blinkr!Senaryo2026'];

const DISPLAY_NAMES = {
  'mehmetcan.0328': 'Mehmet Can', 'berfin.k_': 'Berfin', 'sude.arslnn': 'Sude Arslan', 'yusuf_kdrl': 'Yusuf',
  'emirhan.80': 'Emirhan 🔧', 'nisa.ozturkk': 'Nisa Öztürk', 'okan.usta80': 'Okan Usta', 'zehra.anne80': 'Zehra',
  'tuana.yldzz': 'tuana', 'furkan.cvk': 'Furkan Çevik', 'ahmet.esnaf80': 'Ahmet Yılmaz', 'ece.duzici': 'Ece',
  'kerem.gezgin': 'Kerem | Gezgin', 'dilara.ss': 'Dilara', 'selim.hoca': 'Selim Hoca', 'berkay.fit': 'Berkay | Coach',
  'merve.kuafor80': 'Merve Hair Studio', 'ayse.osm': 'Ayşe', 'mert_bisiklet': 'Mert 🚲', 'zeynep.kahve': 'Zeynep',
  'can.ozturk': 'Can Öztürk', 'elif_ogretmen': 'Elif Öğretmen', 'burak.eczaci': 'Ecz. Burak', 'selin.yoga': 'Selin',
  'emre_hoca': 'Emre',
};

async function login(userName) {
  for (const password of PASSWORDS) {
    const r = await fetch(`${GATEWAY}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: `${userName}@blinkr.local`, password }) });
    if (r.ok) return r.json();
  }
  return null;
}

(async () => {
  if (!PHOTOS) throw new Error('--photos <folder> is required');
  let photos = 0; let names = 0;
  for (const [userName, displayName] of Object.entries(DISPLAY_NAMES)) {
    const auth = await login(userName);
    if (!auth) { console.log(`  ${userName}: cannot sign in, skipped`); continue; }
    const headers = { Authorization: `Bearer ${auth.token}` };
    const profile = await fetch(`${GATEWAY}/api/users/me`, { headers }).then((r) => r.json());
    const named = await fetch(`${GATEWAY}/api/users/me/profile`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ bio: profile.bio ?? null, displayName }) });
    if (named.ok) names += 1;
    const large = path.join(PHOTOS, `${userName}-l.jpg`);
    const small = path.join(PHOTOS, `${userName}-s.jpg`);
    if (!fs.existsSync(large) || !fs.existsSync(small)) { console.log(`  ${userName}: name only (no photo files)`); continue; }
    const form = new FormData();
    form.append('large', new Blob([fs.readFileSync(large)], { type: 'image/jpeg' }), 'large.jpg');
    form.append('small', new Blob([fs.readFileSync(small)], { type: 'image/jpeg' }), 'small.jpg');
    const r = await fetch(`${GATEWAY}/api/users/me/photo`, { method: 'PUT', headers, body: form });
    if (r.ok) photos += 1; else console.log(`  ${userName}: photo HTTP ${r.status} ${(await r.text()).slice(0, 120)}`);
  }
  console.log(`done: ${photos} photos, ${names} display names`);
})().catch((error) => { console.error(error); process.exit(1); });
