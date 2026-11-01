#!/usr/bin/env node
/*
 * Realistic Osmaniye test scenarios for manual testing (map, Sinyal Kartı, comments, Keşfet, stories, profile).
 * Everything goes through the public Gateway API, so it flows through the real pipeline.
 *
 *   node scripts/seed-scenarios.cjs --media <folder with manifest.json> [--gateway http://localhost:5080]
 *                                   [--also emutest2@blinkr.local:EmuTest2026x,ahmet@gmail.com:ahmet]
 *                                   [--only 3,8]   only these scenarios (1-based), e.g. to fill in ones that failed
 *
 * Creates 8 people with bios and avatars who follow each other, 15 signals at real Osmaniye places (photos,
 * videos, 2-3 media carousels, one anonymous), 15-20 comments per signal written as real conversations (replies,
 * @mentions, #tags), reactions and comment likes, and photo stories. The --also accounts follow everyone (so they
 * see the stories and the Takip feed) and get a few followers back.
 *
 * The media folder holds freely licensed Wikimedia Commons photos/videos (see its manifest.json for sources).
 * Signals are live for a few hours (the map shows the last 3 hours): run it again right before a test session.
 * Created post ids go to artifacts/synthetic/scenarios-manifest.json.
 */
const fs = require('node:fs');
const path = require('node:path');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, token, index, all) => {
  if (token.startsWith('--')) acc.push([token.slice(2), all[index + 1] && !all[index + 1].startsWith('--') ? all[index + 1] : 'true']);
  return acc;
}, []));
const GATEWAY = (args.gateway || 'http://localhost:5080').replace(/\/$/, '');
const MEDIA_DIR = args.media ? path.resolve(args.media) : null;
const PASSWORD = 'Blinkr!Senaryo2026';
const CENTER = { lat: 37.0746, lon: 36.2464 };
const MANIFEST = path.resolve(__dirname, '..', 'artifacts', 'synthetic', 'scenarios-manifest.json');
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
  { userName: 'ayse.osm', avatarKey: '253', bio: 'Osmaniye doğumlu, kahve ve yürüyüş. Şehirde ne oluyor, önce ben bilirim.' },
  { userName: 'mert_bisiklet', avatarKey: '412', bio: 'Her sabah bisikletle işe. Yol durumunu sorun.' },
  { userName: 'zeynep.kahve', avatarKey: '134', bio: 'Barista. Latte art ve iyi sohbet.' },
  { userName: 'can.ozturk', avatarKey: '520', bio: 'Osmaniyespor tribünü. Maç günleri trafik raporu benden.' },
  { userName: 'elif_ogretmen', avatarKey: '305', bio: 'İlkokul öğretmeni, iki çocuk annesi. Park ve kütüphane uzmanı.' },
  { userName: 'burak.eczaci', avatarKey: '041', bio: 'Eczacı. Nöbetçi eczane sorularına cevap veririm.' },
  { userName: 'selin.yoga', avatarKey: '223', bio: 'Yoga, doğa, Zorkun yaylası aşığı.' },
  { userName: 'emre_hoca', avatarKey: '614', bio: 'OKÜ öğrencisi. Otogar ve dolmuş saatleri kafamda.' },
];

