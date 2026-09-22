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
