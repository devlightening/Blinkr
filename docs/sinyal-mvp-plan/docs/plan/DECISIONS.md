# DECISIONS — Mimari Karar Kaydı

> Plandan saptığın, stack'e uyarladığın veya kullanıcıdan onay aldığın her karar buraya yazılır.
> En yeni en üstte. Kısa tut: bağlam birkaç cümle, karar tek cümle.

## Şablon
```
### D-XXX — Başlık (YYYY-AA-GG)
- Bağlam: Neden bu karar gerekti?
- Seçenekler: A / B / C
- Karar: Seçilen seçenek
- Gerekçe: Neden?
- Etki: Hangi dokümanlar/fazlar etkileniyor?
```

## Kararlar

### D-005 — P2.10 realtime gateway: dokunulmuyor, REST polling korunuyor (2026-09-22)
- Bağlam: D-004, P2.10'u (socket.io tarzı realtime gateway) kök CLAUDE.md §6.5'in bilinçli REST
  polling kararıyla çeliştiği için kullanıcı onayına bloke etmişti.
- Seçenekler: (A) Dokunma, polling korunur, P2.10 Faz 2'de atlanır. (B) WebSocket/SignalR eklenir
  (§6.5'teki kararı tersine çevirir). (C) Karar ertelenir.
- Karar: **(A) — Şimdilik dokunma.** REST polling mimarisi korunuyor; P2.10 Faz 2 kapsamından
  çıkarıldı.
- Gerekçe: Kullanıcının kendi açık tercihi (önerilen seçenek); küçük/geri alınabilir olmayan bir
  mimari değişikliği gerektirmeden mevcut, çalışan ve testli davranış korunuyor.
- Etki: Faz 2'nin geri kalanı (P2.4/P2.8/P2.11) mevcut REST polling mimarisiyle ilerler. P2.10 kalıcı
  olarak `[-]` (uygulanmayacak) olarak işaretlendi; ileride tekrar gündeme gelirse yeni bir karar
  kaydı (D-00X) gerekir, bu karar sessizce geçersiz sayılmaz.

### D-004 — Faz 2 görev listesinin mevcut .NET backend'ine eşlenmesi (2026-09-22)
- Bağlam: Faz 1 tamamlandı, sıra Faz 2'de. Planın Faz 2 görev listesi (`13_ROADMAP_PHASES.md` P2.1-P2.13)
  Node/Postgres+PostGIS referans backend'ini varsayıyor; D-001/D-003 gereği gerçek backend .NET 10 +
  EventStoreDB + MongoDB + PostgreSQL(yalnız Identity) olarak kalıyor. Kod yazmadan önce her P2.x
  görevinin mevcut backend'de karşılığı olup olmadığı netleştirilmeli — aksi halde zaten var olan bir
  şey yeniden yazılır veya kök CLAUDE.md §22'nin "önce darboğazı kanıtla" ilkesi çiğnenir.
- Eşleme (görev → durum → not):
  - **P2.1** (docker-compose: postgres+postgis, redis, minio) → **[-] büyük ölçüde gereksiz.**
    Mevcut `docker-compose.yml` zaten Postgres+Mongo+Redis+RabbitMQ+EventStoreDB çalıştırıyor;
    coğrafi sorgular PostGIS değil Mongo `2dsphere` ile çözülüyor (AUDIT.md §6). Gerçek eksik yalnız
    nesne depolama (MinIO/S3) — bu kök CLAUDE.md §20.1'de zaten bilinen bir gap, MVP'yi bloklamıyor,
    ayrıca **ücretli/hesap gerektiren bir servis seçimi** olduğu için kullanıcıya sorulmadan eklenmez.
  - **P2.2/P2.3** (migration'lar + veri göçü, `08_DATABASE_SCHEMA.md`'ye göre) → **[-] uygulanmaz.**
    Bu, sıfırdan yeni bir şemaya geçişi varsayıyor; mevcut EF Core migration'ları ve Mongo koleksiyonları
    zaten üretimde çalışıyor, kök CLAUDE.md kural 1 ("sıfırdan yazma") bunu yasaklıyor.
  - **P2.4** (ortak altyapı: hata biçimi, doğrulama, sayfalama, idempotency, rate limit, logger) →
    **[ ] kısmen gerçek iş.** Idempotency zaten var (projection inbox). Standart hata biçimi ve
    rate limiting servisler arasında tutarlı değil — bu kök CLAUDE.md §21 "P1 Quality gate" ve
    "P1 Guvenlik ve auth" maddeleriyle örtüşüyor, ayrı bir Faz 2 görevi olarak değil o yol haritası
    altında ele alınacak.
  - **P2.5** (auth: register/login/refresh) → **[x] zaten var.** IdentityService bunu karşılıyor
    (bkz. kök CLAUDE.md §6.1, §14). Apple/Google sosyal girişi yok — ayrı, küçük bir eklenti olur,
    şimdilik plan kapsamında zorunlu değil.
  - **P2.6** (görünürlük fonksiyonu: açık/gizli hesap, engel, anonim, takipçi) → **[x] kısmen zaten
    var.** Anonim paylaşım (`AnonymousMap`) ve engelleme (`BLK-SAFETY-01`, block→relation) üretimde ve
    testli. "Gizli hesap" (private account, takip isteği onaylı görünürlük) kavramı **bilinçli olarak
    yok** — mevcut model "arkadaşlık" (karşılıklı onaylı, bkz. kök CLAUDE.md §2.2 madde 2) ile planın
    tek yönlü "takip" modelinin nasıl bir arada yaşayacağı hâlâ açık bir soru (D-003'te not edildi);
    Faz 6 P6.1'e kadar ertelenir.
  - **P2.7** (sinyal motoru: TTL, doğrulama, bulanıklaştırma, canlı durum, güven puanı, sıralama) →
    **[ ] gerçek iş, kısmen var.** Canlı durum/güven puanı/tazelik zaten üretimde
    (`CurrentPlaceStateCalculator`, kök CLAUDE.md §10.2). Sabit bir TTL motoru YOK — `ExpiresAtUtc`
    çağıran taraf tarafından veriliyor (P1.6'da da not edildi). Bu gerçek, dar kapsamlı bir Faz 2 işi.
  - **P2.8** (medya: presign/complete/worker, EXIF silme, varyant, blurhash, video, temizlik) →
    **[ ] gerçek iş, kısmen var.** Presign sözleşmesi ve EXIF silme snap'lerde zaten var (kök CLAUDE.md
    §6.5); post medyasında blurhash/varyant/orphan temizliği yok — kök CLAUDE.md §15 bunu zaten
    "goz onunde bulundur" diye işaretlemiş bir alan.
  - **P2.9** (sinyal uç noktaları: CRUD, harita bbox+kümeleme, yakındaki yerler) → **[x] zaten var.**
    `POST/GET/PATCH/DELETE /api/posts`, `/api/map/bounds`, `/api/places/nearby` üretimde ve
    `test-product-08.ps1`'de testli (bkz. §13 API Yüzeyi).
  - **P2.10** (realtime gateway: socket.io, `map:*`/`signal:*` odaları) → **[BLOKE — kullanıcı kararı
    gerekir.]** Kök CLAUDE.md §6.5 bilinçli olarak "Chat v1 gerçek zamanlılık için WebSocket/SignalR
    kullanmaz… kısa aralıklı REST polling… sonsuz/agresif polling'e dönüştürülmemeli" diyor — bu daha
    önce verilmiş, belgelenmiş bir karar. Realtime gateway eklemek bu kararı tersine çevirir ve
    Gateway/servisler arası yeni bir bağlantı modeli (WebSocket/SignalR) demektir; küçük/geri alınabilir
    bir değişiklik değil. D-002/D-003'teki gibi **önce kullanıcıya sorulacak**, sessizce eklenmeyecek.
  - **P2.11** (işler: `signal.expire`, `place.aggregate`, `counters.reconcile`) → **[ ] gerçek iş,
    kısmen var.** Projection worker zaten idempotent tüketiyor; sinyal süresi dolması zaten sorgu
    zamanında (`Freshness`/`ExpiresAtUtc`) hesaplanıyor, ayrı bir arka plan expire job'u yok. Açık
    reconciliation/error-queue görünürlüğü kök CLAUDE.md §21 "P1 Uretim guvenilirligi"nde zaten
    listeli — Faz 2'nin kendi görevi olarak değil o yol haritası altında ele alınacak.
  - **P2.12** (paylaşılan tipler + TanStack Query mobil istemcisi) → **[-] şimdilik ertelendi.**
    Mobil zaten kendi `api.ts` sarmalayıcısını kullanıyor (AUDIT.md §6); TanStack Query'ye geçiş büyük
    bir refactor, somut bir sorunu çözdüğü kanıtlanmadan (kök CLAUDE.md §22) başlanmaz.
  - **P2.13** (API entegrasyon testleri: sinyal oluştur → haritada gör → süre dolsun) → **[x] büyük
    ölçüde zaten var.** `test-product-08.ps1`'deki `BLK-LOCATION-01/02`, `BLK-CORE-02` zaten bu zinciri
    kanıtlıyor (bu oturumda tekrar çalıştırıldı, hepsi PASS).
- Karar: Faz 2, yukarıdaki eşlemeye göre **yeniden kapsamlanır**: P2.1/P2.2/P2.3/P2.12 uygulanmaz (`[-]`),
  P2.5/P2.6/P2.9/P2.13 zaten büyük ölçüde karşılanmış sayılır (`[x]`, açık uçları not edilerek),
  P2.4/P2.7/P2.8/P2.11 gerçek, dar kapsamlı işler olarak kalır, P2.10 kullanıcı onayı gelmeden
  başlamaz. Sıradaki somut iş: **P2.7 sinyal motoru TTL'i** (en dar kapsamlı, en az riskli, mevcut
  `ExpiresAtUtc` sözleşmesine ek yapıyor, hiçbir şeyi kırmıyor).
- Gerekçe: Kök CLAUDE.md kural 13 "gereksiz yeni abstraction veya mikroservis ekleme" ve §22 "önce
  darboğazı kanıtla" ilkeleriyle uyumlu; zaten var olanı yeniden yazmamak, gerçek boşlukları dar ve
  geri alınabilir adımlarla kapatmak.
- Etki: `PROGRESS.md`'nin Faz 2 kontrol listesi bu eşlemeyle güncellendi. P2.10 için kullanıcıya
  sorulacak; onaylanmadan Faz 2'de realtime/WebSocket/SignalR kodu yazılmayacak.

### D-003 — Kullanıcı kararı: plan aynen uygulanır, kök anayasa mevcut mimariyi koruyarak güncellendi (2026-09-22)
- Bağlam: D-002'deki iki açık soru kullanıcıya soruldu.
- Karar: (1) Seçenek A — plan aynen uygulanır; kök `CLAUDE.md` §1/§2.1/§2.2'ye eklenen bir §2.3 ile
  bilinçli pivot olarak güncellendi (hikayeler, takip/takipçi, Keşfet feed'i, rozet/seviye/güven puanı
  artık MVP kapsamında; V1.1 "arkadaş konumu" hâlâ Faz 13'te, varsayılan kapalı/opt-in kalmak
  koşuluyla). (2) Backend mimarisi **korunur** — PostgreSQL+PostGIS'e geçiş YOK, EventStoreDB+MongoDB
  authoritative kalır (D-001 ile birebir aynı yönde, artık kesinleşti).
- Gerekçe: Kullanıcının kendi açık tercihi; iki soru da netti, geri dönüş riski taşımıyordu (belge
  güncellemesi + mevcut mimariyi koruma, tersine çevrilebilir kararlar).
- Etki: Faz 1 artık başlayabilir. Kök `CLAUDE.md` §1, §2.1, §2.2 (madde 2 alt satırı), §21 güncellendi.
  Faz 1'den P1.1 (design tokens, kısmi: palet eklendi, `ThemeProvider`/açık tema çalışması hâlâ
  gerekiyor) ve P1.7 (tab bar `Harita · Keşfet · (+) · Sohbet · Profil`, Harita zaten varsayılan
  açılıştı) bu oturumda tamamlandı. Faz 6 P6.1'de "arkadaşlık" (mevcut, karşılıklı onaylı) ile
  planın "takip" (tek yönlü) modelinin nasıl bir arada yaşayacağına karar verilmeli — kök CLAUDE.md
  §2.2 madde 2'de bu açık nokta not edildi.

