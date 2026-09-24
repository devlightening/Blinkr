# PROGRESS — Devam Paketi İlerlemesi

> Tek takip dosyası budur. Her görev bitiminde güncelle. Yeni oturumda önce bunu oku,
> ilk `[ ]` görevden devam et. Durumlar: `[ ]` yapılmadı · `[~]` devam ediyor/yarım ·
> `[x]` tamam ve ekranda doğrulandı · `[-]` ertelendi (neden DECISIONS.md'de).

## Durum

| Alan | Değer |
|---|---|
| Aktif faz | Faz F (A–E tamam; A2/A3 silme kullanıcı onayı bekliyor) |
| Önceki durum | Faz 0–9 işlevsel tamam · Faz 10 yarım (P10.1/3/4/8/9 bitti) |
| Son güncelleme | 2026-09-24 |
| Engelleyici | F1: gerçek destek/itiraz e-posta adresi kullanıcıdan alınacak |


## Faz A — Doğrulama ve temizlik

- [x] A1 Test verisini izole et — tüm test hesapları `e2e_` önekli; geliştirmede `e2e_` ve eski zaman damgalı test hesapları gerçek kullanıcıdan Keşfet/harita/aramada gizli (ahmet hesabıyla doğrulandı: "smoke", "e2e", "fa17" aramaları 0); `scripts/cleanup-test-data.cjs` + koşucuda `-Cleanup`
- [~] A2 Mevcut artıkları temizle — betik hazır ve kuru çalıştırıldı (795 test hesabı, 765 sinyal); toplu silme otomatik izin denetimince durduruldu, kullanıcı çalıştıracak: `node scripts/cleanup-test-data.cjs --backup`
- [~] A3 Seed sinyalleri — ahmet@gmail.com'daki 20.024 gönderi 2026-09-20 14:00 seed koşusundan (manifestte kayıtlı); kullanıcının kendi ~14 gönderisine dokunulmaz. Silme komutu hazır (BlogService `RateLimiting__GlobalPermitLimit=30000` ile): `node scripts/cleanup-synthetic.cjs --only ahmet`. Eski "amk" içerikleri metin filtresiyle "Hassas içerik" işaretleniyor (D-016)
- [x] A4 StatRow etiket tekrarı — tek ifade: "2 sinyal · Orta güven · ~120 m" (yer sayfası ve bileşen önizleme aynı bileşen; ekran görüntüsüyle doğrulandı)
- [x] A5 StatRow ikonları — sinyal Layers, tazelik Zap, güven ShieldCheck, uzaklık MapPin
- [x] A6 Yorumlar sayfasındaki boş medya — kaynak: medya-gizlilik smoke testinin 45 baytlık 1×1 PNG'si (test verisi) + videoda .mp4'ü görsel olarak çizme. `ui/BlinkrMediaImage`: videoda oynat karosu, yüklenemeyen görselde "Görsel yüklenemedi" yer tutucusu
- [x] A7 Yorumlar sayfasında çift sayaç satırı — FeedCard `hideActions`; sayfada tek satır (UI testi + ekran görüntüsü)
- [x] A8 Tazelik tek kaynak — `src/freshness.ts` (+ `freshness.test.ts`); Yakında başlığı "5 sinyal · 2 canlı" = "Canlı 2" çipi; pin/liste opaklığı, yer durumu, Keşfet ve profil rozetleri aynı kuraldan; "Canlı" yalnız sunucu doğrulamalı
- [x] A9 Faz 3/5/8 kabul denetimi — `docs/plan-devam/DENETIM_FAZ_3_5_8.md`

## Faz B — Palet ve tema (D-006)

- [x] B1 Ham palet — `palette` (paper/ink/coal/chalk/sage/sun + 8 tint/ink çifti); eski mint*/ink9xx ham anahtarları kalktı
- [x] B2 Semantik token'lar — eski adlar korunarak yeni değerler + `semanticColors` (bg/border/text/accent/state) iki tema
- [x] B3 Açık tema varsayılan — themeBoot (tercih > sistem > açık), Ayarlar > Görünüm (Sistem/Açık/Koyu), değişince yeniden yükleme (D-017)
- [x] B4 Tipografi — Outfit (Türkçe glifler cmap'te doğrulandı) başlık/rakam/buton; yeni ölçek; iki ALL CAPS etiket cümle düzenine çevrildi
- [x] B5 Köşe, boşluk, buton — 10/16/24/32, buton 40/48/56, `screenPadding` 16
- [x] B6 Gölge — açıkta 0 2 12 / 0 8 24 yumuşak gölge, koyuda gölge yok (kenarlık + kademe)
- [x] B7 Hareket — bouncy {14,200} hafif taşar, gentle taşmasız, basma 0.96, `ReduceMotion.System` (basma ve sheet)
- [x] B8 Sinyal tipi renkleri — tint+ink çiftleri; eşleme D-017
- [x] B9 Harita stili + pin okunabilirliği — açık/koyu Google stili + iOS `userInterfaceStyle`; pin tint dolgu, ink ikon, 2px kenarlık, gölge, seçili beyaz hale 1.2x (iki temada ekran görüntüsüyle doğrulandı)
- [x] B10 Bileşen önizleme güncellemesi — yeni ölçek, renk kartelası ve tip çiftleri; kontrast iki temada `test:theme` ile (hepsi ≥ 4,5:1)
- [x] B11 Ham renk taraması — UI .tsx dosyalarında ham hex/rgba sıfır (kalan: avatar çizimi ve çıkartma metni sanat sabitleri); medya ortüleri `media` token'larında

## Faz C — Sinyal Kartı ve harita

- [x] C1 CenterModal kabı — overlay + blur + ortada kart (xl köşe, maks %82), yayla açılış, aşağı sürükle/overlay/X/geri ile kapanış (pinden uçan animasyon yerine ortadan; D-018)
- [x] C2 Pin dokunuşu artık Sinyal Kartı'nı açar — yer pini üstte yer şeridiyle; yer sayfası şeritten/yer satırından
- [x] C3 Kart içeriği — halka+avatar, ad, "Konumda", yaş + kalan süre, ⋯; medya + TypeBadge / metin kartı; yer satırı; 3 satır açıklama + devamı; HealthNotice; VerifyBar; ActionRow; en yeni yorum; "Yorum ekle…"
- [x] C4 Medya kırpması düzeltmesi — 9:16–4:5 arası kendi oranı, dışı blur arka planla contain (`mediaFrame`, test); yer sayfası fotoğrafları da contain+blur
- [x] C5 Kart içi yatay kaydırma — sayfalı liste + ‹ 1/3 › ; medya carousel içte
- [~] C6 Etkileşimler — tam ekran görüntüleyici (iOS pinch-zoom, sürükle-kapat), çift dokunma ❤️ + kalp, yazar → profil, yer satırı → yer sayfası. ReactionBar ertelendi (D-018)
- [x] C7 Doğrulama akışı kartta — Evet tek dokunuşla yayın + haptik, Değişti → composer; 500 m dışı/kendi sinyali/konum yok → pasif + neden
- [~] C8 ⋯ menüsü — sinyali/kişiyi bildir, engelle, (kendi) sil; sessize al/düzenle/haritadan kaldır yok (D-018)
- [x] C9 Kümeye dokunma — zoom < 16 yakınlaştır, 16+ kümedeki sinyaller kartta
- [x] C10 Yer sayfası düzeltmeleri — fotoğraflar kırpılmıyor, sayı = liste, HealthNotice ortak bileşen
- [x] C11 Harita üst barı — "Bu alanı tara" yalnız otomatik yükleme başarısızsa; görünür sayısı yok; boş durumda tek satır alt bant
- [x] C12 Görüntülenme sayımı — ≥1 sn → 10 sn'de bir toplu `POST /api/posts/views`; yalnız yazar görür (BLK-CARD-01)
- [~] C13 Performans — marker memo, en fazla 300 nokta, kart önbellekteki veriyle anında açılır; < 150 ms ölçümü cihazda (G9)

## Faz D — Kamera-öncelikli oluşturma

- [x] D1 (+) doğrudan kamerayı açar — (+) kamera, basılı tut yazılı sinyal (P5.1'den beri)
- [~] D2 Kamera ekranı tamamlanır — galeri, dokun=foto / basılı tut=video halkası, Aa, flaş/çevir, Foto·Video; zoom iki parmakla (deklanşörde yukarı kaydırma yok, D-019)
- [x] D3 Yer algılama kamerada — izin varsa kamera açılınca konum; 100 m içindeki en yakın yer çipte ve composer onunla başlar; > 100 m "Konum belirsiz" (`cameraPlace.ts`, test)
- [x] D4 Efekt ekranı: filtre kaydırmayla — daire listesi kalktı; kaydırma + adın 1 sn görünmesi + küçük "‹ ad ›" göstergesi
- [x] D5 Çıkartmalar — sürükle, iki parmak ölçek/döndür, çöpe sürükle, boş alana yerleşim, ±2–4° eğim (`stickerTilt`, test)
- [x] D6 Detaylar tek sayfa — sihirbaz yok; yer satırı, tür kareleri + seviye, 280 karakter tek açıklama, görünürlük, süre bilgisi; başlık alanı yok
- [x] D7 Başlık verisi göçü — göç yerine görüntüde birleştirme (`cardText`) tüm liste/kartlarda (D-019)
- [x] D8 Gönder ekranı — Haritaya / Hikayem / Arkadaşlar (snap, arama) + sarı Gönder, composer içinde
- [~] D9 Arka planda yükleme — giden kutusu (cihazda kalıcı, bağlantı gelince otomatik), "Paylaşılıyor…/Bağlantı bekleniyor/Paylaşılamadı" çipi, toast; kendi pininin nabzı yok (D-019)
- [x] D10 Galeri kuralları — EXIF sunucuya gitmez; 2 saatten eski galeri medyası güveni düşürür ve kartta "Galeriden" (sunucu yalnız `fromGallery` bayrağını tutar; BLK-CARD-01)
- [x] D11 Hassas yer uyarısı — kamerada tek seferlik uyarı; okulda "Yazılı sinyal"; composer'da medya kapalı (sunucu da reddeder)

## Faz E — Sohbet yenileme

- [x] E1 Balon UI — benimkiler sağda (marka tonu), karşı taraf solda (nötr); sol çizgi ve "Ben/ad" satırı yok
- [x] E2 Gruplama — aynı kişi, aynı gün, ≤ 5 dk; grup içinde köşeler küçülür, saat yalnız grubun sonunda (`chatThread.ts`, test)
- [x] E3 Gün ayırıcı — Bugün / Dün / gün adı / tarih
- [x] E4 Okundu ve yazıyor — "Görüldü ss:dd" son giden mesajın altında; "yazıyor…" başlıkta ve balon olarak; yoklamayla (D-020, BLK-CHAT-03)
- [x] E5 Snap balonu — dolu kare bekliyor, ok gönderildi, kontur açıldı/süresi doldu; bekleyen dokunulabilir
- [x] E6 Paylaşılan sinyal balonu — tür karosu + başlık + yer; dokununca Sinyal Kartı
- [x] E7 Mesaj eylemleri — tepki, alıntılı yanıt, kopyala, geri al (kendi), bildir (karşı taraf)
- [~] E8 Konuşma listesi — önizleme + snap durumu + okunmamış zaten var; kaydırma eylemleri ve mesaj istekleri klasörü ertelendi (D-020)
- [~] E9 Klavye davranışı — iOS padding / Android height, ters liste en altta kalır, sürükleyince klavye kapanır; cihazda bakılacak

## Faz F — Faz 10 kalanları

- [ ] F1 Destek ve itiraz adresi (engelleyici)
- [ ] F2 P10.10 Yasal metin ekranları
- [ ] F3 P10.7 Hesap silme
- [ ] F4 Veri indirme talebi
- [ ] F5 P10.6 18 yaş altı varsayılanları
- [ ] F6 İzin metinleri
- [ ] F7 Faz 10 kapanışı

## Faz G — Kapanış: i18n, a11y, performans, analitik, QA, yayın

- [ ] G1 Ekran taraması
- [ ] G2 Anahtar eşitliği
- [ ] G3 Yerelleştirme
- [ ] G4 RTL hazırlık
- [ ] G5 Etiketler ve dokunma alanı
- [ ] G6 Harita erişilebilirliği
- [ ] G7 Renk tek başına anlam taşımaz
- [ ] G8 Hareketi Azalt
- [ ] G9 Bütçe ölçümü
- [ ] G10 Liste ve görsel
- [ ] G11 Soyutlama + olay şeması
- [ ] G12 Seed ve demo modu
- [ ] G13 E2E senaryoları
- [ ] G14 Yayın kontrol listesi

## Faz özetleri

<!-- Her faz bitince: ### Faz X — tarih / Yapılanlar / Ertelenenler / Bilinen sorunlar -->

### Faz A — 2026-09-23
- **Yapılanlar:** test hesapları `e2e_` önekli ve geliştirmede gerçek kullanıcıdan gizli; temizlik betiği; tek tazelik kuralı (`freshness.ts`) ve sunucu güveninin okuma modeline taşınması; StatRow tek ifade + ayrı ikonlar; yorum sayfasında tek sayaç satırı; medya yer tutucusu; Faz 3/5/8 denetimi.
- **Doğrulama:** backend kabul betikleri (discover, friends, text-filter, moderation, engagement, content-media, safety, auth, real-catalog) PASS; `typecheck`, `test:nearby`, `test:ui`, `test:i18n` PASS; iOS + Android `expo export` PASS. "Ekranda doğrulama" react-native-web ekran görüntüleriyle yapıldı (`.tmp/product-ui/`); simülatör/fiziksel cihazda kullanıcı bakmalı.
- **Bekleyen (kullanıcı onayı):** A2/A3 toplu silme komutları yukarıda.
- **Bilinen sorunlar:** "Bu alanı tara" ve görünür sayısı haritada duruyor (C11).

### Faz B — 2026-09-23
- **Yapılanlar:** açık tema varsayılan + koyu tema, Ayarlar > Görünüm, Outfit tipografi, yeni yarıçap/buton/gölge/hareket token'ları, tint+ink sinyal renkleri, açık/koyu harita stili ve yeniden tasarlanan pinler, medya ekranları için sabit koyu palet, ham renk taraması, bileşen önizleme.
- **Doğrulama:** `typecheck`, `test:theme` (iki temada tüm metin çiftleri AA), `test:nearby`, `test:product`, `test:i18n`, `test:ui` PASS; iOS + Android export PASS. Ekran görüntüleri iki temada (`.tmp/product-ui/shot-*.png`, `?theme=dark`). Gerçek cihazda Outfit'in yüklenmesi ve tema değişiminde yeniden açılış kullanıcı tarafından görülmeli.
- **Ertelenen:** yok. **Not:** yeni ölçek her ekranda satır yüksekliklerini değiştirdi; C/D/E'de yeniden yazılan ekranlar zaten yeni token'larla kurulacak.

### Faz C — 2026-09-24
- **Yapılanlar:** merkez Sinyal Kartı (`signal/SignalCardModal`, `SignalCard`, `MediaCarousel`, `MediaViewer`, `HealthNotice`; saf mantık `signalCard.ts`), pin/küme dokunuşu kartı açar, tek dokunuşla doğrulama, bildir/engelle/sil, görüntülenme sayımı, kırpılmayan medya (kart ve yer sayfası), tek satır boş durum bandı. Sunucu: `GET /api/posts/{id}` `publicationTrust`, `isMine`, yazara `viewCount`, medya boyutları; `POST /api/posts/views`.
- **Doğrulama:** `test-signal-card.ps1` (BLK-CARD-01) + engagement/discover/authz/map-core/nearby-ux/live-signal/friends PASS; `signal-card.test.ts`, `test:ui` (kart açık/uzak/kendi sinyali, beğeni, doğrulama, sayfalama, menü, yorumlar, kapanış; iki tema ekran görüntüsü), typecheck, i18n, theme, iOS + Android export PASS.
- **Bulunan hata:** Faz A'daki `e2e_` öneki `e2e_location_smoke_` + ms damgasıyla 30 karakteri aşıyordu (kayıt 400); kısaltıldı.
- **Ertelenen:** ReactionBar, menüde sessize al/düzenle/haritadan kaldır (D-018). **Cihazda bakılacak:** kart açılış süresi, nested kaydırma hissi, video otomatik oynatma.

### Faz D — 2026-09-24
- **Yapılanlar:** tek sayfa composer (tür kareleri, seviye, 280 karakter açıklama, yer satırı + yakın yer çipleri, görünürlük, gönder hedefleri Haritaya/Hikayem/Arkadaşlar, sarı Gönder); giden kutusu (`shareQueue.ts` saf kurallar + `shareOutbox.ts` cihazda kalıcı kuyruk, NetInfo/AppState ile uyanma, medya bir kez yüklenir) ve haritada `ShareProgressChip`; kamerada en yakın yer çipi, "Konum belirsiz", hassas yer uyarısı; lens daireleri yerine kaydırma + gösterge; çıkartma eğimi; başlık+açıklama tüm listelerde tek metin; sunucu `fromGallery` → kartta "Galeriden".
- **Doğrulama:** typecheck, test:theme, test:nearby (share-queue, camera-place dahil), test:product, test:i18n, test:ui (tek sayfa yayın, yer seçici, gönder hedefleri, anonim kısıtları, kamera yer çipi/okul uyarısı/lens göstergesi, Galeriden) PASS; BLK-CARD-01 (fromGallery), BLK-CORE-03 medya, BLK-LOCATION-01, güvenilir olay teslimi PASS; iOS + Android export PASS.
- **Cihazda bakılacak:** uçak modunda paylaş → bağlantı gelince yükleniyor mu; kamerada yer çipinin gelme süresi; klavye açıkken tek sayfa kaydırma.

### Faz E — 2026-09-24
- **Yapılanlar:** balon sohbet (`chat/ConversationScreen` yeniden yazıldı; saf düzen `chatThread.ts`), gruplama, gün ayırıcı, "Görüldü", "yazıyor…", snap ve sinyal balonları, uzun basma eylemleri (tepki/yanıtla/kopyala/geri al/bildir), yanıt çubuğu. Sunucu: `POST .../typing`, `otherTyping`, `seen`/`seenAtUtc`, `replyToId` + alıntı, geri alınınca alıntı temizliği.
- **Doğrulama:** BLK-CHAT-03 (yeni), BLK-CHAT-01, BLK-CHAT-02 PASS; `chat-thread.test.ts`, test:ui (balon yönleri, gün ayırıcı, tek "Görüldü", alıntı, sinyal kartı, yazıyor, tepki/kopyala/yanıtla), typecheck, theme, product, i18n, iOS + Android export PASS.
- **Cihazda bakılacak:** klavye açılınca giriş alanı ve liste; uzun basma hissi; "yazıyor"un gecikmesi (≤ ~4 sn).

## Performans ölçümleri (Faz G)

| Metrik | Hedef | Ölçülen | Cihaz |
|---|---|---|---|
| Soğuk açılış → harita | < 2,0 sn | | |
| (+) → kamera | < 500 ms | | |
| Pin → Sinyal Kartı | < 150 ms | | |
| Harita 300 pin | 55+ fps | | |
| API p95 harita/akış | < 300 ms | | |
