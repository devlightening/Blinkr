# 00 — BURADAN BAŞLA (Claude Code Yürütme Talimatları)

Sen bu projede **kıdemli full-stack mobil mühendis + ürün tasarımcısı** rolündesin. Görevin, mevcut
konum tabanlı sinyal uygulamasını global ölçekte kullanılabilecek, profesyonel bir sosyal ağ MVP'sine
dönüştürmek. Bu klasördeki dokümanlar ürünün tamamını tarif eder.

---

## 1. Doküman haritası

| Dosya | İçerik | Ne zaman okunur |
|---|---|---|
| `01_PRODUCT_VISION_AND_AUDIT.md` | Vizyon, mevcut durum analizi, eksiklikler, eklenecekler | Faz 0 |
| `02_INFORMATION_ARCHITECTURE.md` | Navigasyon, ekran haritası, kullanıcı akışları | Faz 0, 1 |
| `03_DESIGN_SYSTEM.md` | Renk, tipografi, bileşenler, hareket, haptik | Faz 1 ve tüm UI işleri |
| `04_SCREENS_MAP_AND_SIGNAL.md` | Harita, pin, Sinyal Kartı (pop-up), gönderi detayı, yorumlar, medya görüntüleyici | Faz 3, 4 |
| `05_SCREENS_CREATE_FEED_STORIES.md` | Kamera, düzenleme, paylaşım akışı, Keşfet akışı, hikayeler | Faz 5, 7 |
| `06_SCREENS_PROFILE_SOCIAL_CHAT.md` | Profil, takip, arkadaşlar, kaydedilenler, sohbet, bildirimler, ayarlar | Faz 6, 8, 9 |
| `07_BACKEND_ARCHITECTURE.md` | Backend mimarisi, servisler, medya hattı, realtime, işler | Faz 2 |
| `08_DATABASE_SCHEMA.md` | PostgreSQL + PostGIS şeması, indeksler, migration | Faz 2 |
| `09_API_SPEC.md` | REST uç noktaları, tipler, WebSocket olayları | Faz 2 ve tüm entegrasyonlar |
| `10_SIGNAL_ENGINE.md` | Sinyal tipleri, TTL, canlı durum hesaplama, güven puanı, sıralama | Faz 2, 3, 7 |
| `11_SAFETY_PRIVACY_MODERATION.md` | KVKK/GDPR, konum gizliliği, moderasyon, App Store kuralları | Faz 10 (ama her fazda dikkate al) |
| `12_I18N_A11Y_PERFORMANCE_ANALYTICS.md` | Çoklu dil, erişilebilirlik, performans, analitik | Faz 11 (ama her fazda dikkate al) |
| `13_ROADMAP_PHASES.md` | Faz faz görevler + kabul kriterleri | HER ZAMAN |
| `14_TESTING_QA_RELEASE.md` | Test stratejisi, seed data, yayın kontrol listesi | Faz 12 |
| `PROGRESS.md` | İlerleme takibi (sen güncellersin) | Her oturum |
| `DECISIONS.md` | Mimari karar kaydı (sen yazarsın) | Karar aldıkça |

---

## 2. Yürütme sırası

```
Faz 0  Keşif & denetim (AUDIT.md üret)          → kod değişikliği YOK
Faz 1  Tasarım sistemi temeli (token + bileşen)
Faz 2  Backend: şema, API, medya, realtime temeli
Faz 3  Harita + Pin + Sinyal Kartı (pop-up)
Faz 4  Gönderi detayı, yorumlar, tepkiler, doğrulama, medya görüntüleyici
Faz 5  Kamera & oluşturma akışı (Snapchat tarzı)
Faz 6  Profil yenileme + takip/arkadaşlık + kaydedilenler
Faz 7  Keşfet akışı + hikayeler
Faz 8  Sohbet yenileme (balonlar, snap, sinyal paylaşımı)
Faz 9  Bildirimler (uygulama içi + push)
Faz 10 Güvenlik, gizlilik, moderasyon
Faz 11 i18n, erişilebilirlik, performans, analitik
Faz 12 QA, seed data, yayın hazırlığı
Faz 13 (Opsiyonel/V1.1) Arkadaş konumu (Ghost Mode), rozet/seviye genişlemesi, lider tablosu
```

