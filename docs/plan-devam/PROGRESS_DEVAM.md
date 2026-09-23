# PROGRESS — Devam Paketi İlerlemesi

> Tek takip dosyası budur. Her görev bitiminde güncelle. Yeni oturumda önce bunu oku,
> ilk `[ ]` görevden devam et. Durumlar: `[ ]` yapılmadı · `[~]` devam ediyor/yarım ·
> `[x]` tamam ve ekranda doğrulandı · `[-]` ertelendi (neden DECISIONS.md'de).

## Durum

| Alan | Değer |
|---|---|
| Aktif faz | Faz C (A, B tamam; A2/A3 silme kullanıcı onayı bekliyor) |
| Önceki durum | Faz 0–9 işlevsel tamam · Faz 10 yarım (P10.1/3/4/8/9 bitti) |
| Son güncelleme | 2026-09-23 |
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

- [ ] C1 CenterModal kabı
- [ ] C2 Pin dokunuşu artık Sinyal Kartı'nı açar
- [ ] C3 Kart içeriği
- [ ] C4 Medya kırpması düzeltmesi
- [ ] C5 Kart içi yatay kaydırma
- [ ] C6 Etkileşimler
- [ ] C7 Doğrulama akışı kartta
- [ ] C8 ⋯ menüsü
- [ ] C9 Kümeye dokunma
- [ ] C10 Yer sayfası düzeltmeleri
- [ ] C11 Harita üst barı
- [ ] C12 Görüntülenme sayımı
- [ ] C13 Performans

## Faz D — Kamera-öncelikli oluşturma

- [ ] D1 (+) doğrudan kamerayı açar
- [ ] D2 Kamera ekranı tamamlanır
- [ ] D3 Yer algılama kamerada
- [ ] D4 Efekt ekranı: filtre kaydırmayla
- [ ] D5 Çıkartmalar
- [ ] D6 Detaylar tek sayfa
- [ ] D7 Başlık verisi göçü
- [ ] D8 Gönder ekranı
- [ ] D9 Arka planda yükleme
- [ ] D10 Galeri kuralları
- [ ] D11 Hassas yer uyarısı

## Faz E — Sohbet yenileme

- [ ] E1 Balon UI
- [ ] E2 Gruplama
- [ ] E3 Gün ayırıcı
- [ ] E4 Okundu ve yazıyor
- [ ] E5 Snap balonu
- [ ] E6 Paylaşılan sinyal balonu
- [ ] E7 Mesaj eylemleri
- [ ] E8 Konuşma listesi
- [ ] E9 Klavye davranışı

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

## Performans ölçümleri (Faz G)

| Metrik | Hedef | Ölçülen | Cihaz |
|---|---|---|---|
| Soğuk açılış → harita | < 2,0 sn | | |
| (+) → kamera | < 500 ms | | |
| Pin → Sinyal Kartı | < 150 ms | | |
| Harita 300 pin | 55+ fps | | |
| API p95 harita/akış | < 300 ms | | |
