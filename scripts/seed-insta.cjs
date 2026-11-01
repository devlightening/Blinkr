#!/usr/bin/env node
/*
 * Instagram-like Osmaniye test data: 18 people, 28 signals in Osmaniye and around it (Kadirli, Düziçi,
 * Toprakkale, Karatepe, Zorkun), photos/videos/carousels, and comment threads that read like real ones:
 * lowercase, typos, slang, tagging friends, unanswered questions, arguments, self-promo spam and mild trolls.
 * Everything goes through the public Gateway API, so it flows through the real pipeline.
 *
 *   node scripts/seed-insta.cjs --media <folder with manifest.json> [--gateway http://localhost:5080]
 *                               [--also user@mail:password,...]   these accounts follow everyone
 *                               [--only 3,8]                      only these posts (1-based)
 *
 * Posts are live for a few hours (the map shows the last 3 hours): run it again right before a test session.
 * Created post ids go to artifacts/synthetic/insta-manifest.json. Sign in as <userName>@blinkr.local / PASSWORD.
 */
const fs = require('node:fs');
const path = require('node:path');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, token, index, all) => {
  if (token.startsWith('--')) acc.push([token.slice(2), all[index + 1] && !all[index + 1].startsWith('--') ? all[index + 1] : 'true']);
  return acc;
}, []));
const GATEWAY = (args.gateway || 'http://localhost:5080').replace(/\/$/, '');
const MEDIA_DIR = args.media ? path.resolve(args.media) : null;
const PASSWORD = 'Blinkr!Insta2026';
const CENTER = { lat: 37.0746, lon: 36.2464 };
const MANIFEST = path.resolve(__dirname, '..', 'artifacts', 'synthetic', 'insta-manifest.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, route, { token, body, raw, headers } = {}) {
  const init = { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(headers || {}) } };
  if (raw) init.body = raw;
  else if (body !== undefined) { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json; charset=utf-8'; }
  for (let attempt = 0; ; attempt += 1) {
    let response;
    try { response = await fetch(GATEWAY + route, init); } catch (error) { if (attempt >= 6) throw error; await sleep(700 * 2 ** attempt); continue; }
    if (response.status === 429 && attempt < 12) {
      const reset = Number(response.headers.get('RateLimit-Reset') || response.headers.get('Retry-After') || 5);
      await sleep(Math.min(60, Math.max(2, reset)) * 1000); continue;
    }
    if (response.status >= 500 && attempt < 5) { await sleep(700 * 2 ** attempt); continue; }
    const text = await response.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
    return { status: response.status, json, text };
  }
}

// ---------- people ----------
const PEOPLE = [
  { userName: 'mehmetcan.0328', avatarKey: '412', birthYear: 1998, bio: '80 📍 | sarı lacivert' },
  { userName: 'berfin.k_', avatarKey: '134', birthYear: 2004, bio: 'okü | kahve bağımlısı ☕' },
  { userName: 'sude.arslnn', avatarKey: '223', birthYear: 2002, bio: '' },
  { userName: 'yusuf_kdrl', avatarKey: '520', birthYear: 1995, bio: 'kadirli > her yer' },
  { userName: 'emirhan.80', avatarKey: '614', birthYear: 2001, bio: 'modifiye 🔧 | 0328' },
  { userName: 'nisa.ozturkk', avatarKey: '305', birthYear: 1999, bio: 'gezmek tozmak 🌿' },
  { userName: 'okan.usta80', avatarKey: '041', birthYear: 1987, bio: 'oto elektrik. ara sıra foto' },
  { userName: 'zehra.anne80', avatarKey: '253', birthYear: 1990, bio: 'iki tane afacan annesi 👩‍👧‍👦' },
  { userName: 'hakan_1907_80', avatarKey: '500', birthYear: 2003, bio: 'takip edene takip 🔁' },
  { userName: 'tuana.yldzz', avatarKey: '714', birthYear: 2005, bio: '📸' },
  { userName: 'furkan.cvk', avatarKey: '320', birthYear: 2003, bio: 'okü bilgisayar müh. kod yazıyorum uyumuyorum' },
  { userName: 'ahmet.esnaf80', avatarKey: '160', birthYear: 1979, bio: 'Osmaniye esnafı. Allah bereket versin.' },
  { userName: 'ece.duzici', avatarKey: '233', birthYear: 2000, bio: 'düziçi 🌾 haruniye' },
  { userName: 'kerem.gezgin', avatarKey: '425', birthYear: 1993, bio: 'dağ bayır 🏔️ karatepe | zorkun | ağaçbaşı' },
  { userName: 'dilara.ss', avatarKey: '113', birthYear: 2002, bio: '' },
  { userName: 'selim.hoca', avatarKey: '602', birthYear: 1961, bio: 'Emekli öğretmen.' },
  { userName: 'berkay.fit', avatarKey: '540', birthYear: 1997, bio: 'antrenör 💪 online program dm' },
  { userName: 'merve.kuafor80', avatarKey: '343', birthYear: 1994, bio: 'kuaför 💇‍♀️ randevu için dm' },
];
const P = Object.fromEntries(PEOPLE.map((p, i) => [p.userName, i]));
const u = (name) => { if (!(name in P)) throw new Error(`unknown person ${name}`); return P[name]; };

