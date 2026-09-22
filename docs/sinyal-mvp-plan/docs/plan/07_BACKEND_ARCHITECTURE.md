# 07 — Backend Mimarisi

> Mevcut backend neyse onun üzerine kurulur (bkz. `00_START_HERE.md` §4). Aşağıdaki yapı Node.js +
> PostgreSQL/PostGIS referansıdır; Supabase/Firebase eşlemesi Faz 0'da DECISIONS.md'ye yazılır.

## 1. Genel görünüm
```
 Mobil uygulama
   │  HTTPS (REST /v1)          WSS (Socket.IO)             Presigned PUT
   ▼                            ▼                           ▼
┌──────────────┐        ┌───────────────┐          ┌────────────────────┐
│  API (Fastify│◄──────►│ Realtime GW   │          │ Obje depolama (R2/S3)│
│  / NestJS)   │ Redis  │ (Socket.IO +  │          │  raw/  public/      │
│  modüler     │ pub/sub│  Redis adapter)│          └─────────┬──────────┘
└──────┬───────┘        └───────────────┘                    │ olay/kuyruk
       │ SQL                                                 ▼
       ▼                         ┌───────────────────────────────────────┐
┌──────────────────┐   BullMQ    │ Worker'lar                            │
│ PostgreSQL 16    │◄───────────►│  media: sharp/ffmpeg, blurhash, EXIF  │
│ + PostGIS        │   (Redis)   │  moderation: metin/görsel             │
│ + pg_trgm        │             │  aggregates: yer canlı durumu, sayaçlar│
└──────────────────┘             │  notifications: gruplama + push       │
                                 │  expiry: TTL süresi dolan sinyaller   │
                                 │  trust: güven puanı yeniden hesap     │
                                 └───────────────────────────────────────┘
```
MVP'de API, realtime ve worker aynı repo içinde **üç ayrı süreç** (aynı kod tabanı, farklı giriş
noktası: `api.ts`, `realtime.ts`, `worker.ts`). Tek süreçle başlanabilir; ölçek gelince ayrılır.

## 2. Modüller (klasör yapısı)
```
server/
  src/
    app/            bootstrap, config (zod ile env doğrulama), logger (pino), hata yöneticisi
    modules/
      auth/         kayıt, giriş, Apple/Google, refresh token rotasyonu, şifre sıfırlama
      users/        profil, kullanıcı adı, arama, istatistik, hesap silme
      social/       follow, follow request, block, mute, öneriler
      places/       yakındaki yerler, yer detayı, canlı durum, yer takibi, soru sor
      signals/      oluşturma, okuma, harita sorgusu, akışlar, doğrulama, TTL
      engagement/   tepkiler, yorumlar, yorum beğenisi, görüntülenme, kaydetme, koleksiyonlar
      stories/      hikaye tepsisi, görüldü
      media/        presigned upload, tamamlama, işleme işleri
      chat/         konuşmalar, mesajlar, snap, okundu, mesaj istekleri
      notifications/ uygulama içi bildirim, push cihazları, tercihler
      moderation/   raporlar, otomatik filtre, gizleme, admin uç noktaları
      gamification/ XP, seviye, rozet, seri
    shared/
      db/           şema, migration'lar, seed
      geo/          bbox, mesafe, bulanıklaştırma, geohash yardımcıları
      types/        API tipleri (mobil ile paylaşılır)
      queue/        BullMQ kuyruk tanımları
      realtime/     yayın yardımcıları (emitToUser, emitToRoom)
      i18n/         push/e-posta metinleri (tr, en)
  test/
```
Her modül: `routes.ts` (şema doğrulamalı), `service.ts` (iş mantığı), `repo.ts` (SQL), `*.test.ts`.
İstek/yanıt doğrulaması `zod` ile; tipler `shared/types`'tan dışa aktarılır.

## 3. Kimlik doğrulama
- **Yöntemler:** Sign in with Apple (iOS'ta zorunlu, başka sosyal giriş varsa), Google, e-posta+şifre
  (argon2id). Telefon OTP V1.1.
- **Token'lar:** Access JWT (15 dk, `sub`, `sid`), Refresh token (opak, 30 gün, DB'de hash'li,
  **her kullanımda rotasyon**, yeniden kullanım tespitinde oturum ailesi iptal).
- Mobilde token'lar `expo-secure-store`'da. Access süresi dolunca istemci otomatik refresh (tek uçuş
  kilidiyle, eşzamanlı isteklerde tek refresh).
- Realtime bağlantısı handshake'te access token ile doğrulanır.

## 4. Medya hattı
1. İstemci: `POST /v1/media/upload-url` `{ kind: 'image'|'video', mime, bytes, width, height, purpose }`
   → `{ mediaId, uploadUrl, headers }` (presigned PUT, 10 dk geçerli, `raw/{userId}/{mediaId}`).
2. İstemci yüklemeden önce: görsel en uzun kenar 2048px, JPEG/HEIC → JPEG q0.82; video 720p H.264,
   maks 15 sn / 25 MB.
3. İstemci: `POST /v1/media/{id}/complete`.
4. Worker `media.process`:
   - **EXIF/konum metaverisini sil** (gizlilik — zorunlu).
   - Görsel: `sharp` ile `w1080.webp`, `w540.webp`, `w240.webp` (ızgara), blurhash, boyutlar.
   - Video: `ffmpeg` ile mp4 (720p) + poster jpg + blurhash; süre.
   - Görsel moderasyon (sağlayıcı yapılandırılmışsa, bkz. `11_SAFETY`).
   - `public/{mediaId}/…` altına yaz, `media.status = 'ready'`.