Fazlar **sırayla** yapılır. Bir faz bitmeden sonrakine geçme. Her faz sonunda uygulama derlenir ve
çalışır durumda olmalıdır.

---

## 3. Faz 0 — Keşif (ilk iş bu)

Kod değiştirmeden önce repoyu incele ve `docs/plan/AUDIT.md` dosyasını oluştur. İçeriği:

1. **Stack tespiti**: Mobil (React Native/Expo? Flutter? Swift?), dil, navigasyon kütüphanesi,
   state yönetimi, harita kütüphanesi, kamera kütüphanesi. Backend (Node? Supabase? Firebase?
   Django?), veritabanı, dosya depolama, auth yöntemi, realtime yöntemi.
2. **Klasör yapısı** ve önemli dosyaların kısa açıklaması.
3. **Mevcut özellik envanteri**: Harita, sinyal oluşturma, efekt/çıkartma ekranı, "Hâlâ böyle mi?",
   Yakında listesi, sohbet, snap, profil, kaydedilen yerler, anonim paylaşım vb. Her biri için:
   çalışıyor mu, hangi dosyada, hangi API'yi kullanıyor.
4. **Veri modeli**: Mevcut tablolar/koleksiyonlar ve alanları.
5. **Plan ile fark analizi (gap analysis)**: Bu plandaki her ana başlık için "var / kısmen var / yok".
6. **Stack eşlemesi**: Plan referans stack'i (aşağıda) kullanıyor. Mevcut stack farklıysa her
   referans kütüphanenin mevcut stack'teki karşılığını tabloya yaz.
7. **Riskler** ve **açık sorular** (yalnızca kullanıcıya sorulması gerekenler).

AUDIT.md bittikten sonra `PROGRESS.md`'de Faz 0'ı işaretle ve Faz 1'e geç.

---

## 4. Referans stack (mevcut stack farklıysa ona UYARLA, değiştirme)