// ---------- posts ----------
// who: userName. place: catalog search (nearest match) or null + lat/lon/locationName for a coordinate signal.
// media: manifest refs ('key:0' photo n, 'key:v0' video n); missing ones are skipped.
// comments: [userName, text, replyTo?] where replyTo is the index of an earlier comment in the same list.
const POSTS = [
  {
    who: 'berfin.k_', place: 'Kahve Deryası', type: 'Crowd', value: 'Calm', media: ['kafe:0', 'latte:1'],
    text: 'vize haftası kurtarıcım burası. şu an bomboş priz bol gelin 🤍',
    comments: [
      ['sude.arslnn', '@dilara.ss bak boşmuş gidelim mi'], ['dilara.ss', 'yarım saate ordayım', 0],
      ['furkan.cvk', 'wifi şifresi değişti mi'], ['hakan_1907_80', 'kahve 90 tl olmuş soygun resmen'],
      ['berfin.k_', 'nerde 90 tl kardeşim filtre 65', 3], ['hakan_1907_80', 'neyse ne pahalı işte', 4],
      ['tuana.yldzz', 'fotoğraf çok tatlı olmuş'], ['nisa.ozturkk', 'cheesecake var mıydı bugün'],
      ['merve.kuafor80', 'çok güzell 😍 bu arada kampanyamız başladı randevu için dm 💇‍♀️'],
      ['mehmetcan.0328', 'akşam kalabalık oluyo ama sabah gidin'],
    ],
  },
  {
    who: 'mehmetcan.0328', place: 'Akdeniz Kebap', type: 'Queue', value: '5To15', media: ['kebap:0'],
    text: 'cuma çıkışı adana kuyruğu başladı yine 😂 10 dk sıra var ama değer',
    comments: [
      ['emirhan.80', 'abi acılı mı söyledin'], ['mehmetcan.0328', 'acılı tabi başka türlüsü olur mu', 0],
      ['yusuf_kdrl', 'kadirlide bunun iyisi var gel bi gün'], ['mehmetcan.0328', 'yok abi kadirlinin kebabı neyse ne', 2],
      ['yusuf_kdrl', 'hadi ordan 😂', 3], ['hakan_1907_80', 'kebap yiyen insanın anlayışı'],
      ['ahmet.esnaf80', 'Afiyet olsun gençler'], ['zehra.anne80', 'paket servis var mı biliyor musunuz'],
      ['berkay.fit', 'cuma günü kebap 🙈 pazartesi salona bekliyorum'], ['emirhan.80', 'hocam bi git ya', 8],
      ['okan.usta80', 'lavaş taze mi bugün'], ['sude.arslnn', '🤤🤤'],
    ],
  },
  {
    who: 'zehra.anne80', place: 'Osmaniye Millet Bahçesi', type: 'Crowd', value: 'Busy', media: ['park:v0', 'park:0'],
    text: 'Millet bahçesi bugün çok kalabalık salıncak sırası var. göletin orası daha sakin çocuklu aileler oraya gitsin',
    comments: [
      ['nisa.ozturkk', 'hava da çok güzel bugün'], ['selim.hoca', 'Bilgilendirme için teşekkürler kızım.'],
      ['dilara.ss', 'otopark dolu mu'], ['tuana.yldzz', 'dondurmacı geldi mi bu sene'],
      ['hakan_1907_80', 'her hafta sonu aynı şey yazıyosunuz zaten belli kalabalık olduğu'],
      ['zehra.anne80', 'yazmayalım mı', 4], ['nisa.ozturkk', 'bilgi veriyo kadın ne var bunda', 4],
      ['hakan_1907_80', 'tamam tamam sakin', 6], ['berkay.fit', 'koşu parkuru da açık bu arada akşam 7de grup koşusu var'],
      ['zehra.anne80', 'teşekkürler herkese ❤️'],
    ],
  },
  {
    who: 'kerem.gezgin', place: null, lat: 37.2958, lon: 36.2533, locationName: 'Karatepe-Aslantaş', type: 'GeneralObservation', value: null,
    media: ['karatepe:0', 'karatepe:1', 'baraj:0'],
    text: 'karatepe aslantaş bugün. müze açık, giriş müzekart ile. baraj tarafında manzara inanılmaz, piknik yapacaksanız erken gelin masalar doluyor #karatepe #osmaniye',
    comments: [
      ['nisa.ozturkk', 'bu ne güzellik yaa'], ['ece.duzici', 'hafta sonu gidecektik tam oldu'],
      ['furkan.cvk', 'merkezden kaç dk'], ['kerem.gezgin', 'arabayla 45 50 dk', 2], ['furkan.cvk', 'dolmuş var mı peki', 3],
      ['selim.hoca', 'Hititlerden kalma eserler. Herkes bir kez görmeli. Çok güzel paylaşım.'],
      ['tuana.yldzz', '3. foto efsane'], ['hakan_1907_80', 'ne var orda taş taş'],
      ['kerem.gezgin', 'taş taş 😂 3000 yıllık taş o', 7], ['mehmetcan.0328', 'ahahah', 8],
      ['sude.arslnn', '@berfin.k_ bunu yapalım artık'], ['berfin.k_', 'vizelerden sonra söz', 10],
      ['yusuf_kdrl', 'kadirli tarafından gelin yol daha iyi'], ['dilara.ss', 'yılan var mı ya korkuyorum'],
    ],
  },
  {
    who: 'okan.usta80', place: null, lat: 37.0802, lon: 36.2398, locationName: 'Gazi Caddesi', type: 'TemporaryStatus', value: 'Closed', media: ['trafik:v0'],
    text: 'Gazi caddesi kaza var yol tek şeride düştü. trafik kilit, alternatif yoldan gidin',
    comments: [
      ['emirhan.80', 'yaralı var mı abi'], ['okan.usta80', 'yok çok şükür maddi hasar', 0],
      ['zehra.anne80', 'okul servisi geçemez şimdi'], ['mehmetcan.0328', 'her gün aynı kavşak ya. bi ışık koyun şuraya'],
      ['selim.hoca', 'Belediyeye defalarca bildirdik. Kimse ilgilenmiyor.', 3], ['furkan.cvk', 'bisikletle geçilir mi'],
      ['hakan_1907_80', 'ehliyeti çikolata kutusundan çıkanlar'], ['okan.usta80', 'açıldı şimdi geçebilirsiniz 👍'],
    ],
  },
  {
    who: 'sude.arslnn', place: 'Can Pasta', type: 'Offer', value: 'Available', media: ['kunefe:0', 'latte:0'],
    text: 'can pastada künefe + çay 120tl kampanya akşama kadar 🥹',
    comments: [
      ['dilara.ss', 'BENİ NİYE ÇAĞIRMADIN'], ['sude.arslnn', 'çağırdım cevap vermedin 🙄', 0],
      ['berfin.k_', 'künefesi hatay ayarında mı'], ['ahmet.esnaf80', 'Hatay künefesi başka evladım 🙂', 2],
      ['tuana.yldzz', 'yarın da devam ediyo mu'], ['berkay.fit', 'bi künefe 600 kalori haberiniz olsun'],
      ['sude.arslnn', 'hocam yeter 😂', 5], ['nisa.ozturkk', 'afiyet olsun 😋'], ['hakan_1907_80', 'reklam mı bu'],
      ['sude.arslnn', 'hayır kardeşim yedim yazdım', 8],
    ],
  },
  {
    who: 'emirhan.80', place: 'Park 328 AVM', type: 'Crowd', value: 'Busy', media: ['avm:0'],
    text: 'avm otoparkı full eksi kat bile dolu. bi saattir yer arıyoruz 🤡',
    comments: [
      ['mehmetcan.0328', 'cumartesi avm ye gidilir mi kardeşim'], ['tuana.yldzz', 'sinemaya gelcektik ya'],
      ['emirhan.80', 'gelmeyin bence', 1], ['dilara.ss', 'zara indirim başlamış ondandır'],
      ['merve.kuafor80', 'avm karşısındayız uğrayın 💇‍♀️ fön 150'], ['hakan_1907_80', 'arabayı yolun ortasına bırak'],
      ['okan.usta80', 'karşı sokakta ücretsiz yer var', 0],
    ],
  },
  {
    who: 'ece.duzici', place: null, lat: 37.2433, lon: 36.4531, locationName: 'Düziçi', type: 'Event', value: 'Started', media: ['konser:v0', 'dugun:0'],
    text: 'düziçi meydanda halay başladı 🎉 belediye şenliği var akşam konser de olacakmış',
    comments: [
      ['kerem.gezgin', 'kim çıkıyo konsere'], ['ece.duzici', 'bilmiyorum afişte yazmıyodu', 0],
      ['yusuf_kdrl', 'davul zurna sesi buraya kadar geliyo 😂'], ['nisa.ozturkk', 'videoya bayıldım'],
      ['selim.hoca', 'Ne güzel, gençler halay çekiyor. Maşallah.'], ['hakan_1907_80', 'osmaniyede başka iş yok'],
      ['ece.duzici', 'gelme o zaman 🙂', 5], ['tuana.yldzz', 'en öndeki teyze efsane'], ['mehmetcan.0328', 'saat kaça kadar', 7],
    ],
  },
  {
    who: 'nisa.ozturkk', place: null, lat: 37.0166, lon: 36.3712, locationName: 'Zorkun Yaylası', type: 'GeneralObservation', value: null, media: ['zorkun:0', 'zorkun:1'],
    text: 'zorkunda hava 14 derece sis inmiş. yanınıza mutlaka mont alın yol virajlarda kaygan ☁️',
    comments: [
      ['kerem.gezgin', 'sis çok güzel olmuş fotoğrafta'], ['berfin.k_', 'aşağıda 30 derece yukarda 14 ne iş'],
      ['furkan.cvk', 'dolmuş kaçta kalkıyo otogardan'], ['zehra.anne80', 'çocuklarla çıkılır mı virajlar korkutuyo'],
      ['nisa.ozturkk', 'yavaş giderseniz sorun yok', 3], ['hakan_1907_80', 'zorkun bitti artık her yer beton'],
      ['kerem.gezgin', 'katılıyorum maalesef. yukarı tarafa çıkın oralar hala güzel', 5], ['sude.arslnn', 'bazlama yediniz mi'],
      ['nisa.ozturkk', 'tabiiki 🤤', 7],
    ],
  },
  {
    who: 'furkan.cvk', place: null, lat: 37.0473, lon: 36.2196, locationName: 'OKÜ Karacaoğlan Kampüsü', type: 'Queue', value: 'Over15', media: ['kutuphane:0'],
    text: 'yemekhane sırası kütüphanenin önüne kadar uzadı 💀 20 dk dan önce yiyemezsiniz',
    comments: [
      ['berfin.k_', 'bugün menü ne'], ['furkan.cvk', 'kuru fasulye pilav', 0], ['berfin.k_', 'tamam o zaman sıraya değer 😂', 1],
      ['dilara.ss', 'kantinde tost bitmiş zaten'], ['hakan_1907_80', 'devlet okulu işte'], ['mehmetcan.0328', 'ben mezun oldum kurtuldum'],
      ['sude.arslnn', 'ikinci kat açık mıydı'], ['furkan.cvk', 'kapalı tadilatta', 6],
    ],
  },
  {
    who: 'ahmet.esnaf80', place: 'Osmaniye Salı Pazarı', type: 'Offer', value: 'Available', media: ['yerfistigi:0', 'yerfistigi:1'],
    text: 'Yeni mahsul yer fıstığı geldi. Kavrulmuş kilosu 260 TL. Pazarın giriş tarafındayız.',
    comments: [
      ['zehra.anne80', 'çiğ var mı'], ['ahmet.esnaf80', 'Var abla 220', 0], ['selim.hoca', 'Osmaniye fıstığı gibisi yok.'],
      ['hakan_1907_80', 'geçen sene 180di'], ['ahmet.esnaf80', 'Mazot gübre ne oldu kardeşim', 3],
      ['yusuf_kdrl', 'kadirli fıstığı daha iyi'], ['mehmetcan.0328', 'yusuf her şey kadirlide daha iyi zaten', 5],
      ['yusuf_kdrl', 'öyle 😎', 6], ['ece.duzici', 'kargo yapıyo musunuz istanbula'], ['ahmet.esnaf80', 'Yapıyoruz özelden yazın', 8],
    ],
  },
  {
    who: 'tuana.yldzz', place: null, lat: 37.0688, lon: 36.2552, locationName: 'Karaçay Kenarı', type: 'GeneralObservation', value: null, media: ['gunbatimi:v0'],
    text: 'bugünkü gün batımı 🧡',
    comments: [
      ['sude.arslnn', 'çok güzel'], ['dilara.ss', 'filtresiz mi bu'], ['tuana.yldzz', 'filtresiz yemin ederim', 1],
      ['nisa.ozturkk', '😍😍😍'], ['hakan_1907_80', 'güneş batıyo ne var bunda'], ['berfin.k_', 'hakan sen her yere yorum yapıyon ya', 4],
      ['hakan_1907_80', 'özgür ülke', 5],
    ],
  },
  {
    who: 'berkay.fit', place: 'Tosyalı Kapalı Spor Salonu', type: 'Event', value: 'Started', media: ['voleybol:v0', 'spor:0'],
    text: 'salonda voleybol turnuvası başladı, giriş ücretsiz tribün yarı dolu gelin destek olun 🏐',
    comments: [
      ['emirhan.80', 'hangi takımlar'], ['berkay.fit', 'lise takımları yarı final', 0], ['zehra.anne80', 'oğlum oynuyor 🥹 15 numara'],
      ['selim.hoca', 'Başarılar gençlere.', 2], ['hakan_1907_80', 'voleybol izleyen mi var'],
      ['tuana.yldzz', 'kadın milli takım sayesinde herkes izliyo artık', 4], ['mehmetcan.0328', 'otopark var mı salonda'],
    ],
  },
  {
    who: 'merve.kuafor80', place: null, lat: 37.0739, lon: 36.2469, locationName: 'Çarşı', type: 'NewOpening', value: 'Opened', media: ['cay:0'],
    text: 'çarşıda yeni salonumuz açıldı 🎀 açılışa özel ilk hafta %20 indirim',
    comments: [
      ['dilara.ss', 'nerde tam olarak'], ['merve.kuafor80', 'eski kuyumcuların sırası canım', 0],
      ['hakan_1907_80', 'bu uygulama reklam yeri mi oldu'], ['sude.arslnn', 'açılış yeni açılış sinyali bu zaten', 2],
      ['nisa.ozturkk', 'hayırlı olsun 🌸'], ['zehra.anne80', 'çocuk saç kesimi var mı'], ['merve.kuafor80', 'var tabi 💕', 5],
    ],
  },
  {
    who: 'yusuf_kdrl', place: null, lat: 37.3735, lon: 36.0976, locationName: 'Kadirli', type: 'Crowd', value: 'Moderate', media: ['pazar:0', 'pazar:1'],
    text: 'kadirli cuma pazarı normal kalabalık. domates 15 biber 25. bu hafta karpuz ucuz',
    comments: [
      ['mehmetcan.0328', 'yine kadirli 😂'], ['yusuf_kdrl', 'kıskanma', 0], ['ece.duzici', 'bizim pazarda domates 20 olmuş'],
      ['ahmet.esnaf80', 'Kolay gelsin pazarcı kardeşlerime'], ['zehra.anne80', 'karpuz kaç para'], ['yusuf_kdrl', 'kilosu 8', 4],
      ['hakan_1907_80', 'yalan bu fiyatlar'],
    ],
  },
  {
    who: 'dilara.ss', place: 'Hayal Park', type: 'Crowd', value: 'Calm', media: ['kedi:0'],
    text: 'hayal parkın kedileri 🐈 biri mama getirsin aç gibiler',
    comments: [
      ['tuana.yldzz', 'sarı olan çok tatlı'], ['zehra.anne80', 'akşam getiricem'], ['berfin.k_', 'ben de kuru mama bırakmıştım geçen'],
      ['hakan_1907_80', 'kedi besleyen arkadaşlar evinize götürün'], ['dilara.ss', 'senin gibilere hiç girmiyorum', 3],
      ['nisa.ozturkk', 'parkta su kabı da vardı kaldırmışlar'], ['selim.hoca', 'Hayvanlara iyilik eden iyilik bulur.'],
      ['sude.arslnn', '🥺'],
    ],
  },
  {
    who: 'kerem.gezgin', place: null, lat: 37.2702, lon: 36.2754, locationName: 'Aslantaş Barajı', type: 'GeneralObservation', value: null, media: ['tekne:v0'],
    text: 'baraj gölünde tekne turu başlamış. kişi başı 150 tl 30 dk',
    comments: [
      ['nisa.ozturkk', 'can yeleği veriyorlar mı'], ['kerem.gezgin', 'veriyorlar', 0], ['furkan.cvk', 'öğrenci indirimi 😅'],
      ['ece.duzici', 'harika olmuş'], ['hakan_1907_80', 'boğulursunuz'], ['mehmetcan.0328', 'hakan ne biçim yorum bu', 4],
    ],
  },
  {
    who: 'okan.usta80', place: null, lat: 37.0855, lon: 36.2321, locationName: 'Fakıuşağı', type: 'Queue', value: 'Over15', media: ['benzin:0'],
    text: 'zam gelecek dediler istasyonda kuyruk var 20 araba falan',
    comments: [
      ['emirhan.80', 'kaç lira olcak'], ['okan.usta80', 'gece yarısı 2 lira diyolar', 0], ['mehmetcan.0328', 'yine mi ya'],
      ['hakan_1907_80', 'bisiklete binin'], ['selim.hoca', 'Her hafta zam. Emekli ne yapsın.'], ['emirhan.80', 'depoyu doldurdum ben ✌️'],
    ],
  },
  {
    who: 'selim.hoca', place: 'Zafer Camii', type: 'GeneralObservation', value: null, media: ['amuda:0'],
    text: 'Zafer Camii avlusunda bugün aşure dağıtılıyor. Herkes davetlidir.',
    comments: [
      ['zehra.anne80', 'Allah kabul etsin hocam'], ['ahmet.esnaf80', 'Allah razı olsun'], ['nisa.ozturkk', 'kaça kadar dağıtılıyor'],
      ['selim.hoca', 'Öğleden sonra bitene kadar.', 2], ['tuana.yldzz', '🤲'],
    ],
  },
  {
    who: 'emirhan.80', place: null, lat: 37.0658, lon: 36.1484, locationName: 'Toprakkale', type: 'TemporaryStatus', value: 'Closed', media: ['yol:0'],
    text: 'toprakkale çıkışı yol çalışması var tek şerit. kale tarafına giden uzun sürer haberiniz olsun',
    comments: [
      ['okan.usta80', 'ne zamandır bu çalışma bitmedi'], ['emirhan.80', 'abi 3 aydır', 0], ['yusuf_kdrl', 'kadirliye gidecem ne yapayım'],
      ['okan.usta80', 'cevdetiye üzerinden dön', 2], ['hakan_1907_80', 'seçim yaklaşıyo herhalde'],
    ],
  },
  {
    who: 'berfin.k_', place: 'Somuncu Fırın Cafe', type: 'Crowd', value: 'Moderate', media: ['kahvalti:0', 'kahvalti:1', 'firin:0'],
    text: 'pazar kahvaltısı 🍳 serpme 2 kişilik 650. bekleme yok ama bahçe dolu içerde yer var',
    comments: [
      ['sude.arslnn', 'bizi niye çağırmadınız'], ['dilara.ss', 'her seferinde aynı şey 😂', 0], ['tuana.yldzz', 'simitleri sıcak mı'],
      ['berfin.k_', 'fırından yeni çıktı', 2], ['berkay.fit', 'protein açısından güzel masa 👌'],
      ['hakan_1907_80', '650 lira kahvaltı ya'], ['nisa.ozturkk', 'iki kişi için normal fiyat bu', 5], ['hakan_1907_80', 'evde 100 liraya yaparım', 6],
      ['berfin.k_', 'yap o zaman 🙃', 7], ['mehmetcan.0328', 'yorumlar postu geçti 😂'], ['furkan.cvk', 'çay sınırsız mı'],
      ['berfin.k_', 'evet', 10],
    ],
  },
  {
    who: 'tuana.yldzz', place: null, lat: 37.0741, lon: 36.2472, locationName: 'Kent Meydanı', type: 'Event', value: 'Started', media: ['havai:v0', 'konser:0'],
    text: 'havai fişek başladııı 🎆🎆',
    comments: [
      ['sude.arslnn', 'balkondan görüyorum'], ['dilara.ss', 'ne kutlaması'], ['tuana.yldzz', 'kurtuluş haftası', 1],
      ['zehra.anne80', 'çocuklar korktu biraz 😅'], ['hakan_1907_80', 'paraları yakıyolar'], ['selim.hoca', 'Kurtuluşumuz kutlu olsun.'],
      ['nisa.ozturkk', 'video çok güzel çıkmış'], ['mehmetcan.0328', 'meydan tıklım tıklım'],
    ],
  },
  {
    who: 'zehra.anne80', place: 'Osmaniye Ozel Sevgi Hastanesi', type: 'Queue', value: 'Over15', media: ['hastane:0'],
    text: 'çocuk aciline geldik 1 saattir bekliyoruz. acil değilse başka yere gidin',
    comments: [
      ['nisa.ozturkk', 'geçmiş olsun 🙏'], ['selim.hoca', 'Geçmiş olsun kızım.'], ['dilara.ss', 'devlet hastanesinde de aynı'],
      ['furkan.cvk', 'geçmiş olsun'], ['zehra.anne80', 'teşekkürler çıktık çok şükür bir şey yokmuş'],
    ],
  },
  {
    who: 'mehmetcan.0328', place: null, lat: 37.0612, lon: 36.2541, locationName: '7 Ocak Stadyumu', type: 'Crowd', value: 'Busy', media: ['mac:v0'],
    text: 'maç çıkışı. yürüyerek dönün ana yol kilit 🟢⚪',
    comments: [
      ['emirhan.80', 'kaç kaç bitti'], ['mehmetcan.0328', '2-0 aldık', 0], ['hakan_1907_80', 'hakem hediye etti'],
      ['mehmetcan.0328', 'gel otur yerine sen yönet', 2], ['yusuf_kdrl', 'tribün efsaneydi bugün'], ['okan.usta80', 'servis yolu da kapalı mı'],
      ['furkan.cvk', 'ring otobüsü çalışıyo mu'], ['mehmetcan.0328', 'çalışıyo ama çok kalabalık', 6],
    ],
  },
  {
    who: 'nisa.ozturkk', place: 'Oz Divan Pastanesi', type: 'Crowd', value: 'Moderate', media: ['firinv:v0'],
    text: 'sıcak poğaça çıktı 🥐 kuyruk yok ama hızlı bitiyor',
    comments: [
      ['berfin.k_', 'peynirli var mı'], ['nisa.ozturkk', 'zeytinli ve peynirli', 0], ['sude.arslnn', 'sabah sabah açlık bombası'],
      ['ahmet.esnaf80', 'Bereketli olsun'], ['hakan_1907_80', 'kaç lira tanesi'],
    ],
  },
  {
    who: 'hakan_1907_80', place: null, lat: 37.0779, lon: 36.2412, locationName: 'Raufbey Mahallesi', type: 'GeneralObservation', value: null, media: ['kedi:1'],
    text: 'mahallenin kedisi yine arabanın üstünde uyuyo 😂 kaldırmaya kıyamadım',
    comments: [
      ['tuana.yldzz', 'sonunda güzel bir paylaşım hakan'], ['hakan_1907_80', 'her zaman güzel paylaşırım', 0], ['dilara.ss', 'adı ne'],
      ['hakan_1907_80', 'paşa', 2], ['zehra.anne80', 'çok tatlı 🐱'], ['mehmetcan.0328', 'hakanın en iyi postu bu'],
      ['berfin.k_', 'hani kedi besleyenler evine götürsündü 🙂'], ['hakan_1907_80', 'o başka bu benim kedim 😂', 6], ['dilara.ss', 'hahaha yakalandın', 7],
    ],
  },
  {
    who: 'furkan.cvk', place: null, lat: 37.0745, lon: 36.2458, locationName: 'Osmaniye Merkez', type: 'GeneralObservation', value: null, media: ['yagmur:v0', 'yagmur:0'],
    text: 'sağanak başladı 🌧️ atatürk caddesi göl gibi, alt geçitten geçmeyin',
    comments: [
      ['okan.usta80', 'alt geçit yine doldu mu'], ['furkan.cvk', 'arabalar mahsur kaldı', 0], ['selim.hoca', 'Her yağmurda aynı manzara. Altyapı yok.'],
      ['zehra.anne80', 'çocukları okuldan almaya gidecektim'], ['emirhan.80', 'ben geçtim sorun yok arazi aracı 😎'],
      ['mehmetcan.0328', 'emirhan şov yapma', 4], ['dilara.ss', 'şemsiyesiz yakalandım 😭'], ['hakan_1907_80', 'yağmur yağıyo diye haber mi yapılır'],
      ['nisa.ozturkk', 'bilgi veriyo işte', 7], ['furkan.cvk', 'kesildi şimdi, sular çekiliyor'],
    ],
  },
  {
    who: 'sude.arslnn', place: 'Migros', type: 'Queue', value: '5To15', media: ['avm:0'],
    text: 'migrosta tek kasa açık 😤 sıra arkaya kadar',
    comments: [
      ['dilara.ss', 'akşam saatinde normal'], ['zehra.anne80', 'self servis kasa da bozuk mu'], ['sude.arslnn', 'bozukmuş', 1],
      ['hakan_1907_80', 'şok a git'], ['sude.arslnn', 'şokta da aynı kesin', 3],
    ],
  },
];

