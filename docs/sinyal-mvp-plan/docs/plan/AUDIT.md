# AUDIT — Faz 0 Keşif ve Denetim

> Bu belge kod değiştirmeden yazıldı. Mevcut Blinkr kod tabanının (aynı depoda, bu plan klasörünün
> dışında yaşayan, çalışan bir üründür) tam envanterini çıkarır ve `docs/sinyal-mvp-plan/` planını bu
> gerçekliğe eşler. **§7'de kritik bir çelişki var — Faz 1'e geçmeden önce mutlaka okunmalı.**

## 1. Stack tespiti

### Mobil — `src/Clients/Blinkr.Expo`
- **Framework:** React Native 0.86.3 + Expo SDK 57 (`expo ^57.0.0`), React 19.2.3, TypeScript 6.0.3 (strict).
- **Navigasyon:** `expo-router` YOK. Elle yazılmış, kütüphanesiz `activeTab` state'i (`App.tsx`): `chat | map | nearby | profile`. `MapScreen` her zaman monte kalır; diğer sekmeler onun üzerinde tam ekran katman olarak açılır. Sekme değil, eylem olan tek buton: ortadaki "+" (Paylaşım merkezini açar).
- **Sunucu state:** TanStack Query YOK. Elle yazılmış `fetch` sarmalayıcısı (`api.ts`, 500+ satır): JWT ekleme, 401'de refresh, `AbortController` ile iptal, hata gövdesi ayrıştırma.
- **İstemci state:** Zustand YOK. Yerel `useState`/`useCallback`/`useRef`, prop olarak geçirilir; global store yok.
- **Kalıcı küçük veri:** MMKV YOK. `expo-secure-store` (auth token'ları, kullanıcı başına ad alanına alınmış kayıtlı yerler).
- **Animasyon/hareket:** Reanimated 4.5.1 (planın istediği "Reanimated 3" değil, daha yenisi zaten kurulu) + `react-native-gesture-handler` 2.32 — **zaten kurulu ve yoğun kullanılıyor** (sticker sürükleme, kamera pinch-zoom, sheet geçişleri, buton basma efekti).
- **Alt sayfa:** `@gorhom/bottom-sheet` YOK. Kendi yazılmış `Sheet.tsx` (backdrop + `SlideInDown`/`SlideOutDown`) + `ui/BlinkrSheetPanel.tsx` (görsel kabuk). Native modal kullanılmıyor (haritanın gesture responder'ını kaybetmemek için bilinçli tercih).
- **Liste:** `@shopify/flash-list` YOK. `FlatList`/`ScrollView` (ör. Profil'deki 20 binin üzerinde sinyal, `initialNumToRender=10`, `windowSize=7` ile ayarlanmış).
- **Görsel:** `expo-image` YOK. `react-native` `Image` + kendi `VideoPreview.tsx`.
- **Harita:** `react-native-maps` 1.27.2 (planın referansıyla birebir aynı).
- **Kümeleme:** `supercluster` YOK. Elle yazılmış, test edilmiş `src/mapClusters.ts`.
- **Kamera:** `expo-camera` 57.0.5 (plan "yoksa expo-camera" diyor — zaten bu). `react-native-vision-camera` YOK. Görsel işleme `@shopify/react-native-skia` DEĞİL; SVG tabanlı kendi `FilterOverlay.tsx` (renk katmanı + vignette) ve `react-native-view-shot` ile fotoğrafı dosyaya "yakma" (`PhotoEditor.tsx`).
- **i18n:** `i18next` YOK. Tüm kullanıcı metni Türkçe, kaynak kodun içinde sabit string. Anahtar/çeviri katmanı yok.
- **Push:** `expo-notifications` KURULU DEĞİL (paket yok); NotificationsService backend'i var ama mobil tarafta cihaz kaydı/push alma akışı yok. Bildirim rozeti şu an yalnızca uygulama açıkken kısa aralıklı polling ile hesaplanıyor.
- **Haptik:** `expo-haptics` kurulu, `src/haptics.ts` sarmalayıcısıyla kullanılıyor (arkadaş ekleme, engelleme, bildirim gönderme gibi "sessiz onay" anlarında).
- **Realtime:** Socket.IO YOK. Sohbet REST polling ile çalışıyor (aktif konuşmada ~4 sn, listede ~8 sn) — bu, projenin kendi CLAUDE.md'sinde bilinçli bir MVP kapsam kararı olarak yazılı.
- **Test:** Jest/Detox/Maestro YOK. `tsc --noEmit` tabanlı hafif bir test koşucusu (`npm run test:nearby`, `test:product`, `test:theme`) + Playwright + esbuild ile derlenen bir tarayıcı harness'i (`scripts/ui-test.cjs`, react-native-web kullanır) bileşen davranışını test eder. Native (harita, kamera, dokunma) testleri yalnızca fiziksel cihazda elle yapılabiliyor; bu proje sözleşmesinde açıkça yazılı bir sınır.

### Backend — `src/Services/*`, `src/Gateway`, `src/BuildingBlocks`
Node.js/Fastify/NestJS YOK. **.NET 10 (`dotnet --version` → 10.0.400) mikroservisleri**, C#, ASP.NET Core:

| Servis | Veri katmanı | Sorumluluk |
|---|---|---|
| `IdentityService` | **PostgreSQL** + EF Core (migration'lar elle yazılıyor) | Kayıt/giriş/refresh, JWT (HS256, issuer `Blinkr.Identity`), avatar kataloğu, bio, arkadaşlık (`Friendship`), engelleme (`UserBlock`), rapor (`Report`) |
| `BlogService` | **EventStoreDB** (authoritative event log) + **MongoDB** (read model) + **Redis** (cache) + Postgres (destek) | Post/Sinyal CQRS+Event Sourcing yazma yolu, medya sözleşmesi, yakınlık politikası, unified map composition |
| `PlaceService` | **MongoDB** (geospatial `2dsphere` index, `NearSphere`) | Yer kataloğu (OSM import, 224k+ yer), arama (token tabanlı, Türkçe-duyarsız), canlı durum hesaplama |
| `NotificationsService` | **MongoDB** + RabbitMQ | Bildirimler, cihaz aboneliği, 1:1 sohbet, Snap (view-once medya, yerel disk depolama) |
| `WorkerService` (`Blinkr.Projections.Worker`) | MongoDB tüketici | EventStoreDB → RabbitMQ → Mongo projection, idempotent inbox |
| `ApiGateway` | — | YARP reverse proxy, mobilin tek giriş noktası |
| `IdentityServerService` | — | Solution'da var ama **aktif değil**; canonical JWT authority `IdentityService`'tir (CLAUDE.md'de açıkça yazılı) |
| `MonitoringService` | — | İskelet halinde, üretim seviyesine getirilmemiş |

- **ORM:** Prisma/Drizzle YOK; EF Core (Identity), elle yazılmış Mongo repository sınıfları (Blog/Place/Notifications).
- **PostGIS:** YOK. Coğrafi sorgular MongoDB'nin `2dsphere` index'i ve geodesic mesafe hesapları ile yapılıyor.
- **Obje depolama:** S3/R2 YOK. Medya ve Snap dosyaları yerel diskte (`App_Data/`), statik middleware ile sunulmuyor, imzalı/pencereli erişimle korunuyor.
- **Medya işleme:** `sharp`/`ffmpeg` worker'ı YOK; istemci tarafında sıkıştırma (fotoğraf kalitesi ayarı) ve EXIF temizleme (JPEG APP segmentleri) yapılıyor, sunucu ek işleme yapmıyor.
- **Realtime:** Socket.IO YOK; RabbitMQ yalnızca servisler arası (event delivery), istemciye giden realtime kanal yok — istemci polling yapıyor.
- **Push:** Expo Push API entegrasyonu YOK (NotificationsService cihaz token modeli olsa da mobil tarafta kayıt akışı yok).
- **Rate limit:** BlogService'te sabit pencere limiter (varsayılan 100/dk, `RateLimiting__GlobalPermitLimit` ile açılabilir); merkezi/paylaşılan bir rate-limit katmanı yok.
- **Test:** xUnit/entegrasyon testleri kısmen var (`tests/PlacePosting`), ama esas kabul kanıtı PowerShell smoke script'leridir (`scripts/test-*.ps1`, gerçek Gateway'e karşı çalışır, ~331 kontrol).

## 2. Klasör yapısı (önemli dosyalar)

```
Blinkr/
├── CLAUDE.md                        ← kök "Ürün Anayasası" ve çalışma sözleşmesi (bkz. §7)
├── docs/
│   ├── Product_Constitution_Blinkr_Urun_Anayasasi.docx   ← en üst ürün kaynağı
│   ├── BLK-PRODUCT-08.md            ← son kapsamlı kabul kanıtı
│   └── sinyal-mvp-plan/             ← BU plan (kendi CLAUDE.md'si, docs/plan/*)
├── scripts/                         ← PowerShell smoke testleri + seed script'leri + Node harness'leri
├── src/
│   ├── BuildingBlocks/
│   │   ├── Shared/Auth/             ← JWT sözleşmesi (issuer/audience/claim isimleri, tüm servisler paylaşır)
│   │   └── Shared.Events/           ← Integration event sözleşmeleri (PostCreated, PostLiked, …)
│   ├── Gateway/ApiGateway/          ← YARP route tanımları (appsettings.json)
│   ├── Services/
│   │   ├── IdentityService/         ← .Api / .Application / .Domain / .Infrastructure katmanları
│   │   ├── BlogService/             ← aynı katman deseni, + Publishers/EventStoreToRabbitMqPublisher.cs
│   │   ├── PlaceService/            ← .Api altında Controllers/Domain/Infrastructure/Application
│   │   ├── NotificationsService/    ← Chat + Snap + Notifications aynı serviste
│   │   └── WorkerService/Blinkr.Projections.Worker/
│   └── Clients/Blinkr.Expo/         ← tek aktif mobil istemci (eski MAUI istemcisi tamamen kaldırıldı)
│       └── src/
│           ├── components/          ← ekranlar (düz dosyalar) + camera/ chat/ friends/ map/ snap/ ui/ alt klasörleri
│           ├── theme.ts             ← tek tasarım token kaynağı ("Graphite & Mint" + kameraya özel "flare" altını)
│           ├── api.ts                ← tüm HTTP çağrıları
│           └── *.ts                  ← saf mantık dosyaları (nearbyRequestOwnership, placeSearch, friends, savedLive, …)
```

## 3. Mevcut özellik envanteri (ekran → dosya → API)

| Özellik | Dosya | API |
|---|---|---|
| Kayıt / Giriş / Refresh | `AuthScreen.tsx` | `POST /api/auth/{register,login,refresh}` |
| Harita (Tümü/Canlı/Yerler/Sinyaller katmanları, cluster) | `MapScreen.tsx`, `mapClusters.ts`, `mapSelection.ts` | `GET /api/map/bounds`, `GET /api/map/nearby` |
| Yer/koordinat detay sheet'i, "Hâlâ böyle mi?" | `PostDetailSheet.tsx`, `productPresentation.ts` (`recheckSignal`) | `GET /api/places/{id}`, `GET /api/places/{id}/signals`, `POST /api/posts` |
| Harita araması (Türkçe-duyarsız, yazım hatası toleranslı, mesafe bandına göre sıralama) | `map/MapSearchOverlay.tsx`, `placeSearch.ts` | `GET /api/places/search?q&lat&lon&radiusMeters&expand` |
| 4 adımlı sinyal composer (yer→sinyal→içerik→onay) | `SignalComposer.tsx`, `PlacePicker.tsx` | `POST /api/posts`, `POST /api/posts/place-presence` |
| Uygulama içi kamera (lens/flaş/çevir/pinch-zoom, fotoğraf editörü, çıkartma) | `camera/SignalCamera.tsx`, `camera/PhotoEditor.tsx`, `camera/LensSelector.tsx`, `camera/DraggableSticker.tsx`, `cameraEffects.ts` | dosya üretir, yayın `api.ts`'teki medya presign akışıyla ayrı |
| Medya upload | `api.ts` (`presignMedia`, `uploadMedia`) | `POST /api/v1/media/presign`, `PUT /api/v1/media/uploads/{id}/content` |
| Paylaşım merkezi (Kamera/Galeri/Sadece sinyal/Snap gönder) | `ShareHubSheet.tsx` | — |
| Yakında listesi (1.5 km, tazelik sıralı) | `NearbyScreen.tsx`, `nearbyActivity.ts` | `GET /api/map/bounds` |
| Kayıtlı yerler (cihaz-yerel) + canlı durum rozeti | `savedPlaces.ts`, `savedLive.ts`, `ProfileScreen.tsx` | `GET /api/places/batch?ids=` |
| Profil (sayaçlar, bio, kendi sinyalleri, sayfalanmış) | `ProfileScreen.tsx`, `EditProfileSheet.tsx`, `PostRow.tsx` | `GET/PUT /api/users/me`, `PUT /api/users/me/profile`, `GET /api/posts-read/author/{id}` |
| Avatar seçimi (288 kombinasyonlu çizilmiş karakter, fotoğraf DEĞİL) | `AvatarPickerSheet.tsx`, `avatars.ts`, `Avatar.tsx` | `PUT /api/users/me/avatar` |
| Arkadaşlık (istek/kabul/reddet/geri al/çıkar) | `friends/FriendsScreen.tsx`, `friends/UserProfileSheet.tsx`, `friends.ts`, `friendActions.ts` | `GET/POST/DELETE /api/friends/…` |
| Herkese açık kullanıcı profili | `friends/UserProfileSheet.tsx` | `GET /api/users/{id}` |
| Engelleme | `SettingsScreen.tsx`, `friends/UserProfileSheet.tsx` | `GET/POST/DELETE /api/blocks…` |
| Bildirme (kullanıcı veya sinyal) | `ReportPanel.tsx` | `POST /api/reports` |
| 1:1 Sohbet (Snapchat düzeni: dolu/kontur kare, ok, durum satırı) | `chat/ChatListScreen.tsx`, `chat/ConversationScreen.tsx`, `chat/UserSearchSheet.tsx`, `snapPresentation.ts` | `GET/POST /api/chat/conversations…` |
| Snap (bir kez izlenen fotoğraf; gönderme akışı artık yalnız fotoğraf) | `snap/SnapFlow.tsx`, `snap/SnapSendStep.tsx`, `snap/SnapViewer.tsx` | `POST /api/chat/conversations/{id}/snaps`, `.../messages/{id}/open`, `GET /api/chat/snaps/{id}/content` |
| Ayarlar (hesap, engellenenler, gizlilik özeti, sürüm, OSM atfı) | `SettingsScreen.tsx` | `GET /api/blocks`, `DELETE /api/blocks/{id}` |
| İlk kullanım tanıtımı (3 kart, hesap başına bir kez) | `OnboardingScreen.tsx`, `onboardingContent.ts`, `onboardingStore.ts` | — (yalnızca `SecureStore` bayrağı) |
| Alt gezinme çubuğu | `ui/BlinkrBottomBar.tsx` | — |

**Yok / kısmen var olduğu doğrulanan (planın 4.2/4.3 listesiyle örtüşüyor):**
- E-posta herkese açık profilde YOK artık (`GET /api/users/{id}` yalnız avatar/ad/bio/katılım tarihi/ilişki döner) — plan bunu "sorun" olarak listeliyor ama **mevcut kodda zaten düzeltilmiş durumda**.
- "Taze tazelik/Orta güven güven" tekrarı: `PostDetailSheet.tsx`'te hâlâ `Stat` bileşeni ile "Taze" + "tazelik" ayrı etiketler basılıyor — plan'ın #1 maddesi hâlâ geçerli bir gözlem.
- Kaydedilen yerler hâlâ yalnızca cihaz-yerel (`savedPlaces.ts`, `SecureStore`) — plan'ın #7 maddesi doğru, henüz sunucuya taşınmadı.
- Takip/takipçi, yorum, tepki, hikaye, keşfet akışı, bildirim merkezi, güven puanı/rozet/seviye: **hiçbiri yok**. Sohbet var ama DM'dir, "arkadaş" kavramı vardır fakat açık/genel bir "takip" grafiği ve herkese görünen akış yoktur.

## 4. Mevcut veri modeli

- **PostgreSQL (`IdentityService`):** `Users` (Id, UserName, Email, PasswordHash, Role, AvatarKey, Bio, CreatedAt), `RefreshTokens`, `Friendships` (UserAId/UserBId normalize edilmiş çift, Status: Pending/Accepted/Declined, RequesterId/AddresseeId), `UserBlocks` (BlockerId/BlockedId), `Reports` (ReporterId, TargetType: User/Signal, TargetId, Reason, Note).
- **EventStoreDB (`BlogService`, authoritative):** `PostAggregate` event akışı — `PostCreated`, `PostContentUpdated`, `PostDeleted`, `PostLiked/Unliked`, `PostCommentAdded`, `PostLocationAdded/Updated/Removed`. Post; yazar, konum, `PlaceId`, `PublicationTrust` (VERIFIED_LIVE/NEARBY_PLACE_POST/OUT_OF_RANGE/UNVERIFIED), sinyal tipi/değeri, audience/privacy (`AnonymousMap` dahil), `ExpiresAt`, medya metadata taşır.
- **MongoDB `BlinkrReadModel` (Projection Worker çıktısı):** Sorgulanabilir post projection'ları + idempotent inbox/processed-message kayıtları.
- **MongoDB `BlinkrPlaces` (`PlaceService`):** Yer kataloğu (OSM `ExternalProvider`/`ExternalId` korunur, kategori normalize edilmiş, `SearchTokens`), `PlaceSignal` projection'ları (yazar başına tek ses kuralı ile), coverage kayıtları.
- **MongoDB (`NotificationsService`):** `Conversation` (ParticipantIds, lastMessage* alanları), `ChatMessage` (kind: text/snap, Snap: mediaType/duration/state/expiresAt), `Notification`, `DeviceToken`.
- **Redis (`BlogService`):** Yalnızca cache/hızlandırma; source of truth değil.
- **Cihaz `SecureStore`:** Auth token'ları, kayıtlı yerler (kullanıcı başına ad alanına alınmış), onboarding bayrağı.

Sinyal tipleri (plan'ın "sinyal tipi + seviye" fikriyle bire bir örtüşüyor, zaten var): `GeneralObservation, Crowd, Queue, TemporaryStatus, Offer, Event, NewOpening`. `Freshness` (`FRESH/RECENT/STALE/NONE`) ve `Confidence` zaten hesaplanıyor — planın "Tazelik halkası" / "güven puanı" fikirlerinin çekirdeği zaten üründe var, yalnızca görsel bir "halka" olarak sunulmuyor.

## 5. Gap analizi (plan başlığı → durum)

| Plan başlığı | Durum | Not |
|---|---|---|
| Kamera-öncelikli paylaşım | **Kısmen var** | Kamera zengin (lens, çıkartma, pinch-zoom) ama `(+)` doğrudan kamera açmıyor, önce Paylaşım Merkezi (bilinçli tasarım kararı) açılıyor |
| Harita + pin + Sinyal Kartı (merkez pop-up) | **Var, farklı biçimde** | Sheet alttan açılıyor, planın istediği "merkezde kart" değil |
| Sinyal tipi + seviye + TTL + canlı durum + güven puanı | **Var** | Kavramsal olarak plan ile birebir örtüşüyor, isim farkı yok denecek kadar az |
| "Hâlâ böyle mi?" doğrulama | **Var** | Zaten "ürünün kalbi" statüsünde, plan da aynı şeyi söylüyor |
| Hikayeler (stories) | **YOK** | Kök CLAUDE.md §2.2 açıkça yasaklıyor (bkz. §7) |
| Takip/takipçi + keşfet akışı (feed) | **YOK** | Kök CLAUDE.md §2.2 açıkça yasaklıyor (bkz. §7) |
| Yorum/tepki/@bahsetme | **YOK** | Post'ta `PostLiked`/`PostCommentAdded` event'leri **event sözleşmesinde zaten var** ama mobil UI'da kullanılmıyor — en düşük riskli genişleme adayı |
| Profil ızgarası (Instagram tarzı) | **YOK** | Mevcut profil liste düzeninde (satır satır), ızgara değil |
| Arkadaşlık | **Var, plandan farklı model** | Karşılıklı onaylı "arkadaşlık" zaten var (bu oturumda eklendi); plan "takip" + "karşılıklı takip = arkadaş" modelini istiyor — iki model birbirine dönüştürülebilir ama farklı |
| Kaydedilenler (sunucu senkron, koleksiyon) | **Kısmen var** | Kaydetme var, cihaz-yerel; sunucu senkronu ve koleksiyon yok |
| Bildirim merkezi + push | **Kısmen var** | Backend var (NotificationsService), mobil UI/push kaydı yok |
| Güven puanı/rozet/seviye/streak | **YOK** (çekirdek `Confidence` hariç) | Kök CLAUDE.md streak'i "arkadaş grafiği/takip mekaniği" riski olarak zaten reddediyor |
| Moderasyon/rapor/engelleme | **Var** | Bu oturumda eklendi: engelleme, bildirme, 20/gün rapor sınırı, 7 gün reddedilme soğuma süresi |
| i18n (tr/en) | **YOK** | Sıfırdan kurulmalı; büyük, her dosyaya dokunan bir iş |
| Erişilebilirlik | **Kısmen var** | `accessibilityLabel`/44pt dokunma alanı disiplini zaten var (CLAUDE.md kuralı), ama VoiceOver ile uçtan uca test edilmedi |
| PostgreSQL + PostGIS mimarisi | **YOK, kasıtlı** | Mevcut mimari EventStoreDB+Mongo CQRS/ES; bu, kökten farklı ve köklü bir mimari, aşağıda §7'de ele alınıyor |

## 6. Stack eşleme tablosu

| Plan referansı | Mevcut karşılığı | Aksiyon |
|---|---|---|
| `expo-router` | Elle yazılmış `activeTab` | Planın ekran haritasını (§2) uygulamak için ya `expo-router`'a geçilir (büyük, riskli refactor) ya da mevcut desen genişletilir. **Karar gerekir.** |
| TanStack Query | `api.ts` fetch sarmalayıcısı | Yeni ekranlarda TanStack Query eklenebilir, mevcut ekranlar zorunlu değiştirilmez |
| Zustand | Yerel state | Sosyal grafik/feed gibi paylaşılan state büyüdükçe gerekli olabilir |
| Reanimated 3 | **Reanimated 4.5.1 zaten kurulu** | Fark yok, daha güncel sürüm zaten var |
| `@gorhom/bottom-sheet` | Kendi `Sheet.tsx` | Native modal'dan kaçınma nedeni (harita gesture'ı) hâlâ geçerli; değiştirilmemeli |
| `@shopify/flash-list` | `FlatList` | Büyük listelerde (ızgara profil, feed) gerçek fayda sağlar, eklenebilir |
| `expo-image` | `Image` | Blurhash/placeholder isteniyorsa eklenmeli |
| `react-native-vision-camera` | `expo-camera` (planın kendi fallback'i) | Değişiklik gerekmez, plan zaten bunu kabul ediyor |
| `@shopify/react-native-skia` | SVG tabanlı `FilterOverlay` + `view-shot` | Skia geçişi büyük risk/efor; mevcut çözüm 8 filtreyi zaten karşılıyor |
| `i18next` | Yok | Sıfırdan kurulmalı |
| `socket.io-client` | Yok (REST polling) | Backend'de Socket.IO/SignalR yok; gerçek zamanlılık isteniyorsa **backend değişikliği gerektirir** |
| Node/Fastify/NestJS backend | **.NET 10 mikroservisleri** | Backend yeniden yazılmayacak (bkz. §5 kural 1 "Sıfırdan yazma"); plan'ın Faz 2 backend görevleri .NET'e uyarlanmalı |
| PostgreSQL+PostGIS (tüm veri) | Postgres (yalnız Identity) + EventStoreDB + MongoDB (geospatial) | Coğrafi sorgular zaten Mongo `2dsphere` ile çalışıyor; PostGIS'e taşımak ölçülebilir bir kazanç kanıtlanmadan önerilmez (kök CLAUDE.md §22: "Once metrik, profiling ve yuk testiyle gercek darbogazi kanitla") |
| Prisma/Drizzle | EF Core + elle Mongo repository | Değişmeyecek |
| S3/R2 | Yerel disk | Üretim ölçeği için gerçek bir eksik (kök CLAUDE.md §20.1'de zaten "media object storage, CDN… gerekir" olarak listeli) |
| Sentry | Yok | Eklenmesi gereken, paralı olmayan bir seçenek var (ücretsiz katman); yine de hesap/servis seçimi kullanıcıya sorulmalı |
| Moderasyon sağlayıcı | Yok | **Ücretli servis seçimi gerekir** (bkz. §7) |

## 7. Riskler ve açık sorular

### 7.1 KRİTİK — Bu plan kök CLAUDE.md'nin "Ürün Anayasası"yla doğrudan çelişiyor

Bu depoda kod değiştiren her ajanın önce okuması gereken üst belge `C:\Users\hy971\source\repos\Blinkr\Blinkr\CLAUDE.md`dır ve orada **"Bilinçli olarak yapılmayanlar"** başlığı altında şunlar açıkça yasaklanmış:

> Sonsuz ve eğlence merkezli genel feed · Kullanıcı tutma amaçlı story veya kısa video akışı ·
> Sürekli kişi takibi veya canlı konum izleme · Geniş ve gösterişli profil ekonomisi

Bu plan (`01_PRODUCT_VISION_AND_AUDIT.md` §5 "MVP kapsamı") ise şunları **MVP'nin bir parçası** olarak tanımlıyor: hikayeler, Keşfet akışı (Yakınımda/Takip feed'i), takip/takipçi sosyal grafiği, profil ızgarası, güven puanı/rozet/seviye, "Faydalı" tepkisi gibi oyunlaştırma. Faz 13 ise Snap Map tarzı "Arkadaş konumu (Ghost Mode)" öneriyor — kök belge bunu "sürekli kişi takibi" olarak zaten reddetmiş bir kategori.

Bu, küçük bir stack detayı değil; **ürünün ne olduğuna dair temel bir çatallanma**. Blinkr şu an "kişinin gerçek dünyada daha iyi yer kararı vermesi için var, uygulamada daha fazla zaman geçirmesi için değil" ilkesiyle inşa edilmiş; bu plan ise doğrudan "Instagram + Snapchat" tarzı bir katılım/etkileşim ürünü tarif ediyor.

**Bu yüzden Faz 1'e (kod değişikliği başlayan ilk faz) geçmiyorum ve kullanıcıya soruyorum** — bu hem bu planın kendi kuralı ("yalnızca … ücretli servis seçimi… gerekiyorsa" ve mimari çelişki durumunda `DECISIONS.md`'ye yaz kuralı, ama bu ölçekte bir çelişki önce onay ister) hem de kök CLAUDE.md'nin devraldığım protokolü ("Kod ile bu belge çelişirse önce çelişkiyi kanıtla, sonra Product Constitution'a uygun olan çözümle ikisini birlikte güncelle") gereği.

### 7.2 Mimari risk — Backend'in yeniden platformlanması
Faz 2, verinin PostgreSQL+PostGIS'e taşınmasını, EventStoreDB'nin authoritative write path olma rolünün büyük ölçüde değişmesini ima ediyor. Kök CLAUDE.md §8 EventStoreDB'yi authoritative store olarak sabitlemiş ve "yeni bir yazma akışı MongoDB'ye doğrudan yazarak EventStore'u atlamamalı" kuralı var — planın önerdiği yön bunun tersi bir mimari. Bu, **veri kaybı riski taşıyan (destructive) bir migrasyondur** ve tek başına kullanıcı onayı gerektirir.

### 7.3 Ücretli servis seçimleri (kullanıcı onayı gerekir)
- Görsel/video moderasyon sağlayıcı (`MODERATION_PROVIDER`, Faz 10)
- Obje depolama: Cloudflare R2 / AWS S3 (Faz 2, Faz 12)
- Hata takibi: Sentry (Faz 12) — ücretsiz katman var ama hesap/DSN kullanıcıdan gelmeli
- Push: Expo Push API ücretsizdir ama Apple/Google geliştirici hesabı ve sertifikalar gerekir

### 7.4 Diğer açık sorular
1. Bu plan gerçekten **şimdi** uygulanacak mı, yoksa ayrı bir keşif/ileri-vizyon belgesi olarak mı kalacak? (Cevaba göre Faz 1 hiç başlamayabilir.)
2. Eğer uygulanacaksa: kök CLAUDE.md'nin Ürün Anayasası'nın kendisi mi güncellenecek (bilinçli, belgelenmiş bir pivot olarak) yoksa bu plan mı kök anayasaya uyacak şekilde budanacak (hikaye/feed/takip gibi maddeler çıkarılıp, "Sinyal Kartı", "Tazelik halkası", filtre/çıkartma iyileştirmeleri, StatRow gibi anayasayla çelişmeyen kısımlar mı alınacak)?
3. "Sıfırdan yazma, mevcut stack'i koru" kuralı ile Faz 2'nin "PostgreSQL+PostGIS'e taşı" görevi kendi içinde çelişiyor — mevcut stack zaten EventStoreDB+Mongo; hangisi önceliklidir?
4. `expo-router`'a geçiş (planın ekran haritası dosya-tabanlı yönlendirme varsayıyor) mevcut elle yazılmış navigasyonun yerini mi alacak, yoksa ekran haritası mevcut desene mi uyarlanacak?

## Sonraki adım
Faz 0 burada tamamlandı (kod değişikliği yok, sadece bu belge + `PROGRESS.md`/`DECISIONS.md` güncellemesi). **Faz 1 ve sonrası, §7.1'deki soru kullanıcı tarafından yanıtlanmadan başlamayacak.**