**Mobil (React Native varsayımıyla):**
- Expo (SDK güncel) + TypeScript (strict), `expo-router` (dosya tabanlı navigasyon)
- Sunucu state: TanStack Query · İstemci state: Zustand · Kalıcı küçük veri: MMKV
- Animasyon: Reanimated 3 + Gesture Handler · Alt sayfalar: `@gorhom/bottom-sheet`
- Liste: `@shopify/flash-list` · Görsel: `expo-image` (blurhash placeholder)
- Harita: `react-native-maps` (mevcutsa kalsın). Özel stil/heatmap ihtiyacı büyürse ileride
  `@rnmapbox/maps` değerlendirilir (DECISIONS.md'ye yaz). Kümeleme: `supercluster`
- Kamera: `react-native-vision-camera` (yoksa `expo-camera`), görsel işleme: `@shopify/react-native-skia`
- i18n: `i18next` + `react-i18next` + `expo-localization`
- Push: `expo-notifications` · Haptik: `expo-haptics`
- Realtime: `socket.io-client` (backend Socket.IO ise) veya mevcut realtime çözümü

**Backend (Node varsayımıyla):**
- Node.js LTS + TypeScript, Fastify veya NestJS (mevcut hangisiyse)
- PostgreSQL 16 + PostGIS · ORM: Prisma veya Drizzle (mevcut hangisiyse)
- Redis (cache, rate limit, BullMQ kuyrukları, socket adapter)
- Obje depolama: S3 uyumlu (Cloudflare R2 / AWS S3), presigned upload
- Medya işleme: `sharp` (görsel), `ffmpeg` (video) worker'da
- Realtime: Socket.IO (Redis adapter)
- Push: Expo Push API (veya FCM/APNs)

> **Mevcut stack Supabase ise:** Postgres+PostGIS, Auth, Storage ve Realtime'ı Supabase ile kullan;
> iş mantığını Edge Functions / RPC (SQL function) ile yaz; RLS politikalarını `11_SAFETY...` ve
> `08_DATABASE_SCHEMA.md`'deki görünürlük kurallarına göre yaz.
> **Mevcut stack Firebase ise:** Firestore koleksiyonlarını şemadaki tablolara eşle, geo sorgular
> için geohash kullan (geofire-common), iş mantığını Cloud Functions'a koy. Eşlemeyi DECISIONS.md'ye yaz.
> **Mobil Flutter veya native ise:** Ekran/bileşen/akış tanımları aynen geçerlidir; kütüphaneleri
> o ekosistemdeki karşılıklarıyla değiştir.

---

## 5. Çalışma kuralları

1. **Kademeli refactor.** Mevcut çalışan özellikleri bozma. Yeni tasarımı bileşen bileşen uygula.
2. **Feature klasörleri.** Kod `features/<alan>` altında toplanır (map, signals, comments, profile,
   social, chat, camera, feed, stories, notifications, settings).
3. **Tasarım token'ları.** Hiçbir UI dosyasında ham hex renk, ham font boyutu, ham boşluk olmaz.
4. **i18n.** Hiçbir UI dosyasında ham kullanıcı metni olmaz. Anahtar isimleri: `map.pin.live`,
   `signal.card.verifyQuestion` gibi noktalı.
5. **Tip güvenliği.** API tipleri tek kaynaktan gelir (`09_API_SPEC.md`'deki tipleri paylaşılan
   `types` paketine/klasörüne koy). `any` yasak (zorunluysa gerekçeli yorum).
6. **İyimser güncelleme (optimistic UI).** Beğeni, tepki, takip, yorum, kaydet, doğrula işlemleri
   anında UI'da yansır, hata olursa geri alınır ve toast gösterilir.
7. **Boş / yükleniyor / hata durumları.** Her liste ve ekranda üçü de tasarlanır (skeleton, empty
   state, hata + tekrar dene).
8. **Erişilebilirlik.** Her dokunulabilir öğede `accessibilityLabel`, minimum 44×44pt dokunma alanı.
9. **Performans.** Uzun listeler FlashList, görseller önbellekli, harita pinleri `tracksViewChanges`
   kapalı (ya da eşdeğeri), gereksiz re-render yok.
10. **Test.** Kritik iş mantığı (sinyal motoru, güven puanı, görünürlük kuralları) birim testli.
    API uç noktaları entegrasyon testli.
11. **Commit disiplini.** Küçük, anlamlı commit'ler: `feat(phase-3): signal card modal`,
    `fix(profile): hide email from public profile`.
12. **Karar kaydı.** Plandan saptığın her durumda `DECISIONS.md`'ye tarih, karar, gerekçe yaz.

---

## 6. "Bitti" tanımı (her faz için)

- [ ] Fazın `13_ROADMAP_PHASES.md`'deki tüm görevleri tamam
- [ ] Kabul kriterleri sağlanıyor
- [ ] Typecheck, lint, testler geçiyor
- [ ] iOS'ta (ve varsa Android'de) açılıp ilgili akış elle denendi (simülatör)
- [ ] Yeni metinler `tr` ve `en` dosyalarında
- [ ] `PROGRESS.md` güncellendi, commit atıldı
- [ ] Kısa faz özeti yazıldı (ne yapıldı, ne ertelendi, bilinen sorunlar)

Faz bitince kullanıcı aksini söylemedikçe bir sonraki faza geç. Engelleyici bir durum (secret
eksikliği, ücretli servis kararı, veri silen migration) varsa dur ve kullanıcıya net bir soru sor.