const REACTIONS = ['❤️', '❤️', '❤️', '🔥', '😂', '😮', '👏', '😢'];
const rand = (n) => Math.floor(Math.random() * n);

async function login(userName, password) {
  const r = await api('POST', '/api/auth/login', { body: { userName, password } });
  return r.status === 200 ? r.json : null;
}

async function ensurePerson(p) {
  const email = `${p.userName}@blinkr.local`;
  let auth = await login(email, PASSWORD);
  if (!auth) {
    const r = await api('POST', '/api/auth/register', { body: { userName: p.userName, email, password: PASSWORD, birthYear: p.birthYear } });
    if (r.status !== 200 && r.status !== 201) throw new Error(`register ${p.userName}: HTTP ${r.status} ${r.text.slice(0, 160)}`);
    auth = r.json;
  }
  if (p.bio) await api('PUT', '/api/users/me/profile', { token: auth.token, body: { bio: p.bio } });
  await api('PUT', '/api/users/me/avatar', { token: auth.token, body: { avatarKey: p.avatarKey } });
  return { ...p, id: auth.userId, token: auth.token };
}

const media = MEDIA_DIR ? JSON.parse(fs.readFileSync(path.join(MEDIA_DIR, 'manifest.json'), 'utf8')) : {};
function mediaItem(ref) {
  const [key, which] = ref.split(':');
  const list = media[key] || [];
  return which.startsWith('v') ? list.filter((m) => m.type === 'Video')[Number(which.slice(1))] : list.filter((m) => m.type === 'Image')[Number(which)];
}

