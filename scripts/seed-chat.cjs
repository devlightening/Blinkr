#!/usr/bin/env node
/**
 * Synthetic chat contacts for the user ahmet, so the Sohbet tab can be tested with a full inbox.
 *
 *   node scripts/seed-chat.cjs [--gateway http://localhost:5080] [--count 20] [--force]
 *
 * Creates (or re-uses) up to 20 synthetic users named like real Osmaniye residents. They use the same
 * convention as scripts/seed-osmaniye.cjs (<userName>@blinkr.local / password Sentetik!2026) and start a
 * 1:1 conversation with ahmet@gmail.com through the public chat API, then exchange place-decision style
 * messages. A few conversations end with unread messages so the unread badge can be tested.
 *
 * Idempotent: a conversation that already has messages is left alone unless --force is given.
 * Everything created is listed in artifacts/synthetic/chat-manifest.json.
 *
 * The chat API has no delete endpoint, so removing the conversations is a database operation:
 *   node scripts/seed-chat.cjs --print-cleanup    prints the mongosh command for the manifest's conversation ids
 * Nothing here talks to a database directly.
 */
const fs = require('fs');
const path = require('path');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, token, index, all) => {
  if (token.startsWith('--')) acc.push([token.slice(2), all[index + 1] && !all[index + 1].startsWith('--') ? all[index + 1] : 'true']);
  return acc;
}, []));
const GATEWAY = (args.gateway || 'http://localhost:5080').replace(/\/$/, '');
const COUNT = Math.max(1, Math.min(20, Number(args.count || 20)));
const AHMET = { userName: 'ahmet@gmail.com', password: 'ahmet' };
const PASSWORD = 'Sentetik!2026';
const MANIFEST = path.resolve(__dirname, '..', 'artifacts', 'synthetic', 'chat-manifest.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// [userName, unreadTail, script]. Script lines: '<' = the other person writes, '>' = ahmet writes.
// unreadTail = how many of the person's LAST messages ahmet has not read yet.
const PEOPLE = [
  ['elif_kaya', 2, ['< Selam Ahmet, akşam Kent Meydanı\'na gitmeyi düşünüyorum', '> Selam! Şu an oraya yakınım, bakıp yazayım', '> Orta yoğunlukta, oturacak yer var', '< Süper, sağ ol', '< Ben de 20 dk sonra orada olurum']],
  ['mehmet_demir', 0, ['< Masal Parkı bugün kalabalık mı?', '> Az önce geçtim, çocuklu aileler var ama sakin', '< Tamam, o zaman çocukları götüreyim', '> İyi eğlenceler']],
  ['zeynep_arslan', 1, ['< Eczane sırası nasıldı orada?', '> Nöbetçi olan mı? Sıra uzundu, 15 dakika falan', '< Off, başka eczane var mı yakında?', '> Raufbey tarafındakinde sıra yoktu', '< Teşekkürler, oraya gidiyorum']],
  ['burak_yilmaz', 0, ['< Hafta sonu yürüyüş için parka gelir misin?', '> Olur, saat kaçta?', '< 10 gibi', '> Tamam, görüşürüz']],
  ['ayse_celik', 3, ['< Ahmet bugün çarşı çok kalabalık', '< Yer bulamadım, alternatif önerir misin?', '< Kafe mi park mı düşünüyorum']],
  ['emre_aydin', 0, ['> Emre, pazar yeri bugün açık mı?', '< Açık ama erken git, öğleden sonra dağılıyor', '> Tamam sabah çıkarım', '< Taze sebze var, kaçırma']],
  ['selin_ozturk', 0, ['< Kütüphane bu saatte dolu mudur?', '> Sınav haftası, biraz dolu ama ikinci katta yer var', '< Harikasın, sağ ol', '> Rica ederim, kolay gelsin']],
  ['can_koc', 1, ['< Yeni açılan kafeyi gördün mü?', '> Evet, açılış indirimi var gibi', '< Fiyatlar nasıl?', '> Makul, kahve 55 lira civarı', '< Bu akşam uğrarım']],
  ['deniz_sahin', 0, ['< Selam, spor salonu şu an boş mu?', '> Girişte sıra yok, içeri bakmadım', '< Sağ ol, yola çıkıyorum']],
  ['merve_polat', 2, ['< Ahmet yarın etkinlik var mı meydanda?', '> Duyuru gördüm, akşam konser olacak', '< Kaçta başlıyor?', '> 20.00 gibi yazıyordu', '< Süper, arkadaşlara söyleyeyim', '< Yer tutmak lazım galiba']],
  ['oguz_erdogan', 0, ['< Otoparkta yer var mı orada?', '> Arka tarafta boş yer buldum', '< Sağ ol']],
  ['hatice_gunes', 0, ['> Hatice, cami civarında yol çalışması var mı?', '< Var, iki şeritten biri kapalı', '> Anladım, alternatif yoldan gideyim', '< Evet Alparslan Türkeş\'ten git daha rahat']],
  ['kaan_yildiz', 1, ['< Akşama çay bahçesi açık mıdır?', '> Bugün açıktı, hava güzel olunca doluyor', '< Erken gitmek lazım o zaman', '> Evet 17:00 gibi git']],
  ['ipek_korkmaz', 0, ['< Marketlerde sıra nasıl?', '> Kasa boştu, hızlı geçtim', '< Süper, şimdi çıkıyorum']],
  ['tolga_kurt', 0, ['< Ahmet, kaleye çıkmayı düşünüyorum', '> Hava bugün açık, manzara güzel olur', '< Kalabalık olur mu sence?', '> Hafta içi sakin olur']],
  ['nur_bulut', 2, ['< Merhaba, sağlık ocağında bekleme uzun mu?', '> Sabah baktığımda 30 dakika kadardı', '< Öğleden sonra daha mı az olur?', '> Genelde öyle, 14:00 sonrası azalıyor', '< Tamam o saatte giderim', '< Haber verdiğin için sağ ol']],
  ['yusuf_aksoy', 0, ['< Bugün pazar kurulmuş mu?', '> Kurulmuş, giriş kısmında yoğunluk var', '< Arka kapıdan girerim']],
  ['gamze_tekin', 0, ['> Gamze, çocuk parkı bu saatte nasıl?', '< Şu an neredeyse boş', '> Harika, çıkıyoruz', '< İyi eğlenceler!']],
  ['baris_cakir', 0, ['< Akşam maça gidecek misin?', '> Evet, stadyum çevresi kalabalık olur', '< Erken çıkalım o zaman', '> Tamam 18:00 olsun']],
  ['sibel_dogan', 1, ['< Pastane kuyruğunu gördün mü?', '> Kapıya kadar uzuyor', '< Yarın sabah erken gitmeli', '> Evet 08:00\'de açılınca git', '< Olur, teşekkürler']],
].slice(0, COUNT);

async function api(method, route, { token, body } = {}) {
  const response = await fetch(GATEWAY + route, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* plain text body */ }
  return { status: response.status, json, text };
}

async function ensureUser(userName) {
  const email = `${userName}@blinkr.local`;
  let response = await api('POST', '/api/auth/login', { body: { userName: email, password: PASSWORD } });
  if (response.status !== 200) {
    response = await api('POST', '/api/auth/register', { body: { userName, email, password: PASSWORD } });
    if (response.status !== 200) throw new Error(`cannot create ${userName}: HTTP ${response.status} ${response.text.slice(0, 140)}`);
  }
  return { userName, email, userId: response.json.userId, token: response.json.token };
}

(async () => {
  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { createdAt: new Date().toISOString(), users: {}, conversations: {} };
  manifest.users ||= {}; manifest.conversations ||= {};
  const save = () => { fs.mkdirSync(path.dirname(MANIFEST), { recursive: true }); fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2)); };

  if (args['print-cleanup']) {
    const ids = Object.values(manifest.conversations).filter(Boolean);
    console.log(`# ${ids.length} synthetic conversations. Run inside the Mongo container against the NotificationsService database:`);
    console.log(`# (check the collection names in NotificationsService first; nothing has been deleted by this script)`);
    console.log(JSON.stringify(ids));
    return;
  }

  const login = await api('POST', '/api/auth/login', { body: AHMET });
  if (login.status !== 200) throw new Error(`cannot log in as ahmet: HTTP ${login.status}`);
  const ahmet = { userId: login.json.userId, token: login.json.token };
  console.log(`Logged in as ahmet (${ahmet.userId}); creating ${PEOPLE.length} contacts via ${GATEWAY}`);

  let created = 0; let skipped = 0; let messages = 0;
  for (const [userName, unreadTail, script] of PEOPLE) {
    const person = await ensureUser(userName);
    manifest.users[userName] = { userId: person.userId, email: person.email };
    await sleep(150);

    const start = await api('POST', '/api/chat/conversations', { token: person.token, body: { targetUserId: ahmet.userId } });
    if (start.status !== 200 && start.status !== 201) throw new Error(`conversation with ${userName}: HTTP ${start.status} ${start.text.slice(0, 140)}`);
    const conversationId = start.json.id || start.json.conversationId;
    manifest.conversations[userName] = conversationId;

    const existing = await api('GET', `/api/chat/conversations/${conversationId}/messages`, { token: ahmet.token });
    if (!args.force && Array.isArray(existing.json) && existing.json.length > 0) { skipped += 1; console.log(`  = ${userName}: already has ${existing.json.length} messages`); save(); continue; }

    // Ahmet has read everything before the last `unreadTail` messages from them: send those first, mark the
    // conversation read, then send the tail so the unread badge shows exactly that many.
    const themIndexes = script.map((line, index) => (line.startsWith('<') ? index : -1)).filter((index) => index >= 0);
    const cutoff = unreadTail > 0 && themIndexes.length >= unreadTail ? themIndexes[themIndexes.length - unreadTail] : script.length;
    const send = async (line) => {
      const fromThem = line.startsWith('<');
      const sent = await api('POST', `/api/chat/conversations/${conversationId}/messages`, { token: fromThem ? person.token : ahmet.token, body: { text: line.slice(1).trim() } });
      if (sent.status !== 200 && sent.status !== 201) throw new Error(`message to ${userName}: HTTP ${sent.status} ${sent.text.slice(0, 140)}`);
      messages += 1;
      await sleep(120);
    };
    for (const line of script.slice(0, cutoff)) await send(line);
    await api('POST', `/api/chat/conversations/${conversationId}/read`, { token: ahmet.token });
    for (const line of script.slice(cutoff)) await send(line);
    created += 1;
    save();
    console.log(`  + ${userName}: ${script.length} messages${cutoff < script.length ? ` (${script.length - cutoff} unread)` : ''}`);
  }
  save();
  console.log(`Done: conversations created=${created} skipped=${skipped} messages=${messages}. Manifest: ${path.relative(process.cwd(), MANIFEST)}`);
})().catch((error) => { console.error(error.message); process.exit(1); });