// ---------- scenarios ----------
// who: index in PEOPLE. place: catalog search (nearest match) or null for a coordinate signal. media: manifest keys.
// comments: [who, text, replyTo?] where replyTo is the index of an earlier comment in the same list.
const SCENARIOS = [
  {
    who: 2, place: 'Kahve Deryası', type: 'Crowd', value: 'Calm', media: ['kafe:0', 'kafe:1'],
    text: 'Kahve Deryası şu an çok sakin, cam kenarında 3 masa boş. Çalışmak için ideal, priz de var. #osmaniyekafe',
    comments: [
      [0, 'Harika, 20 dakikaya oradayım 🙌'], [4, 'Wifi hızlı mı bugün? Geçen hafta çok yavaştı.'], [2, 'Bugün gayet iyi, video toplantı yaptım sorun olmadı.', 1],
      [1, 'Bisikleti bağlayacak yer var mı önünde?'], [2, 'Kapının sağında demir var, oraya bağlayabilirsin.', 3], [7, 'Sınav haftası buraya taşınıyorum o zaman 😅'],
      [3, 'Filtre kahveleri nasıl?'], [2, 'Etiyopya çekirdeği geldi, tavsiye ederim.', 6], [5, 'Öğle arası uğrayacağım, kalabalıklaşırsa yazın lütfen.'],
      [0, 'Geldim, hâlâ sakin. 2 masa daha boş.'], [6, 'Tatlı olarak ne var?'], [0, 'Limonlu cheesecake taze gelmiş 🍰', 10],
      [4, '@zeynep.kahve senin çalıştığın yer burası mı?'], [2, 'Yok ben karşı köşedeyim ama burayı çok severim 😊', 12], [7, 'Saat 5 gibi öğrenciler doluyor, erken gelin.'],
      [1, 'Bilgi için teşekkürler 👍'], [3, 'Kaydettim, hafta sonu deneyeceğim.'],
    ],
  },
  {
    who: 5, place: 'Şifa Eczanesi', type: 'Queue', value: 'Over15', media: ['eczane:0'],
    text: 'Şifa Eczanesi nöbetçi, içeride 9 kişi sıra var. Acil değilse Kent Eczanesi 150 m ileride ve boş.',
    comments: [
      [4, 'Çok iyi bilgi, çocuğun ilacını almaya çıkıyordum.'], [5, 'Kent Eczanesi 22:00\'ye kadar açık, oraya gidin.', 0], [0, 'Reçeteli ilaçlar için de mi fark etmez?'],
      [5, 'Evet, e-reçete her eczanede geçer.', 2], [7, 'Sıra şimdi ne kadar?'], [1, '5 dakika önce geçtim, 6 kişi kalmıştı.', 4],
      [3, 'Maske de satıyorlar mı?'], [5, 'Evet, ikisinde de var.', 6], [6, 'Nöbetçi listesini paylaşan var mı bu hafta için?'],
      [5, 'Yarın sabah paylaşırım 👍', 8], [2, 'Ne güzel, sağ olun burak bey'], [0, 'Kent Eczanesine geçtim, gerçekten boş 👌'],
      [4, 'Teşekkürler herkese ❤️'], [7, 'Bu uygulama tam böyle şeyler için 😄'], [3, 'Kesinlikle, çok zaman kazandırdı.', 13],
    ],
  },
  {
    who: 0, place: 'Osmaniye Salı Pazarı', type: 'Offer', value: 'Available', media: ['pazar:0', 'pazar:1'],
    text: 'Salı Pazarı\'nda domates 15 TL, biber 20 TL. Girişten sağdaki tezgâhlar daha ucuz. Öğlene kadar gelen kazanır 🍅',
    comments: [
      [4, 'Çilek var mı?'], [0, 'Var ama pahalı, 80 TL. Haftaya düşer.', 0], [6, 'Köy yumurtası satan amca geldi mi?'],
      [0, 'Evet, arka sırada, 12\'si 90 TL.', 2], [1, 'Otopark dolu mu?'], [0, 'Dolu, yan sokağa bırakın.', 4],
      [3, 'Annem sabah gitmiş, pazarlık da yapılıyormuş 😄'], [2, 'Taze fasulye ne kadar?'], [0, 'Fasulye 45 TL, çok taze.', 7],
      [5, 'Kalabalık nasıl?'], [0, 'Şu an orta, 11\'den sonra artar.', 9], [7, 'Öğrenci bütçesine uygun, güzel 👏'],
      [4, '@ayse.osm tezgâhın fotoğrafı çok iyi olmuş'], [0, 'Teşekkürler 😊', 12], [6, 'Yarın da açık mı?'], [0, 'Hayır, sadece salı günleri.', 14],
      [1, 'Bisikletle gidilir mi?'], [3, 'Giriş biraz kalabalık, elde yürütmek lazım.', 16],
    ],
  },
  {
    who: 4, place: 'Osmaniye Millet Bahçesi', type: 'Crowd', value: 'Busy', media: ['park:v0', 'park:0'],
    text: 'Millet Bahçesi oyun alanı çok kalabalık, salıncak sırası var. Göletin yanındaki küçük oyun alanı daha boş. #osmaniyepark',
    comments: [
      [6, 'Gölet tarafı gölge mi?'], [4, 'Evet, ağaçlar var, çok rahat.', 0], [0, 'Tuvaletler açık mı?'],
      [4, 'Kafeteryanın yanındaki açık.', 2], [3, 'Akşam yürüyüş için uygun mu?'], [1, 'Bisiklet yolu da var, çok güzel.', 4],
      [7, 'Hafta sonu hep böyle dolu olur.'], [5, 'Sivrisinek var mı akşamları?'], [4, 'Gölet kenarında biraz var, sprey alın.', 7],
      [2, 'Dondurmacı var mı içeride?'], [4, 'Girişte var 🍦', 9], [6, 'Videoya bakınca gitmek istedim 😍'],
      [0, 'Çocuklar için harika bir yer.'], [3, 'Otopark ücretsiz mi?'], [1, 'Evet ücretsiz ama akşam doluyor.', 13],
      [4, 'Yarın sabah erken gelin, boş oluyor.'], [5, 'Teşekkürler bilgi için 👍'],
    ],
  },
  {
    who: 3, place: 'Üniversite Stadyumu', type: 'Crowd', value: 'Busy', media: ['mac:v0'],
    text: 'Maç çıkışı stadyum önü çok kalabalık, ana yolda 20 dakika trafik var. Arka yoldan dolaşın. #osmaniyespor',
    comments: [
      [7, 'Skor kaç bitti?'], [3, '2-1 kazandık 🎉', 0], [1, 'Bisikletle geçilir mi?'],
      [3, 'Kaldırımdan zor ama geçilir.', 2], [0, 'Otobüsler çalışıyor mu?'], [7, 'Ring otobüsü 15 dakika gecikmeli.', 4],
      [5, 'Ambulans yolu açık mı?'], [3, 'Polis şeridi açık tutuyor, sorun yok.', 6], [2, 'Tribünden video müthiş 🔥'],
      [6, 'Gelecek maç ne zaman?'], [3, 'Pazar 16:00 deplasman.', 9], [4, 'Çocuklarla gitmek güvenli mi?'],
      [3, 'Aile tribünü var, çok rahat.', 11], [1, 'Arka yol da doldu şimdi 😅'], [7, 'Yürüyerek dönmek en iyisi.', 13],
      [0, '@can.ozturk sağ ol güncel bilgi için'], [3, 'Rica ederim 🙌', 15], [5, 'Geçmiş olsun trafikte kalanlara'],
    ],
  },
  {
    who: 7, place: 'Osmaniye Otogarı', type: 'Queue', value: '5To15', media: ['otogar:0', 'zorkun:0', 'zorkun:1'],
    text: 'Otogarda Zorkun dolmuşu için 10 dakika sıra var. Yaylada hava serin ve sisli, yanınıza mont alın ⛰️',
    comments: [
      [6, 'Zorkun\'a ilk dolmuş kaçta?'], [7, '07:30\'da, sonra saat başı.', 0], [0, 'Yol açık mı? Kar var mı?'],
      [7, 'Kar yok, yol açık ama virajlarda sis var.', 2], [1, 'Bisikletle çıkmayı düşünüyorum, yokuş nasıl?'], [6, 'Çok dik, iyi kondisyon lazım 😅', 4],
      [3, 'Fotoğraflar harika, orası gerçekten bu kadar yeşil mi?'], [6, 'Daha da güzel, fotoğraf yetmiyor.', 6], [4, 'Çocuklarla gidilir mi?'],
      [6, 'Piknik alanları var, çok rahat.', 8], [5, 'Dönüş dolmuşu kaçta son?'], [7, '18:00 son dolmuş, kaçırmayın.', 10],
      [2, 'Yaylada kahve içilecek yer var mı?'], [6, 'Köy kahvesi var, bazlama da yapıyorlar 😋', 12], [0, 'Hafta sonu gidiyorum, kaydettim.'],
      [3, 'Bilet fiyatı ne kadar?'], [7, '60 TL tek yön.', 15],
    ],
  },
  {
    who: 1, place: null, lat: 37.0768, lon: 36.2431, locationName: 'Atatürk Caddesi', type: 'TemporaryStatus', value: 'Closed', media: ['yol:0'],
    text: 'Atatürk Caddesi\'nin belediye tarafı asfalt çalışması için kapalı. Bisikletliler ve araçlar paralel sokaktan geçsin.',
    comments: [
      [3, 'Ne zamana kadar kapalı?'], [1, 'Tabelada cuma akşamı yazıyor.', 0], [0, 'Dolmuşlar da güzergâh değiştirmiş.'],
      [7, 'Otobüs durağı taşındı mı?'], [1, '100 m ileride geçici durak var.', 3], [5, 'Eczaneye ulaşım var mı?'],
      [1, 'Yaya geçişi açık, sorun yok.', 5], [4, 'Okul servisi etkilenir mi?'], [3, 'Sabah biraz gecikme oldu bizde.', 7],
      [2, 'Toz çok mu?'], [1, 'Evet, maske takın.', 9], [6, 'Uyarı için teşekkürler 🙏'],
      [0, 'Belediyeye yazdım, akşam da çalışacaklarmış.'], [7, 'Gece gürültü olmasın bari 😅', 12], [5, 'Gelişmeleri buraya yazalım.'],
      [1, 'Güncelleme: bir şerit açıldı 👍'],
    ],
  },
  {
    who: 0, place: null, lat: 37.0741, lon: 36.2472, locationName: 'Kent Meydanı', type: 'Event', value: 'Started', media: ['konser:v0', 'konser:0'],
    text: 'Kent Meydanı\'nda ücretsiz açık hava konseri başladı 🎶 Sahnenin sol tarafı daha boş. #osmaniyekonser',
    comments: [
      [2, 'Kim çıkıyor sahneye?'], [0, 'Yerel gruplar, 22:00\'de ana sanatçı.', 0], [3, 'Oturacak yer var mı?'],
      [0, 'Arka tarafta sandalyeler var ama doluyor.', 2], [6, 'Ses çok güzel geliyor videodan 😍'], [7, 'Otopark ne durumda?'],
      [3, 'Otopark dolu, toplu taşıma daha iyi.', 5], [4, 'Çocuklar için uygun mu?'], [0, 'Evet, aile çok, ortam güzel.', 7],
      [1, 'Bisiklet park yeri var mı?'], [0, 'Belediye binasının önüne bağlanıyor.', 9], [5, 'Kaçta biter?'],
      [0, '23:30 civarı.', 11], [2, 'Yiyecek standı var mı?'], [3, 'Mısır ve gözleme var 🌽', 13],
      [6, '@ayse.osm canlı yayın gibi olmuş, teşekkürler'], [7, 'Geliyorum 🎉'], [4, 'Yarın da var mı?'], [0, 'Cumartesi bir konser daha var.', 17],
    ],
  },
  {
    who: 4, place: null, lat: 37.0729, lon: 36.2505, locationName: 'İl Halk Kütüphanesi', type: 'Crowd', value: 'Calm', media: ['kutuphane:0'],
    text: 'İl Halk Kütüphanesi bugün çok sakin, çalışma salonunda yer bol. Çocuk bölümünde masal saati 15:00\'te.',
    comments: [
      [7, 'Sınav dönemi için müjde 🙏'], [4, 'Sessiz oda da boş şu an.', 0], [0, 'Kaça kadar açık?'],
      [4, 'Hafta içi 20:00\'ye kadar.', 2], [5, 'Wifi var mı?'], [4, 'Var, şifre girişte yazıyor.', 4],
      [2, 'Kahve getirebilir miyiz?'], [4, 'Kapaklı bardakla izin veriyorlar.', 6], [3, 'Priz yeterli mi?'],
      [7, 'Pencere kenarında çok priz var.', 8], [6, 'Masal saati kaç yaş için?'], [4, '4-8 yaş arası.', 10],
      [1, 'Bisiklet park yeri var mı?'], [4, 'Bahçede var.', 12], [0, 'Çocuğu götüreceğim, sağ ol 😊'],
      [5, 'Harika bir yer, çok temiz.'],
    ],
  },
  {
    who: 5, place: 'Osmaniye Ozel Sevgi Hastanesi', type: 'Queue', value: '5To15', media: ['hastane:0'],
    text: 'Sevgi Hastanesi acil bekleme salonunda şu an 10 dakika civarı bekleme var. Randevulu poliklinikler zamanında.',
    comments: [
      [4, 'Çocuk doktoru var mı bugün?'], [5, 'Öğleden sonra var.', 0], [0, 'Otopark ücretli mi?'],
      [5, 'İlk 1 saat ücretsiz.', 2], [3, 'Kan tahlili sonuçları çabuk çıkıyor mu?'], [5, '2 saat içinde e-nabız\'a düşüyor.', 4],
      [6, 'Acilde kalabalık artıyor mu akşam?'], [5, '19:00 sonrası artıyor genelde.', 6], [7, 'Öğrenci indirimi var mı?'],
      [5, 'Anlaşmalı sigortaya göre değişiyor.', 8], [2, 'Geçmiş olsun herkese 🙏'], [1, 'Bilgi için teşekkürler.'],
      [0, 'Bekleme şimdi ne durumda?'], [5, '5 dakikaya düştü.', 12], [4, 'Çok faydalı bir paylaşım 👍'],
    ],
  },
  {
    who: 6, place: null, lat: 37.0785, lon: 36.2396, locationName: 'Osmaniye Merkez', type: 'GeneralObservation', value: null, media: ['amuda:0', 'amuda:1'],
    text: 'Hafta sonu için öneri: Amuda Kalesi\'nde gün batımı muhteşem. Merkezden araçla 40 dakika, yol asfalt 🏰',
    comments: [
      [0, 'Giriş ücretli mi?'], [6, 'Ücretsiz, ama tırmanış biraz yorucu.', 0], [1, 'Bisikletle gidilir mi?'],
      [6, 'Uzun ama manzaralı bir rota 😊', 2], [3, 'Kaçta gün batıyor?'], [6, 'Şu sıralar 18:30 civarı.', 4],
      [4, 'Çocuklar için güvenli mi?'], [6, 'Kale surlarında dikkat etmek lazım.', 6], [2, 'Fotoğraflar harika 😍'],
      [7, 'Toplu taşıma var mı?'], [6, 'Kadirli dolmuşu yakınından geçiyor.', 9], [5, 'Su götürün, yakında market yok.'],
      [0, 'Bu hafta sonu gidiyoruz, kaydettim.'], [3, 'Tarihi hakkında bilgi olan var mı?'], [6, 'Ermeni Krallığı döneminden, 13. yüzyıl.', 13],
      [2, 'Termos kahve şart ☕'],
    ],
  },
  {
    who: 3, place: null, lat: 37.0752, lon: 36.2448, locationName: 'Cumhuriyet Mahallesi', type: 'NewOpening', value: 'Opened', media: ['doner:0'],
    text: 'Cumhuriyet Mahallesi\'nde yeni bir dönerci açıldı, açılışa özel ayran bedava. Kuyruk 5-6 kişi 🥙',
    comments: [
      [7, 'Öğrenci menüsü var mı?'], [3, 'Var, 120 TL dürüm + ayran.', 0], [0, 'Tavuk mu et mi?'],
      [3, 'İkisi de var, et daha güzel.', 2], [1, 'Kaça kadar açık?'], [3, 'Gece 01:00\'e kadar.', 4],
      [2, 'Paket servis yapıyorlar mı?'], [3, 'Evet, 3 km içine.', 6], [5, 'Hijyen nasıl?'],
      [3, 'Açık mutfak, gayet temiz.', 8], [4, 'Çocuk porsiyonu var mı?'], [3, 'Yarım dürüm yapıyorlar.', 10],
      [6, 'Vejetaryen seçenek var mı?'], [3, 'Falafel var 👍', 12], [0, 'Gidip deneyeceğim.'], [7, 'Yarın öğlen oradayım 😋'],
    ],
  },
  {
    who: 2, place: 'Can Pasta', type: 'Offer', value: 'Available', media: ['latte:0', 'latte:1'],
    text: 'Can Pasta\'da 2. latte %50 indirimli, bugün 18:00\'e kadar ☕ Latte art\'ları da çok güzel.',
    comments: [
      [0, 'Arkadaşımı alıp geliyorum 😄'], [4, 'Yulaf sütü var mı?'], [2, 'Var, 10 TL fark.', 1],
      [7, 'Öğrenci kartıyla ekstra indirim?'], [2, 'Maalesef kampanyalar birleşmiyor.', 3], [6, 'Pasta çeşitleri nasıl?'],
      [2, 'Frambuazlı pasta çok iyi 🍰', 5], [3, 'Oturacak yer var mı?'], [2, 'Bahçede var, içerisi biraz dolu.', 7],
      [1, 'Bisiklet bırakılır mı önüne?'], [2, 'Evet, geniş kaldırım.', 9], [5, 'Kafeinsiz latte yapıyorlar mı?'],
      [2, 'Evet yapıyorlar.', 11], [0, 'Geldim, gerçekten çok güzel 👌'], [4, 'Kaydettim, yarın deneyeceğim.'],
      [3, 'Fotoğraflar iştah açıcı 😍'],
    ],
  },
  {
    who: 7, place: null, lat: 37.0736, lon: 36.2481, locationName: 'Çarşı', type: 'Event', value: 'Started', media: ['muzisyen:v0'],
    text: 'Çarşı girişinde sokak müzisyeni var, çok güzel çalıyor 🎸 Kalabalık toplandı, geçerken durun derim.',
    comments: [
      [0, 'Hangi şarkıları çalıyor?'], [7, 'Türkçe pop ve biraz Anadolu rock.', 0], [2, 'Videoda ses harika 😍'],
      [3, 'Kaça kadar orada?'], [7, 'Akşama kadar kalacakmış.', 3], [4, 'Çocuklar çok sevdi, dans ettiler 😄'],
      [6, 'Şapkaya bir şeyler bırakalım 🙏'], [1, 'İstek şarkı alıyor mu?'], [7, 'Evet, sorun yok diyor.', 7],
      [5, 'Kalabalıktan geçiş zor mu?'], [7, 'Kenardan geçilebiliyor.', 9], [0, 'Hafta sonu da geliyor mu?'],
      [7, 'Cumartesi günleri hep burada.', 11], [3, 'Gidip dinleyeceğim.'], [2, 'Osmaniye\'ye renk katıyor 🎶'],
      [6, 'Böyle paylaşımlar çok güzel ❤️'],
    ],
  },
  {
    who: 1, place: null, lat: 37.0712, lon: 36.2536, locationName: 'Karaçay Sahili', type: 'GeneralObservation', value: null, media: ['kafe:1'],
    anonymous: true,
    text: 'Karaçay kenarındaki yürüyüş yolunda sokak lambaları yanmıyor, akşam yürüyenler dikkatli olsun.',
    comments: [
      [4, 'Belediyeye bildirdiniz mi?'], [0, 'Ben de fark ettim, 2 gündür böyle.'], [5, 'Alo 153\'e yazdım.', 0],
      [3, 'Köpek var mı o tarafta?'], [6, 'Akşamları birkaç tane oluyor, zararsız.', 3], [7, 'Fener alın yanınıza.'],
      [2, 'Uyarı için teşekkürler 🙏'], [0, 'Bugün tamir ekibi geldi, akşam kontrol ederim.'], [4, 'Güncelleme yazar mısınız?'],
      [0, 'Yandı, sorun çözüldü 👍', 8], [5, 'Harika, bu uygulama işe yarıyor 😄'], [3, 'Çok iyi 👏'],
      [6, 'Yürüyüşe çıkıyorum o zaman.'], [1, 'Teşekkürler herkese.'], [7, 'Böyle bildirimler şehir için önemli.'],
    ],
  },
];