### D-002 — Faz 1'e geçmeden kullanıcı onayı bekleniyor (2026-09-22, ÇÖZÜLDÜ → bkz. D-003)
- Bağlam: AUDIT.md §7.1 — bu plan (hikayeler, takip/takipçi, feed, rozet/seviye/streak, V1.1 arkadaş
  konumu) kök `CLAUDE.md` Ürün Anayasası'nın §2.2 "Bilinçli olarak yapılmayanlar" listesiyle doğrudan
  çelişiyor. AUDIT.md §7.2 backend'in EventStoreDB+Mongo'dan PostgreSQL+PostGIS'e taşınmasının kök
  belgenin "EventStoreDB authoritative store" kuralıyla çeliştiğini ve veri kaybı riski taşıyan bir
  migrasyon olduğunu tespit etti.
- Seçenekler: (A) Plan aynen uygulanır, kök anayasa bilinçli bir pivot olarak güncellenir. (B) Plan,
  anayasayla çelişen maddeler (hikaye/feed/takip/rozet/streak/arkadaş konumu) çıkarılarak budanır;
  yalnız çelişmeyen kısımlar (Sinyal Kartı, tazelik halkası, StatRow, filtre/çıkartma iyileştirmeleri,
  yorum/tepki — post event sözleşmesinde zaten var) alınır. (C) Plan şimdilik uygulanmaz, ileri-vizyon
  belgesi olarak kalır.
