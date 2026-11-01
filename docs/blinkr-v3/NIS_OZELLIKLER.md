# Blinkr V3 — Niş özellikler yol haritası (2026-10-03)

Ürün, tasarım, backend, mobil ve güven-güvenlik (T&S) bakışıyla hazırlandı. Amaç: Blinkr'i Instagram/Snapchat'in
küçük bir kopyası olmaktan çıkarıp **"orası şu an nasıl, ve buna güvenebilir miyim?"** sorusunda rakipsiz yapmak.

Her özellik anayasanın dört sorusundan geçer (daha hızlı karar · daha güvenilir · mahremiyet · map/place-first) ve
şu çizgileri aşmaz: seri (streak) yok, sıralama tablosu yok, sürekli konum takibi yok, opak "güven puanı" yok,
etkileşim için mahremiyet zayıflatılmaz.

| # | Özellik | Neden niş | Durum |
|---|---|---|---|
| 1 | **Yerin Ritmi** — haftanın günü × saat yoğunluğu | Google "Popüler saatler" pasif konum takibiyle çalışır; Blinkr yalnız gönüllü ve sunucunun doğruladığı sinyallerden üretir | **Yapıldı** (D-037) |
| 2 | **Haber ver** — "sakinleşince haber ver" | Karar aracı, bağımlılık kancası değil: bir kez tetiklenir ve kapanır | **Yapıldı** (D-038) |
| 3 | **Yere sor** — "boş masa var mı?" | Talep üzerine taze veri; yalnız sunucunun yakında doğruladığı kişi yanıtlar, yanıt sinyal olur | **Yapıldı** (D-039) |
| 4 | **Yer özellikleri** — Wi-Fi, priz, sessiz, çocuk dostu, erişilebilir | Statik yorum sitelerinin aksine her özellik zamanla solar: "3 kişi · son teyit 3 gün önce" | **Yapıldı** (D-040) |
| 5 | **Yerel rehber** — mahalle rozeti | Açıklanabilir itibar (doğrulanmış sinyal + "işime yaradı"); tablo yok, seri yok | Planlandı |
| 6 | **Koleksiyonlar** — paylaşılabilir yer listeleri | Instagram Rehberleri gibi, ama canlı durumlu | **Yapıldı** (D-041) |

## Doğrulama (BLK-NICHE-01)
- `scripts/test-niche-features.ps1`: D-033…D-041 için uçtan uca kabul betiği (Gateway, RabbitMQ, iki servis). Backend ayaktayken çalıştırılır; 2026-10-03 itibarıyla **henüz çalıştırılmadı**.
- `scripts/seed-place-rhythm.ps1 -PlaceId <id>`: ritim grafiğini görmek için geliştirme verisi (yalnız `place_signals`, `-Remove` ile geri alınır).
- Betik yazılırken bulunan ve düzeltilen hata: sinyal değerleri büyük/küçük harf duyarlı karşılaştırılıyordu ("Busy" uygulamadan, "BUSY" eski istemci ve testlerden, eski "EMPTY"/"LONG"). Ritim, izleme eşleşmesi, bildirim metinleri ve durum değişikliği algılayıcısı artık duyarsız; aksi halde "BUSY" sinyali ritimde sayılmazdı ve "Yeni bilgi gelince" izleyenlerine sahte "değişti" bildirimi giderdi.
- Bilinen, önceden var olan risk: `CurrentPlaceStateCalculator` değerleri büyük/küçük harf duyarlı grupluyor ("Busy" ve "BUSY" ayrı grup). Algılayıcı bunu sahte değişim saymaz ama oylar bölünebilir; ayrı bir düzeltme olarak ele alınmalı.

## 1. Yerin Ritmi (yapıldı)

- **Kaynak:** PlaceService `place_signals` (silinmez, TTL yok). Son 8 hafta, yalnız `VERIFIED_LIVE`, yalnız
  Doluluk ve Bekleme; ikisi aynı 0..1 ölçeğe iner (Sakin/Sıra yok = 0, Hareketli/5–15 dk = ½, Kalabalık/15+ = 1).
- **Kişi başına tek ses:** aynı kişinin aynı gün aynı saatteki gözlemleri tek gözlemdir.
- **k-anonimlik (T&S):** bir saat ancak **en az 3 farklı kişi** o saatte bildirmişse gösterilir; aksi halde
  "yeterli veri yok". Böylece grafikten tek bir kişinin rutini ("her pazartesi 08:00 bu salonda") okunamaz.
  Toplam 8 gözlemin altında yerin ritmi yok sayılır.
- **Saat dilimi:** Türkiye (UTC+3, yaz saati yok), sunucuda hesaplanır.
- **Uç:** `GET /api/places/{id}/rhythm` (herkese açık toplam; 10 dk önbellek). Yanıtta kim, metin, medya yok.
- **Arayüz:** yer sayfasında "Yerin ritmi" kartı: gün seçici (Pzt..Paz, bugün seçili), tek renkli çubuklar (şu anki
  saat dolu renk), veri olmayan saat kesikli çizgi (sıfır gibi gösterilmez), çubuğa dokununca "19:00 · genelde
  kalabalık", üstte tek cümle "Genelde bu saatte hareketli · En sakin: 15:00", altta dayanak notu.

## 2. Haber ver (yapıldı, D-038)
- Yer sayfasında "Sakinleşince haber ver" / "Açılınca haber ver". Kişi başına en fazla 5 aktif izleme, 12 saat sonra
  kendiliğinden biter, tetiklenince kapanır.
- PlaceService, doğrulanmış yeni sinyal canlı durumu değiştirdiğinde `PlaceStateChanged` entegrasyon olayı yayınlar
  (checkpoint/at-least-once kuralı aynı); NotificationsService izleyenlere uygulama içi bildirim (ve G1 gelince push)
  üretir. İzleme kimseye gösterilmez; kimin hangi yeri izlediği hiçbir yanıtta yoktur.