const REACTIONS = ['❤️', '🔥', '😂', '😮', '👏', '❤️', '❤️'];

async function login(userName, password) {
  const r = await api('POST', '/api/auth/login', { body: { userName, password } });
  return r.status === 200 ? r.json : null;
}

async function ensurePerson(p) {
  const email = `${p.userName}@blinkr.local`;
  let auth = await login(email, PASSWORD);
  if (!auth) {
    const r = await api('POST', '/api/auth/register', { body: { userName: p.userName, email, password: PASSWORD, birthYear: 1996 } });
    if (r.status !== 200 && r.status !== 201) throw new Error(`register ${p.userName}: HTTP ${r.status} ${r.text.slice(0, 160)}`);
    auth = r.json;
  }
  await api('PUT', '/api/users/me/profile', { token: auth.token, body: { bio: p.bio } });
  await api('PUT', '/api/users/me/avatar', { token: auth.token, body: { avatarKey: p.avatarKey } });
  return { ...p, id: auth.userId, token: auth.token };
}

const media = MEDIA_DIR ? JSON.parse(fs.readFileSync(path.join(MEDIA_DIR, 'manifest.json'), 'utf8')) : {};
async function upload(token, ref) {
  const [key, which] = ref.split(':');
  const list = media[key] || [];
  const item = which.startsWith('v') ? list.filter((m) => m.type === 'Video')[Number(which.slice(1))] : list.filter((m) => m.type === 'Image')[Number(which)];
  if (!item) return null;
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
  console.log(`Blinkr scenarios via ${GATEWAY}${MEDIA_DIR ? ` with media from ${MEDIA_DIR}` : ' (no media folder: text only)'}`);
  const people = [];
  for (const p of PEOPLE) people.push(await ensurePerson(p));
  console.log(`people: ${people.map((p) => p.userName).join(', ')}`);

  // Everyone follows everyone (public accounts: immediate).
  for (const a of people) for (const b of people) if (a !== b) await api('POST', `/api/follows/${b.id}`, { token: a.token });
  const also = (args.also || '').split(',').filter(Boolean).map((pair) => { const i = pair.lastIndexOf(':'); return { user: pair.slice(0, i), password: pair.slice(i + 1) }; });
  for (const extra of also) {
    const auth = await login(extra.user, extra.password);
    if (!auth) { console.log(`  --also ${extra.user}: cannot sign in, skipped`); continue; }
    for (const p of people) await api('POST', `/api/follows/${p.id}`, { token: auth.token });
    for (const p of people.slice(0, 5)) await api('POST', `/api/follows/${auth.userId}`, { token: p.token });
    console.log(`  ${extra.user} follows all 8 and has 5 followers from them`);
  }

  // Stories (photos, 24 h, followers see them).
  if (!args.only) for (const [i, ref] of [[2, 'latte:0'], [6, 'zorkun:1'], [0, 'pazar:1'], [3, 'konser:0']]) {
    const [key, n] = ref.split(':');
    const item = (media[key] || []).filter((m) => m.type === 'Image')[Number(n)];
    if (!item) continue;
    const bytes = fs.readFileSync(path.join(MEDIA_DIR, item.file));
    const r = await api('POST', `/api/stories?durationSeconds=5&caption=${encodeURIComponent('Osmaniye\'den selam 👋')}`, { token: people[i].token, raw: bytes, headers: { 'Content-Type': 'image/jpeg' } });
    console.log(`  story ${people[i].userName}: HTTP ${r.status}`);
  }

  const created = [];
  const only = args.only ? new Set(String(args.only).split(',').map((n) => Number(n) - 1)) : null;
  for (const [index, s] of SCENARIOS.entries()) {
    if (only && !only.has(index)) continue;
    const author = people[s.who];
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
      identityDisclosure: s.anonymous ? 'AnonymousMap' : 'LimitedProfile', locationPrecision: placeId ? 'PlaceCenter' : 'ApproximateArea',
      ...(uploaded.length ? { media: uploaded } : {}),
    } });
    const postId = post.json?.postId;
    if (!postId) { console.log(`  FAILED ${locationName}: HTTP ${post.status} ${post.text.slice(0, 200)}`); continue; }
    created.push(postId);
    // Wait for the read model so comments and reactions land on a visible signal.
    for (let i = 0; i < 40; i += 1) { if ((await api('GET', `/api/posts/${postId}`, { token: people[(s.who + 1) % people.length].token })).status === 200) break; await sleep(500); }

    const ids = [];
    for (const [who, text, replyTo] of s.comments) {
      const parent = replyTo !== undefined ? ids[replyTo] : undefined;
      const r = await api('POST', `/api/posts/${postId}/comments`, { token: people[who].token, body: { commentText: text, ...(parent ? { parentCommentId: parent } : {}) } });
      ids.push(r.json?.commentId ?? r.json?.CommentId ?? null);
      await sleep(120);
    }
    let reactions = 0;
    for (const [i, p] of people.entries()) {
      if (i === s.who || Math.random() < 0.3) continue;
      const r = await api('POST', `/api/posts/${postId}/reactions`, { token: p.token, body: { reaction: REACTIONS[(i + s.who) % REACTIONS.length] } });
      if (r.status === 200) reactions += 1;
    }
    let commentLikes = 0;
    for (const commentId of ids.filter(Boolean).slice(0, 8)) {
      for (const p of people.slice(0, 3)) { const r = await api('POST', `/api/posts/${postId}/comments/${commentId}/like`, { token: p.token }); if (r.status === 200) commentLikes += 1; }
    }
    console.log(`  ${locationName}: ${uploaded.length} media, ${ids.filter(Boolean).length}/${s.comments.length} comments, ${reactions} reactions, ${commentLikes} comment likes`);
  }

  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  // Appends: a later run (e.g. --only) keeps the ids of earlier ones so cleanup can find them all.
  const earlier = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).posts ?? [] : [];
  fs.writeFileSync(MANIFEST, JSON.stringify({ updatedAtUtc: new Date().toISOString(), password: PASSWORD, people: people.map((p) => ({ userName: p.userName, id: p.id })), posts: [...new Set([...earlier, ...created])] }, null, 2));
  console.log(`done: ${created.length} signals. People sign in with <userName>@blinkr.local / ${PASSWORD}`);
})().catch((error) => { console.error(error); process.exit(1); });