- Karar: **Bekliyor — kullanıcıya soruldu, henüz yanıtlanmadı.**
- Gerekçe: Bu üç seçenek arasında yalnızca kullanıcı karar verebilir; kod veya belge bunu tek başına
  çözemez (00_START_HERE.md §5 kural 12 ve kök CLAUDE.md §25 "celiski kanitla, sonra … karar ver").
- Etki: Faz 1 ve sonrası bu karara kadar başlamıyor.

### D-001 — Backend yeniden yazılmıyor; plan .NET mikroservislerine uyarlanacak (2026-09-22)
- Bağlam: Plan referans stack'i Node/Fastify/NestJS + Prisma/Drizzle varsayıyor; mevcut backend .NET 10
  mikroservisleri (IdentityService/BlogService/PlaceService/NotificationsService + YARP Gateway).
- Karar: 00_START_HERE.md §5 kural 1 ("Sıfırdan yazma, mevcut stack'i koru") gereği backend .NET'te
  kalır. Faz 2'nin görevleri (endpoint'ler, iş kuyrukları, realtime) .NET/EF Core/MongoDB
  repository desenlerine uyarlanır; PostgreSQL+PostGIS'e tam geçiş D-002 çözülmeden yapılmaz.
- Gerekçe: Mevcut mimari zaten çalışıyor, event-sourced ve kanıtlanmış (331 otomatik kontrol); ölçüm
  olmadan büyük mimari değişiklik kök CLAUDE.md §22'nin "önce darboğazı kanıtla" ilkesine aykırı.
- Etki: `07_BACKEND_ARCHITECTURE.md`, `08_DATABASE_SCHEMA.md`, `09_API_SPEC.md` referans olarak
  kullanılır ama birebir uygulanmaz; her sapma burada ayrı satır olarak kayda geçer.

### D-000 — Planın mevcut stack'e uyarlanması
- Bağlam: Plan React Native (Expo) + Node/PostgreSQL referansıyla yazıldı.
- Karar: AUDIT.md §6'daki stack eşleme tablosu doldurulmuştur; öne çıkanlar: Reanimated zaten 3 değil
  4.5.1 ile kurulu (fazla, sorun değil); `expo-router`, TanStack Query, Zustand, `@gorhom/bottom-sheet`,
  `@shopify/flash-list`, `i18next`, Socket.IO, PostGIS, S3/R2, Sentry **hiçbiri kurulu değil** ve
  D-002 çözülene kadar eklenmeyecek.