async function upload(token, ref) {
  const item = mediaItem(ref);
  if (!item) { console.log(`  media ${ref}: not in the folder, skipped`); return null; }
  const bytes = fs.readFileSync(path.join(MEDIA_DIR, item.file));
  const contentType = item.type === 'Video' ? 'video/mp4' : 'image/jpeg';
  const presign = await api('POST', '/api/v1/media/presign', { token, body: { fileName: item.file, contentType, sizeBytes: bytes.length, width: item.width, height: item.height, durationSeconds: item.durationSeconds } });
  if (presign.status !== 200 && presign.status !== 201) { console.log(`  media ${ref} presign HTTP ${presign.status} ${presign.text.slice(0, 120)}`); return null; }
  const url = presign.json.uploadUrl;
  const route = url.startsWith('http') ? new URL(url).pathname + new URL(url).search : url;
  const put = await api('PUT', route, { token, raw: bytes, headers: { 'Content-Type': contentType, ...(presign.json.requiredHeaders || presign.json.headers || {}) } });
  if (put.status >= 300) { console.log(`  media ${ref} upload HTTP ${put.status}`); return null; }
  return { mediaId: presign.json.mediaId, mediaType: item.type };
}

async function findPlace(name) {
  const r = await api('GET', `/api/places/search?${new URLSearchParams({ q: name, lat: String(CENTER.lat), lon: String(CENTER.lon), radiusMeters: '8000' })}`);
  return Array.isArray(r.json) ? r.json[0] ?? null : null;
}