5. Sinyal oluşturma `mediaIds` ile yapılır; medya henüz `processing` ise sinyal `pending_media`
   durumunda oluşur, medya hazır olunca `active` olur ve realtime yayını yapılır.
- **Servis:** Public medya CDN üzerinden (uzun cache). Snap medyası **public değil**: kısa ömürlü
  imzalı GET URL (60 sn), açıldıktan sonra erişim kapatılır ve 24 saat içinde silinir.
- Yüklenip 24 saat içinde bir sinyal/mesaja bağlanmayan medya temizlenir.

## 5. Geo sorgular
- Tüm konumlar `geography(Point, 4326)`. İndeks: GIST.
- **Harita:** `display_location && ST_MakeEnvelope(minLng, minLat, maxLng, maxLat, 4326)`, `status='active'`,
  görünürlük filtresi, maks 500 satır, `created_at DESC`. Zoom < 12 ise sunucu tarafı ızgara
  kümeleme (`ST_SnapToGrid` ile hücre başına sayı + baskın tip) döndürülür; ≥ 12 tekil sinyaller
  (istemci supercluster ile kümeler).
- **Yakındaki:** `ST_DWithin(display_location, :point, :radius)` + mesafe hesabı.
- **Yakındaki yerler:** `ST_DWithin(places.location, :point, 300)` sıralı `ST_Distance`.
- **Bulanıklaştırma:** `10_SIGNAL_ENGINE.md` §3.

## 6. Realtime
- Socket.IO + Redis adapter. Odalar:
  - `user:{userId}` — kişisel: bildirim, DM, takip isteği
  - `conv:{conversationId}` — sohbet mesajları, yazıyor, okundu
  - `signal:{signalId}` — açık Sinyal Kartı/detay için sayaç ve yeni yorum
  - `geo:{geohash5}` — harita canlı güncellemeleri (istemci görünür bbox'ı kapsayan geohash5
    hücrelerine abone olur; maks 12 hücre)
- Yayınlar API ve worker'dan Redis üzerinden yapılır (`shared/realtime`).
- İstemci yeniden bağlanınca kaçırdığı veriyi REST ile tamamlar (`since` parametresi); realtime
  yalnızca "hızlandırıcı"dır, doğruluk kaynağı REST'tir.

## 7. Arka plan işleri (BullMQ)
| Kuyruk | Tetikleyici | İş |
|---|---|---|
| `media.process` | medya complete | Bkz. §4 |
| `moderation.text` | sinyal/yorum/bio/mesaj oluşturma | Filtre + skor, gerekirse gizle |
| `place.aggregate` | yer sinyali/doğrulama değişimi (debounce 10 sn/yer) | Canlı durum hesabı, `place_live_status` güncelle, değiştiyse takipçilere bildirim |
| `signal.expire` | cron her dakika | `expires_at < now()` → `status='expired'`, harita odalarına kaldırma olayı; sahibine "süresi doluyor" bildirimi (10 dk kala) |
| `notify.fanout` | olaylar | Bildirim satırı + gruplama + push gönderimi (Expo Push, 100'lük paketler), geçersiz token temizliği |
| `trust.recompute` | doğrulama/rapor olayı (debounce) + gece toplu | Güven puanı |
| `gamification.award` | olaylar | XP, rozet, seri |
| `snap.cleanup` | cron saatlik | Açılmış/süresi dolmuş snap medyasını sil |
| `account.purge` | cron günlük | 30 günü dolan silme taleplerini kalıcı sil |
| `question.fanout` | soru sor | Yakındaki uygun kullanıcılara push (limitlerle) |

## 8. Cache ve rate limit
- Redis cache: yer canlı durumu (60 sn), kullanıcı profil özeti (5 dk, değişince geçersiz kıl), story tray (30 sn).
- Rate limit (Redis kayan pencere), kullanıcı bazlı:
  - Sinyal: 10/saat, aynı yere 3/30 dk · Yorum: 30/10 dk · Tepki: 120/dk · Takip: 60/saat, 200/gün
  - DM: 60/dk · Soru sor: 5/gün · Rapor: 20/gün · Giriş denemesi: 10/15 dk (IP + hesap)
  - Yeni hesaplar (ilk 24 saat) limitlerin yarısı.
- Aşımda `429` + `retryAfter`.

## 9. Gözlemlenebilirlik
- Yapılandırılmış log (pino, istek kimliği), hata takibi (Sentry — mobil ve backend), temel metrikler
  (istek süresi, kuyruk derinliği, socket bağlantı sayısı). Sağlık uç noktası `GET /health`.

## 10. Ortamlar ve yapılandırma
- `.env.example` tüm değişkenlerle: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `S3_*`, `CDN_BASE_URL`,
  `APPLE_*`, `GOOGLE_*`, `EXPO_ACCESS_TOKEN`, `SENTRY_DSN`, `MODERATION_PROVIDER` (none|openai|aws),
  `MODERATION_API_KEY`, `APP_BASE_URL`.
- Yerel geliştirme: `docker-compose.yml` (postgres+postgis, redis, minio). `pnpm dev` hepsini başlatır.
- Migration'lar sürümlü, geri alınabilir; seed komutu ayrı (`pnpm db:seed`).