(async () => {
  console.log(`Blinkr insta seed via ${GATEWAY}${MEDIA_DIR ? ` with media from ${MEDIA_DIR}` : ' (no media folder: text only)'}`);
  for (const post of POSTS) { u(post.who); for (const [who] of post.comments) u(who); }

  const people = [];
  for (const p of PEOPLE) people.push(await ensurePerson(p));
  console.log(`people: ${people.length}`);

  // A real-looking follow graph: everyone follows a random 40-80% of the others, so follower counts differ.
  if (!args.only) {
    for (const a of people) for (const b of people) if (a !== b && Math.random() < 0.4 + 0.4 * ((P[b.userName] % 5) / 4)) await api('POST', `/api/follows/${b.id}`, { token: a.token });
  }
  const also = (args.also || '').split(',').filter(Boolean).map((pair) => { const i = pair.lastIndexOf(':'); return { user: pair.slice(0, i), password: pair.slice(i + 1) }; });
  for (const extra of also) {
    const auth = await login(extra.user, extra.password);
    if (!auth) { console.log(`  --also ${extra.user}: cannot sign in, skipped`); continue; }
    for (const p of people) await api('POST', `/api/follows/${p.id}`, { token: auth.token });
    for (const p of people.slice(0, 7)) await api('POST', `/api/follows/${auth.userId}`, { token: p.token });
    console.log(`  ${extra.user} follows all ${people.length} and has 7 followers from them`);
  }

  // Stories (photos, 24 h, followers see them).
  if (!args.only && MEDIA_DIR) for (const [who, ref, caption] of [
    ['berfin.k_', 'latte:0', 'sabah kahvesi'], ['kerem.gezgin', 'karatepe:0', ''], ['tuana.yldzz', 'gunbatimi:0', '🧡'],
    ['nisa.ozturkk', 'zorkun:1', 'yayla havası'], ['mehmetcan.0328', 'kebap:0', 'cuma'], ['dilara.ss', 'kedi:0', ''],
  ]) {
    const item = mediaItem(ref);
    if (!item || item.type !== 'Image') continue;
    const bytes = fs.readFileSync(path.join(MEDIA_DIR, item.file));
    const r = await api('POST', `/api/stories?durationSeconds=5${caption ? `&caption=${encodeURIComponent(caption)}` : ''}`, { token: people[u(who)].token, raw: bytes, headers: { 'Content-Type': 'image/jpeg' } });
    console.log(`  story ${who}: HTTP ${r.status}`);
  }

  const created = [];
  const only = args.only ? new Set(String(args.only).split(',').map((n) => Number(n) - 1)) : null;
  for (const [index, s] of POSTS.entries()) {
    if (only && !only.has(index)) continue;
    const author = people[u(s.who)];
    let lat = s.lat; let lon = s.lon; let placeId = null; let locationName = s.locationName;
    if (s.place) {
      const place = await findPlace(s.place);
      if (place) { placeId = place.id; lat = place.latitude; lon = place.longitude; locationName = place.name; }
      else { lat = CENTER.lat + (Math.random() - 0.5) * 0.01; lon = CENTER.lon + (Math.random() - 0.5) * 0.01; locationName = s.place; }
    }
    const uploaded = [];
    for (const ref of s.media || []) { const m = await upload(author.token, ref); if (m) uploaded.push(m); }
    const post = await api('POST', '/api/posts', { token: author.token, body: {
      title: '', content: s.text, latitude: lat, longitude: lon, accuracyMeters: 12,
      observationLatitude: lat, observationLongitude: lon, observationAccuracyMeters: 10,
      locationName, placeId, signalType: s.type, signalValue: s.value, audienceType: 'Public',
      identityDisclosure: 'LimitedProfile', locationPrecision: placeId ? 'PlaceCenter' : 'ApproximateArea',
      ...(uploaded.length ? { media: uploaded } : {}),
    } });
    const postId = post.json?.postId;
    if (!postId) { console.log(`  #${index + 1} FAILED ${locationName}: HTTP ${post.status} ${post.text.slice(0, 200)}`); continue; }
    created.push(postId);
    // Wait for the read model so comments and reactions land on a visible signal.
    const reader = people[(u(s.who) + 1) % people.length];
    for (let i = 0; i < 40; i += 1) { if ((await api('GET', `/api/posts/${postId}`, { token: reader.token })).status === 200) break; await sleep(500); }

    const ids = [];
    for (const [who, text, replyTo] of s.comments) {
      const parent = replyTo !== undefined ? ids[replyTo] : undefined;
      const r = await api('POST', `/api/posts/${postId}/comments`, { token: people[u(who)].token, body: { commentText: text, ...(parent ? { parentCommentId: parent } : {}) } });
      if (r.status >= 300) console.log(`    comment by ${who} HTTP ${r.status} ${r.text.slice(0, 100)}`);
      ids.push(r.json?.commentId ?? r.json?.CommentId ?? null);
      await sleep(120);
    }
    // Uneven engagement like a real feed: some posts get most people, some only a few.
    const share = 0.25 + Math.random() * 0.65;
    let reactions = 0;
    for (const p of people) {
      if (p === author || Math.random() > share) continue;
      const r = await api('POST', `/api/posts/${postId}/reactions`, { token: p.token, body: { reaction: REACTIONS[rand(REACTIONS.length)] } });
      if (r.status === 200) reactions += 1;
    }
    let commentLikes = 0;
    for (const commentId of ids.filter(Boolean)) {
      const likers = rand(4) === 0 ? rand(6) : rand(2);
      for (const p of people.filter(() => Math.random() < 0.5).slice(0, likers)) {
        const r = await api('POST', `/api/posts/${postId}/comments/${commentId}/like`, { token: p.token });
        if (r.status === 200) commentLikes += 1;
      }
    }
    console.log(`  #${index + 1} ${locationName}: ${uploaded.length} media, ${ids.filter(Boolean).length}/${s.comments.length} comments, ${reactions} reactions, ${commentLikes} comment likes`);
  }

  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  const earlier = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).posts ?? [] : [];
  fs.writeFileSync(MANIFEST, JSON.stringify({ updatedAtUtc: new Date().toISOString(), password: PASSWORD, people: people.map((p) => ({ userName: p.userName, id: p.id })), posts: [...new Set([...earlier, ...created])] }, null, 2));
  console.log(`done: ${created.length}/${only ? only.size : POSTS.length} posts. Sign in with <userName>@blinkr.local / ${PASSWORD}`);
})().catch((error) => { console.error(error); process.exit(1); });
