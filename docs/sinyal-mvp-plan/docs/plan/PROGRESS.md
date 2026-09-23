# PROGRESS — İlerleme Takibi

> Claude Code bu dosyayı her görev bitiminde günceller. Yeni oturumda önce bu dosyayı oku ve ilk `[ ]` görevden devam et.
> Durumlar: `[ ]` yapılmadı · `[~]` devam ediyor · `[x]` tamam · `[-]` ertelendi (nedeni DECISIONS.md'de)

## Durum özeti

| Alan | Değer |
|---|---|
| Aktif faz | Faz 10 — güvenlik, gizlilik, moderasyon |
| Son tamamlanan görev | P9.3 (bildirim ekranı) — Faz 9 kapandı |
| Son güncelleme | 2026-09-23 |
| Engelleyici | Faz 3'ün geri kalanı (P3.5-P3.7, P3.9, P3.11-P3.12) Faz 4/6/9 backend'ine bağımlı. Sıradaki mantıklı adım: Faz 4'ün backend'i (.NET'te yorum/beğeni uç noktaları) — Sinyal Kartı'nın geri kalanının önünü açar. |


## Faz 0 — Keşif ve denetim

- [x] P0.1 Repo yapısını, paket dosyalarını, env dosyalarını incele
- [x] P0.2 Mobil ve backend stack'ini tespit et
- [x] P0.3 Mevcut özellik envanterini çıkar (her ekran → dosya → API)
- [x] P0.4 Mevcut veri modelini çıkar
- [x] P0.5 Gap analizi (plan başlıkları: var / kısmen / yok)
- [x] P0.6 Stack eşleme tablosu (referans kütüphane → mevcut karşılığı / eklenecek)
- [x] P0.7 `AUDIT.md` ve ilk `DECISIONS.md` kayıtlarını yaz; açık soruları listele

→ Sonuç: `AUDIT.md` (7 bölüm tam), `DECISIONS.md` D-000/D-001/D-002. D-002 kullanıcıya soruldu ve
D-003 ile çözüldü (bkz. DECISIONS.md): plan aynen uygulanır, mevcut backend mimarisi korunur.

## Faz 1 — Tasarım sistemi temeli

- [x] P1.1 `design-system/tokens`: palette, semantik renkler (koyu + açık), tipografi, boşluk, radius, motion, haptics — `src/theme.ts`'e plan'ın ham paleti (`ink*`, `mint*`, `sun*`, sinyal renkleri, `levelScale`) ve `semanticColors.{dark,light}` (bg/text/border/accent/state, plan §2.2 tabloyla birebir) eklendi. D-001 gereği ayrı bir `design-system/tokens` klasörü değil, tek kaynağa (`theme.ts`) ek — mevcut 100+ dosyanın düz `colors` importu hiç değişmedi. Tipografi/boşluk/radius/motion zaten vardı (bu oturumdan önce), değişmedi.
- [x] P1.2 `ThemeProvider` + `useTheme()`; sistem temasını izle, Ayarlar'dan değiştirilebilir altyapı — `src/components/ThemeProvider.tsx` (`App.tsx`'in kökünde monte), tercih (`system|dark|light`) `SecureStore`'da kalıcı, `resolveThemeMode` saf fonksiyonu testli (`test:theme`). **Bilinçli olarak eksik bırakılan:** hiçbir ekran henüz `useTheme().palette` okumuyor, bu yüzden Ayarlar'da "Görünüm" anahtarı da henüz YOK — böyle bir anahtar hiçbir şeyi değiştirmeden eklense yanıltıcı olurdu. Ekranlar `semanticColors`'a taşındıkça bu anahtar eklenecek.
- [x] P1.3 Font kurulumu (Bricolage Grotesque, Türkçe glif testi) + `Text` bileşeni (variant prop'lu) — `@expo-google-fonts/bricolage-grotesque` kuruldu (600/700 ağırlık), `App.tsx` kökte `useFonts` ile yükleniyor; yükleme **hiçbir zaman sonsuza kadar bloklamaz** (`fontsSettled = loaded || error`, mevcut `isRestoring` yükleme ekranına eklendi — yavaş/başarısız font asla açılışı kilitlemez). Yeni `theme.ts`: `displayTypography` (`display`/`title1`/`title2`, plan §3 tabloyla birebir), yeni `ui/BlinkrText.tsx` (`variant` prop'lu, mevcut `typography` adımlarını da kapsar). Hiçbir mevcut ekran buna taşınmadı (kademeli). **Türkçe glif testi kısmi:** Google Fonts paketi `latin-ext` alt kümesini listeliyor (ğ/ş/ı/İ/ç/ö/ü bu blokta) ve "Kit" sahnesinde Türkçe karakterli örnek metin doğru render oluyor (`.tmp/product-ui/shot-kit.png`) — ama bu tarayıcı önizlemesi gerçek font dosyasını yüklemiyor (yalnız string/encoding'in bozuk olmadığını doğrular). Gerçek font glifiyle görsel doğrulama fiziksel cihaz/simülatör gerektirir, henüz yapılmadı.
- [x] P1.4 i18n altyapısı (i18next, tr/en, dil algılama) — **yalnız altyapı kapsamında tamam; ekran ekran metin taşıma bilinçli olarak bu oturumun dışında bırakıldı (aşağıya bkz.)**. `i18next`+`react-i18next`+`expo-localization` kuruldu, `app.config.js`'nin `plugins` dizisine `expo-localization` elle eklendi (dinamik config nedeniyle otomatik yazım başarısız oldu). Yeni `src/i18n/index.ts`: `initI18n()` (idempotent, modül düzeyinde init bayrağı), `AVAILABLE_LANGUAGES = ['tr','en']`, `DEFAULT_LANGUAGE = 'en'`, `supportedLanguage()` (desteklenmeyen cihaz dili → `en`, plan'ın kuralı — kaynak dil `tr` olsa bile). 9 namespace (`common, map, signal, create, feed, profile, chat, settings, errors`) × 2 dil = 18 JSON dosyası, uygulamadan gerçek metinlerle tohumlandı (uydurma değil). `App.tsx` ve tarayıcı harness'i (`scripts/ui-preview.tsx`) kök seviyede `initI18n()` çağırıyor — harness `App.tsx`'i hiç import etmediği için kendi çağrısı gerekiyordu, aksi halde `t()` tüm testlerde ham anahtar döndürüp mevcut Türkçe metin assertion'larını sessizce kırardı (bu riski önceden görüp düzeltildi). Harness'in native-stub alias listesine `expo-localization`/`expo-font`/`@expo-google-fonts/bricolage-grotesque` eklendi (`scripts/ui-build.cjs`), `ui-native-stub.tsx`'e `getLocales()` (`?lang=` URL parametresini okur, varsayılan `tr`) ve `useFonts` eklendi. **İlk gerçek kullanım:** `ui/BlinkrBottomBar.tsx`'in tab etiketleri artık `useTranslation('common')` üzerinden geliyor (sabit `tabLabels` yerine `tabLabelKeys` → `t()`); `test:ui`'de `?lang=en` (İngilizce), `?lang=de` (desteklenmeyen → `en`'e düşer, `tr`'ye değil) ve parametresiz (varsayılan `tr`) üç senaryo gerçek assertion'la doğrulandı. Yeni `scripts/i18n-keys.test.ts` + `npm run test:i18n`: tr/en anahtar kümeleri her namespace'te birebir eşit mi ve hiçbir çeviri boş mu — plan'ın kendi "CI'da eksik anahtar kontrolü" kuralını karşılıyor, yeşil. **Bilinçli olarak kapsam dışı bırakılan:** uygulamanın geri kalan onlarca ekranındaki yüzlerce ham Türkçe string'in `t()` çağrılarına taşınması — bu, plan'ın kendi notunun da işaret ettiği gibi tek oturumda bitmeyecek büyüklükte bir iş; ekran ekran, her taşımadan sonra `test:ui` ile doğrulanarak ilerleyecek (Faz 2+ sırasında, ilgili ekrana zaten dokunulduğu işlerde kademeli olarak yapılacak — ayrı bir "büyük i18n taşıma oturumu" planlanmadı, kademeli refactor kuralına uyularak).
- [x] P1.5 Temel bileşenler — plandaki 15 bileşenin 14'ü artık karşılanıyor. Bu oturumda yeni: `ui/BlinkrFreshnessRing.tsx` (`FreshnessRing`, imza öğe — `progress` doğrudan `productPresentation.ts`'teki `freshnessProgress()`'ten, canlı nabız `isFreshnessPulseDue()`'dan gelir, ikisi de testli), `ui/BlinkrTypeBadge.tsx` (`TypeBadge` — `BlinkrSignalCard`'daki tekrar eden rozet kodunu değiştirdi), `ui/BlinkrLevelMeter.tsx` (`LevelMeter`), `ui/BlinkrToast.tsx` (`Toast`), `ui/BlinkrIconButton.tsx` (`IconButton`, glass/surface/plain · 36/44), `ui/BlinkrSegmentedControl.tsx` (`SegmentedControl`, kayan gösterge Reanimated ile), `ui/BlinkrErrorState.tsx` (`ErrorState`). `Avatar`'da "hikaye halkası" ayrı bir bileşen olarak değil, `FreshnessRing` ile `Avatar`'ı sarma kompozisyonuyla karşılanıyor (plan da bunu "Halka: unseen/seen" olarak `FreshnessRing`'in kullanım yerlerinden biri sayıyor) — "Kit" sahnesinde üç örnekle gösteriliyor. Hepsi `test:ui`'de gerçek assertion'la doğrulandı (`scripts/ui-test.cjs`, "Kit" sahnesi). Zaten farklı adlarla var olanlar: `Button`→`ui/BlinkrButton`, `Chip`→`ui/BlinkrChip`, `Sheet`→`components/Sheet`+`ui/BlinkrSheetPanel`, `Skeleton`→`ui/BlinkrSkeleton`, `EmptyState`→`ui/BlinkrEmptyState`. **Bilinçli olarak eksik bırakılan tek bileşen:** `CenterModal` (Sinyal Kartı'nın harita merkezinde açılıp/kapanması) — bu, Faz 3 P3.5/P3.6'nın tanımlı işi, o fazın Sinyal Kartı tasarımıyla birlikte yapılacak. `Toast`/`ErrorState`/`IconButton` henüz hiçbir gerçek ekranda kullanılmıyor; mevcut ad-hoc eşdeğerleri (`MapScreen`'in toast'u, ekranların kendi hata+"Tekrar dene" satırları, kamera/sheet'lerin elle yazılmış yuvarlak butonları) bunlara taşınmadı — o taşıma ilgili ekrana dokunulacağı bir sonraki işte yapılır.
- [x] P1.6 Sinyal tipi kataloğu (istemci): tip → renk, seviye etiketleri — tek kaynak dosya. Yeni `src/signalCatalog.ts` (`SIGNAL_CATALOG`), daha önce üç ayrı dosyada dağınık olan veriyi birleştirdi: `signalLabels` (`presentation.ts`) ve `signalOptions` (`productPresentation.ts`) artık bu kataloğun türetilmiş re-export'ları — eski import eden hiçbir dosya değişmedi, testli (`product-presentation.test.ts`: katalog ile eski isimler her tip için birebir eşleşiyor). **Bilinçli olarak dışarıda bırakılanlar:** (a) ikon eşlemesi kataloğa taşınmadı, `SignalSymbol.tsx`'te kaldı — ilk denemede ikon'u da kataloğa taşıyınca `lucide-react-native` (→ `react-native`'in Flow sözdizimli dosyalarını içeriyor) `test:nearby`/`test:product`'ın düz `tsc`+`node` boru hattına sızdı ve `SyntaxError: Unexpected token 'typeof'` ile kırıldı (bundler'sız pipeline `react-native`'i hiç parse edemiyor); bu gerçek bir hataydı, düzeltilip testle kilitlendi. (b) TTL bilgisi eklenmedi — `10_SIGNAL_ENGINE.md`'nin TTL tablosu backend'de henüz uygulanmıyor (`BlogService`'te `ExpiresAt` çağıran tarafından veriliyor, sabit değil); burada uydurma dakika değeri yazmak sunucunun vermediği bir garanti iddia etmek olurdu — gerçek TTL motoru Faz 2 P2.7'nin işi.
- [x] P1.7 Yeni tab bar: Harita · Keşfet · (+) · Sohbet · Profil (Keşfet şimdilik mevcut "Yakında" ekranını gösterir); Harita varsayılan açılış — `ui/BlinkrBottomBar.tsx` sırası ve "Yakında"→"Keşfet" etiketi güncellendi, `scripts/ui-test.cjs` uyarlandı, `npm run typecheck`/`test:theme`/`test:ui` yeşil.
- [x] P1.8 Mevcut ekranlarda hızlı düzeltmeler — plandaki 4 alt madde de tamam: (a) yeni `ui/BlinkrStatRow.tsx` (`StatRow`), `PostDetailSheet.tsx`'teki ad-hoc `Stat`+`statDivider` bununla değiştirildi, "Orta güven **güven**" tekrarı çözüldü (`.tmp/product-ui/shot-detail-detail.png`). (b) #4 başlık/etiket tekrarı: yeni `meaningfulTitle()` (`src/presentation.ts`, testli) — composer boş başlık bırakıldığında tip adını başlık olarak gönderiyordu; `PostRow.tsx`, `PostDetailSheet.tsx`, `nearbyActivity.ts` düzeltildi. (c) #5 profilde e-posta zaten daha önce gizlenmişti (AUDIT.md §3). (d) #11 üst bar safe-area: `MapTopChrome` artık zorunlu `topInset` prop'u alıyor (`MapScreen.tsx` → `insets.top`), önceden `top: 0` sabitti — durum çubuğuna/çentiğe yapışma tarayıcı harness'inde görünmüyordu (çentik simülasyonu yok), gerçek cihazda görünen bir bug'dı; `.tmp/product-ui/shot-map.png` ile doğrulandı.
- [x] P1.9 Bileşen önizleme ekranı (yalnızca dev build'de) — `/dev/components` kelimenin tam anlamıyla değil (proje `expo-router` kullanmıyor, D-001 gereği mevcut ekran-değiştirme deseni korunuyor): yeni `DevComponentPreview.tsx`, `Ayarlar > Geliştirici > Bileşen önizleme` üzerinden açılıyor, yalnızca `__DEV__` true iken görünür (üretim build'inde bu bölüm hiç render edilmez). Tarayıcı harness'indeki "Kit" sahnesiyle aynı kataloğu kapsıyor ama gerçek uygulamanın **kendi içinde**, gerçek cihazda çalışan bir ekran — `test:ui`'de gerçek assertion'larla doğrulandı (`.tmp/product-ui/dev-component-preview.png`).

→ **Faz 1 tamam.** P1.4'ün altyapı kapsamı bitti (yukarı bkz.); ekran ekran metin taşıma kademeli olarak
sonraki fazlarda, ilgili ekrana zaten dokunulan işlerin içinde yapılacak. `npm run typecheck` /
`test:theme` / `test:nearby` / `test:product` / `test:ui` / `test:i18n` hepsi yeşil; `npx expo export
--platform ios` ve `--platform android` yeşil (bu oturumda i18n altyapısıyla birlikte tekrar doğrulandı).
Sıradaki görev: **Faz 2, P2.1** (yerel geliştirme ortamı: docker-compose, `.env.example`) — ancak D-001/
D-003 gereği Faz 2'nin PostgreSQL+PostGIS geçiş önerisi uygulanmayacak, mevcut .NET/EventStoreDB/Mongo
mimarisi korunacak; P2.1'e başlamadan önce Faz 2'nin görev listesi mevcut backend'e nasıl eşleneceği
açısından yeniden gözden geçirilmeli (AUDIT.md §6 stack eşleme tablosuna bakılarak).

## Faz 2 — Backend temeli

→ **D-004 (DECISIONS.md) ile yeniden kapsamlandı:** bu liste artık planın orijinal Node+PostgreSQL+PostGIS
varsayımı değil, mevcut .NET/EventStoreDB/Mongo backend'ine göre okunmalı. Her satırdaki not D-004'teki
gerekçenin özetidir; tam gerekçe için D-004'e bakın.

- [-] P2.1 docker-compose (postgres+postgis, redis, minio) — büyük ölçüde gereksiz, mevcut compose zaten
  Postgres+Mongo+Redis+RabbitMQ+EventStoreDB çalıştırıyor; PostGIS yerine Mongo `2dsphere` kullanılıyor.
  Tek gerçek eksik MinIO/S3 (ücretli/hesap gerektirir, kullanıcıya sorulmadan eklenmez).
- [-] P2.2 Migration'lar (08'deki şema) — uygulanmaz, sıfırdan şema varsayıyor; mevcut EF Core
  migration'ları ve Mongo koleksiyonları korunuyor (kural 1: sıfırdan yazma).
- [-] P2.3 Veri göçü (tip eşleme, follows) — uygulanmaz, aynı nedenle; "arkadaşlık→takip" birlikte
  yaşama sorusu D-003'te ayrı not edildi (Faz 6 P6.1'e kadar açık).
- [ ] P2.4 Ortak altyapı (hata biçimi, sayfalama, idempotency, rate limit, logger) — idempotency zaten
  var (projection inbox); hata biçimi/rate limit tutarsız. Ayrı Faz 2 görevi değil, kök CLAUDE.md §21
  "P1 Quality gate"/"P1 Güvenlik ve auth" yol haritası altında ele alınacak.
- [x] P2.5 Auth (register/login/refresh) — zaten var (IdentityService). Apple/Google sosyal giriş yok,
  ayrı küçük eklenti, plan kapsamında zorunlu değil.
- [x] P2.6 Görünürlük fonksiyonu (engel, anonim) — zaten var ve testli (`BLK-SAFETY-01`, `AnonymousMap`).
  "Gizli hesap" kavramı bilinçli olarak yok; arkadaşlık/takip birlikte yaşama sorusu açık (D-003).
- [x] P2.7 Sinyal motoru: **TTL** — **gerçek bir bug bulundu ve düzeltildi.** İlk incelemede sunucuda
  zaten bir TTL motoru olduğu ortaya çıktı (`CreatePostCommandHandler.GetDefaultExpiry`: Crowd/Queue 1
  saat, TemporaryStatus 3 saat, Event/Offer 24 saat, NewOpening 7 gün, varsayılan 24 saat — istemci
  `ExpiresAt` göndermezse bu devreye giriyor, gönderirse `[şimdi, +30 gün]` aralığında doğrulanıyor).
  Gerçek sorun: mobil `SignalComposer.tsx` her sinyal türü için sabit **3 saat** gönderiyordu
  (`new Date(Date.now() + 3*60*60*1000)`), bu yüzden sunucunun tür bazlı varsayılanı hiç çalışmıyordu —
  `Crowd`/`Queue` gerekenden 3x uzun, `Event`/`Offer`/`NewOpening` gerekenden çok kısa yaşıyordu. Bu,
  "Trust is server-owned" (kök CLAUDE.md §2.1) ilkesinin sessizce ihlaliydi. Düzeltme: composer artık
  `expiresAt` hiç göndermiyor (`SignalComposer.tsx`), `CreateSignalInput.expiresAt` isteğe bağlı yapıldı
  (`types.ts`) — sunucunun tür bazlı varsayılanı her zaman geçerli. `typecheck`/`test:nearby`/
  `test:product`/`test:ui` yeşil; tam backend kabul paketi (`test-product-08.ps1`, tüm `BLK-*` senaryoları
  dahil) bu değişiklikle yeniden çalıştırıldı, hepsi PASS.
- [ ] P2.8 Medya (blurhash, varyant, orphan temizliği) — presign + EXIF silme (snap) zaten var; post
  medyasında blurhash/varyant/temizlik yok (kök CLAUDE.md §15'te zaten bilinen gap).
- [x] P2.9 Sinyal uç noktaları (CRUD, harita bbox, yakındaki yerler) — zaten var ve testli (§13 API
  Yüzeyi, `test-product-08.ps1`).
- [-] P2.10 Realtime gateway (socket.io/`map:*`/`signal:*`) — **kullanıcıya soruldu (D-005): dokunma,
  REST polling korunur.** Kök CLAUDE.md §6.5'in bilinçli WebSocket/SignalR kullanmama kararı geçerli
  kalıyor; Faz 2 kapsamından çıkarıldı.
- [ ] P2.11 İşler (`signal.expire`, `place.aggregate`, `counters.reconcile`) — projection worker zaten
  idempotent tüketiyor; ayrı reconciliation/error-queue görünürlüğü kök CLAUDE.md §21 "P1 Üretim
  güvenilirliği"nde zaten listeli, Faz 2'nin kendi görevi olarak değil o yol haritası altında ele alınacak.
- [-] P2.12 TanStack Query mobil istemcisi — ertelendi; mevcut `api.ts` sarmalayıcısı çalışıyor, somut
  bir sorunu çözdüğü kanıtlanmadan büyük refactor başlatılmaz (kök CLAUDE.md §22).
- [x] P2.13 API entegrasyon testleri (sinyal oluştur → haritada görün → süresi dolsun) — büyük ölçüde
  zaten var (`BLK-LOCATION-01/02`, `BLK-CORE-02`, bu oturumda tekrar PASS ile doğrulandı).

## Faz 3 — Harita, pinler, Sinyal Kartı

→ **Önemli kapsam notu:** Faz 3'ün büyük kısmı (§2 Sinyal Kartı'ndaki tepki/yorum/beğeni — ActionRow,
CommentInput vb.) Faz 4'ün backend'ine (yorum/beğeni uç noktaları) bağımlı; o backend henüz yok. Aynı
şekilde §1.1'deki StoryTray Faz 7'ye, "takip edilen kullanıcı avatarı pinde" Faz 6'ya bağımlı. Bu
maddeler backend/özellik hazır olmadan sahte veriyle inşa edilmeyecek (kural: gerçek olmayan veriyi
üretim ekranına sokma). Bu yüzden Faz 3 şimdilik yalnız **backend'e bağımlı olmayan, güvenle
uygulanabilir** alt maddelerle ilerliyor; kalan alt maddeler ilgili backend fazı bittiğinde tamamlanacak.
**Ayrıca gerçek bir çelişki bulundu:** plan §1.3 "Takip edilen kullanıcı / arkadaş sinyali: Pin içinde
tip ikonu yerine kullanıcının avatarı" diyor — bu, kök CLAUDE.md §12.1'in "Avatar... harita pinlerinde
yazar avatari YOKTUR (mahremiyet: anonim paylasimlar kisiye baglanamaz, surekli kisi takibi yapilmaz)"
kuralıyla doğrudan çelişiyor. §2.3 pivot notu bu kuralı gevşetmedi. Bu madde uygulanmayacak; Faz 6'da
takip özelliği gelince ayrı bir karar kaydı (D-00X) ile netleştirilmeli.

- [~] P3.1 Harita ekranı yeniden yerleşim — **büyük ölçüde tamam.** Glass üst bar (arama, avatar),
  katman çipleri, konumuma dön zaten vardı. Bu oturumda eklenen: tip filtre çipleri (§1.2 "tip
  çipleri") — yeni `mapTypeFilter.ts` (saf mantık: `parseTypeFilter`/`serializeTypeFilter`,
  `SIGNAL_CATALOG`'tan türetilen 7 gerçek `SignalType`) + `mapTypeFilterStorage.ts` (SecureStore
  kalıcılığı, `ThemeProvider`'daki desenle aynı) + yeni `map/MapTypeFilterBar.tsx` (çoklu seçim,
  `MapLayerBar`'ın altında, yalnız `places` katmanında gizli — o katman aktiviteye değil katalog
  taramasına bakıyor). `mapSelection.ts`'e yeni `filterBySignalTypes()` — boş seçim = filtre yok,
  gerçek bir seçim varsa tip'i bilinmeyen bir Place elenir. **Plan'ın "Trafik"/"Hava" çipleri
  uygulanmadı** — Blinkr'in `SignalType` kümesinde böyle değerler yok, uydurma tip eklenmedi.
  **Bilinçli olarak dışarıda bırakılan:** "Takip ettiklerim" çipi (Faz 6'nın takip özelliği yok) ve
  bildirim zili (Faz 9'un işi). `SecureStore` native binding'i düz Node pipeline'ını kırdığı için
  (`lucide-react-native` ile aynı sınıf hata, P1.6'da da görüldü) saf mantık ve kalıcılık iki ayrı
  dosyaya bölündü — testler yalnız saf dosyayı derliyor. `typecheck`/`test:nearby`/`test:ui` yeşil
  (yeni testler: `map-selection.test.ts`'e filtre + kalıcılık round-trip testleri eklendi); `expo
  export --platform ios/android` yeşil; tam backend kabul paketi yeniden çalıştırıldı, sıfır FAIL.
- [x] P3.2 Otomatik bbox yükleme (debounce) — **tamamlandı.** Önceden harita hareket edince kullanıcı
  elle "Bu alanı tara"ya basmak zorundaydı (`mapDirty` yalnız bayrak set ediyordu, hiçbir şey otomatik
  yeniden yüklemiyordu). Artık `MapScreen.tsx`'te 400ms debounce'lu bir efekt viewport oturduğunda
  (`mapDirty` ve `!isLoading`) otomatik `loadPlaces` çağırıyor — aynı `distanceMeters > 40m` eşiği
  korunuyor, yani anlamsız küçük kaymalarda tekrar tekrar istek atılmıyor (kök CLAUDE.md §16/kural 10).
  "Bu alanı tara" butonu ve her zaman görünen "N görünür" rozeti kaldırıldı (`MapTopChrome.tsx`); buton
  artık yalnız gerçek bir yükleme hatası olduğunda (`Boolean(error) && mapDirty`) elle yeniden deneme
  seçeneği olarak görünüyor — dayaniklilik kuralı "eski gecerli marker'lari... kucuk hata/retry durumu
  gosterilir" burada korunuyor. **Boş durum mini özeti zaten vardı** (`emptyMap`: "Bu bölgede henüz taze
  sinyal yok · İlk sinyali bırak") — bu oturumda dokunulmadı, plan'ın istediğiyle zaten örtüşüyordu.
  `typecheck`/`test:nearby`/`test:ui` yeşil; `expo export --platform ios/android` yeşil.
- [~] P3.3 MapPin (FreshnessRing, tip ikonu, yaşlanma opaklığı, canlı nabız), ClusterPin, PlacePin —
  **büyük ölçüde zaten var, bu oturumda incelendi.** `MapMarkerVisuals.tsx`: tip ikonlu/tip renkli
  pin, canlı durumda dolgun+parlayan+durum rozetli Place pin, sinyal balonunda ömür azaldıkça kısalan
  halka (`ringDash`+`lifetimeFraction`), yaşlanma opaklığı (`freshnessOpacity`), heat-halolu cluster —
  hepsi zaten `markerGeometry.ts`'te testli. **Avatar varyantı bilinçli olarak uygulanmadı** (yukarıdaki
  "önemli kapsam notu"na bkz.: kök CLAUDE.md'nin "haritada yazar avatarı yok" kuralıyla çelişiyor).
- [x] P3.4 supercluster entegrasyonu — zaten var (`mapClusters.ts`, `clusterMapPoints`), testli
  (`map-clusters.test.ts`).
- [ ] P3.5-P3.7, P3.9, P3.11-P3.12 (Sinyal Kartı yenileme — `CenterModal`, ActionRow/tepki, görüntülenme
  sayacı, yer sayfasının Takip et/Soru sor kısmı) — **Faz 4/6/9'un backend'ine bağımlı, henüz yok**,
  sahte veriyle inşa edilmeyecek. Yer sayfasının temel kısmı (canlı durum, yol tarifi) zaten mevcut
  `PostDetailSheet` akışında var; yalnız "Takip et"/"Soru sor" gibi backend'i olmayan kısımlar eksik.
- [x] P3.8 Doğrulama akışı (Evet/Değişti) — **zaten var**, bu oturumda doğrulandı. `PostDetailSheet.tsx`
  + `recheckSignal()` (`productPresentation.ts`): yalnız taze/yapılandırılmış canlı durumda "Hâlâ böyle
  mi?" sorusu, "Evet" composer'ı son adımda aynı değerle açıyor, "Değişti" sinyal adımından. Uzaklık
  kısıtı istemcide görsel olarak pasifleştirilmiyor (plan'ın "500 m dışında buton pasif" istediği gibi)
  — **bilinçli, küçük bir UX eksiği**: sunucu zaten gerçek konumdan kararı tekrar hesaplıyor (`trust is
  server-owned`), yani yanlış davranış riski yok, yalnız uzaktaki biri butona basıp sunucudan ret alıyor
  (kaba bir hata yerine daha iyi bir UX olurdu). Küçük, ayrı bir iş olarak kalıyor.
- [x] P3.13 Arama ekranı (Yerler | Kişiler) — **tamamlandı.** `map/MapSearchOverlay` artık iki sekmeli
  (`ui/BlinkrSegmentedControl`): Yerler (değişmedi) ve Kişiler (yeni) — arkadaşlar önce (kısayol,
  `UserSearchSheet`'teki desenle aynı: `listFriends`+`searchUsers`+`orderPeople`), gerçek arama, seçilen
  kişi `friends/UserProfileSheet`'i açıyor (yeni `MapScreen`'de `searchProfileUser` state'i), oradan
  "Mesaj gönder" `onMessageUser` → `App.tsx`'in zaten var olan `openChatWith` (Sohbet sekmesine geçiş +
  hedef kullanıcı) ile Sohbet sekmesine taşıyor — yeni bir cross-tab mekanizma icat edilmedi, mevcut
  desen (`ProfileScreen`'in zaten kullandığı) yeniden kullanıldı. `test:ui`'ye gerçek assertion'lar
  eklendi (arkadaş kısayolu, arama, boş durum, sekmeler arası geçişte diğer sekmenin bozulmaması).
  `typecheck`/`test:nearby`/`test:ui` yeşil; `expo export --platform ios/android` yeşil; tam backend
  kabul paketi sıfır FAIL.

## Faz 4 — Gönderi detayı, yorumlar, medya görüntüleyici

- [~] P4.1 Backend: yorum uç noktaları, yanıtlar, beğeni — **6 gerçek bug düzeltildi (D-006)**, yanıt (tek seviye), yazar adı, silme (`PostCommentRemovedEvent`), `{ liked }` cevabı, hata kodları (`CANNOT_LIKE_OWN`, `COMMENT_EMPTY`, `COMMENT_TOO_LONG`, `COMMENT_FORBIDDEN`, `NOT_FOUND`), anonim gönderide yazar kimliği gizli. Kanıt: `test-post-engagement.ps1` (BLK-ENGAGE-01) PASS. **Ertelendi:** @bahsetme, yorum kapatma, moderasyon kancası (Faz 10).
- [x] P4.2 Gönderi detayı — `components/signal/SignalThreadPanel.tsx`, mevcut detay sheet'inin içinde (ikinci sheet yok, rapor paneliyle aynı desen). Paylaşılan öğe geçiş animasyonu yok.
- [x] P4.3 Yorum listesi: En yeni/En eski (öne çıkan yok — yorum beğenisi olmadan anlamsız), yanıtlar, "n yanıtı gör", "Daha fazla yorum" sayfalama.
- [~] P4.4 CommentInput: yanıtla modu, 500 karakter sayacı. Emoji satırı ve @ tamamlama ertelendi (D-006).
- [~] P4.5 Yorum eylemleri: ⋯ menüsü, iki adımlı sil, bildir (yazarı; anonim yazar için sinyal), "Paylaşan" rozeti. Yorum beğenisi ertelendi (D-006).
- [x] P4.6 İyimser beğeni/yorum/silme + hata geri alma (yazılan metin kaybolmaz); "realtime" D-005 gereği 8 sn polling (yalnız panel açıkken).
- [-] P4.7 Tam ekran medya görüntüleyici — ertelendi (D-006).
- [-] P4.8 Beğenenler listesi — ertelendi, Faz 6 toplu kullanıcı özeti uç noktasına bağlı (D-006).

## Faz 5 — Kamera ve oluşturma akışı

- [x] P5.1 (+) → doğrudan tam ekran kamera; uzun basma (350 ms) → yazılı sinyal composer'ı. `ShareHubSheet` silindi (galeri kameranın içinde zaten vardı; Snap Sohbet'teki kamera düğmelerinden). `test:ui`'da uzun basma testi.
- [x] P5.2 Kamera: deklanşöre dokun = foto, basılı tut = video (15 sn, kırmızı ilerleme halkası; `MAX_VIDEO_SECONDS` 45→15), flaş/çevir/zoom/galeri zaten vardı, "Aa" = yazılı sinyal. Erişilebilirlik için açık Video modu korunuyor. Basılı-tut kaydı fiziksel cihazda denenmedi (tarayıcıda testli).
- [~] P5.3 Okulda medya **sunucuda** kapalı (422 `MEDIA_NOT_ALLOWED_AT_PLACE`, `test-sensitive-place.ps1` BLK-SENSITIVE-01 PASS) + composer'da ön uyarı; sağlık/ibadet mahremiyet uyarısı; >100 m "Konum belirsiz"; sağlık yerinde HealthNotice (P10.5'in bir kısmı). Kamera üzerindeki yer çipi yapılmadı (D-007).
- [x] P5.4 Önizlemede ve düzenlemede yatay kaydırma = sonraki/önceki filtre (döner), ad 1 sn ortada + haptik. Skia kurulmadı: mevcut katman tabanlı 8 filtre korunuyor (fotoğrafa zaten gömülüyor).
- [x] P5.5 Çıkartmalar: saat + tip + 6 emoji; sürükle/ölçekle/**döndür**; sürüklerken çıkan çöp kutusuna bırakınca silinir; **çakışmasız yerleşim** (kutu tabanlı, AUDIT #8); tip çıkartması composer'da o sinyal tipini önceden seçer. "Yer adı" çıkartması yok (kamera yeri bilmiyor, D-007).
- [x] P5.6 Metin aracı: "T" → yazı, Düz/Zeminli/Vurgulu, 7 renk, okunur zıt renk, sürüklenebilir/döner, fotoğrafa gömülür.
- [~] P5.7 Flatten (`captureRef`) ve istemci sıkıştırması (0.84-0.92 JPEG) zaten vardı. **EXIF silme sunucuda tamamlandı:** JPEG'e ek olarak PNG (`eXIf/tEXt/iTXt/zTXt/tIME`) ve WebP (`EXIF/XMP`) meta verisi de siliniyor; kabul testi `test-media-privacy.ps1` (BLK-MEDIA-PRIVACY-01) PASS. Çıkartma metadatası JSON olarak gönderilmiyor (backend alanı yok, analitik Faz 11).
- [~] P5.8 Tip çipleri, seviye, yer listesi, açıklama sayacı, anonim zaten composer'da vardı; **TTL bilgisi eklendi** ("Haritada 1 sa kalır", sunucu varsayılanlarının aynası, testli). Takipçiler/Yalnızca ben görünürlüğü ve @bahsetme yok: backend `AudienceType` yalnız Public destekliyor (Faz 6 takip modeliyle).
- [~] P5.9 Composer'ın kontrol adımında "Arkadaşlarına snap olarak da gönder" (en fazla 10 arkadaş, yalnız fotoğraf, **anonim sinyalde kapalı** — fotoğraf kimin paylaştığını belli ederdi). Snap'ler sinyal yayınlandıktan sonra gönderilir; biri başarısız olursa sinyal geri alınmaz, yalnız bildirilir. Ayrı "Gönder" sayfası yok (mevcut 4 adımlı composer korunuyor). "Hikayem" Faz 7'de.
- [-] P5.10 Arka plan yükleme kuyruğu — ertelendi (D-008: sunucuda idempotency anahtarı olmadan otomatik yeniden deneme çift sinyal üretebilir).
- [x] P5.11 Galeri fotoğrafının EXIF çekim zamanı telefonda okunuyor (`galleryCapture.ts`, testli), 2 saatten eskiyse composer'da "Galeriden · N sa önce" notu; sunucu `GalleryMediaPolicy` bu zamanı **yalnız güveni düşürmek** için kullanıyor (VERIFIED_LIVE → NEARBY_PLACE_POST, canlı durumu değiştirmez). Kanıt: BLK-SENSITIVE-01'e eklenen 3 kontrol + `tests/PlacePosting` birim kontrolleri PASS. EXIF konumu okunmuyor (gerek yok, konum sunucuda cihazdan).
- [-] P5.12 Kopya birleştirme UI'ı — ertelendi, sunucuda karşılığı yok (D-008).

## Faz 6 — Profil, takip, kaydedilenler

- [~] P6.1 Backend (IdentityService, D-009): takip/bırak/istek/kabul/red, takipçi çıkar, gizli hesap, takipçi/takip listeleri (sayfalı, engel süzmeli, gizlilikte kapalı), sayaçlar, engel takipleri siler, BlogService yazar listesi sunucuda gizlilik kontrollü. Kanıt: BLK-FOLLOW-01 (30 kontrol) PASS. **Ertelendi:** sessize alma (mute), öneriler, trigram arama (mevcut ILIKE arama kalıyor).
- [~] P6.2 Kendi profil: Sinyal/Takipçi/Takip sayaçları (dokununca liste), gizli hesap etiketi, bekleyen takip isteği girişi; **e-posta profilden kaldırıldı** (yalnız Ayarlar > Hesap, plan 06 §1.1). Güven/seviye/rozetler yok (sunucuda karşılığı yok — P6.10).
- [~] P6.3 Kendi profilde Izgara (varsayılan) / Liste: 3 sütun kare, fotoğraf ya da tip renkli metin karesi, tip rozeti, çoklu foto ve anonim işareti, sona erenler soluk (`profileGrid.ts` testli). Harita/Doğrulamalar sekmeleri yok (doğrulama kaydı sunucuda yok); kayıtlı yerler zaten profilde.
- [~] P6.4 Başka kullanıcı profili: `FollowButton` (Takip et / Geri takip et / Takip ediliyor / İstek gönderildi; iyimser + geri alma; bırakmadan önce onay), "Seni takip ediyor", sayaçlar, gizli hesap kilidi; mevcut Mesaj/Engelle/Bildir korunuyor. Ortak takipçiler yok.
- [x] P6.5 `FollowListSheet`/`FollowListPanel`: Takipçiler/Takip (sayfalı), her satırda takip düğmesi, kendi takipçini onaylı çıkarma; başka profilde aynı sheet içinde açılır (ikinci sheet yok). Liste içi arama yok.
- [x] P6.6 Takip istekleri: listede "İstekler" sekmesi (Onayla/Sil) + Ayarlar'da "Gizli hesap" anahtarı.
- [-] P6.7 Profili düzenle — mevcut avatar + bio korunuyor; kullanıcı adı değiştirme (14 gün), şehir, bağlantı ertelendi (D-010).
- [~] P6.8 Kayıtlı yerler hesapta (IdentityService `SavedPlaces`, ekleme yapan EF göçü), iki cihazda aynı; cihazdaki eski kayıtlar ilk girişte bir kez `import` ile taşınıyor, cihaz yalnız çevrimdışı önbellek. Kanıt: BLK-SAVED-01 PASS. **Ertelendi:** koleksiyonlar, sinyal kaydetme.
- [-] P6.9 Profil paylaş/QR — ertelendi (D-010: derin link altyapısı yok, Faz 9 P9.4 ile).
- [-] P6.10 Güven puanı/seviye/rozet — ertelendi (D-010: sunucuda hesaplanmıyor; uydurma sayı gösterilmez).
- [~] P6.11 Engel sunucuda takipleri siler, profil/liste/yazar sinyalleri ve Keşfet akışlarında engelli kişi görünmez (BLK-FOLLOW-01, BLK-DISCOVER-01). Harita pinleri (herkese açık harita) süzülmüyor.

## Faz 7 — Keşfet akışı ve hikayeler

- [~] P7.1 Backend: `GET /api/discover/nearby` (tazelik > yakınlık > log etkileşim skoru, sayfa başına kişi başı en fazla 2, kaba mesafe, anonimde yazar yok, engelliler dışarıda) ve `GET /api/discover/following` (takip edilenlerin son 7 gün, anonim hariç; kimlik servisi cevap vermezse 503). Eski `/api/v1/feed` ham koordinat ve anonim yazar adı döndürdüğü için kullanılmadı. Kanıt: BLK-DISCOVER-01 + `tests/PlacePosting` sıralama kontrolleri PASS. **Ertelendi:** yer durum şeridi, önerilen kişiler.
- [~] P7.2 `feed/DiscoverScreen`: Yakınımda | Takip | Yerler (eski Yakında listesi korunuyor). Arama/zil/StoryTray/filtre/yarıçap seçici yok (hikaye P7.5+, zil Faz 9).
- [~] P7.3 `feed/FeedCard` (yazar/anonim, tip+değer, tazelik, kaba mesafe, foto, beğeni yerinde, yorumlar sheet'te, Haritada göster); boş/hata/iskelet durumları. Yer durum şeridi "Yerler" sekmesi olarak; önerilen kişiler yok.
- [~] P7.4 Çekerek yenile, sayfalı kaydırma (bilinçli üst sınır 10 sayfa — "Decision utility over engagement"). Sekmeye tekrar dokununca başa kaydırma yok.
- [x] P7.5 Backend (NotificationsService, snap depolamasıyla aynı özel disk): `POST /api/stories` (ham medya, foto 3/5/10 sn, video; EXIF silinir, bayt imzası denetlenir; 24 sa; kişi başına 30 aktif), `GET /api/stories/tray` (kendim + takip ettiklerim, görülmemiş önce), `GET /api/stories/users/{id}`, `GET /api/stories/{id}/content` (no-store), `POST .../seen`, `GET .../viewers` (yalnız yazar), `DELETE`. Görünürlük kimlik servisiyle (takip + engel), cevap yoksa kapalı başarısız (503). Konum saklanmaz. Kanıt: BLK-STORIES-01 (16 kontrol) PASS.
- [~] P7.6 `stories/StoryTray` Keşfet'in üstünde: benim (yoksa +), sonra takip ettiklerim; görülmemiş parlak halka, izlenmiş sönük; sunucu sırası (kendim, görülmemiş, en yeni). Harita üstünde tray yok (harita sadeliği).
- [~] P7.7 `stories/StoryViewer`: segment çubukları, sağ dokun ileri / sol geri, basılı tut duraklat, kişiden kişiye geçiş, ilk görülmemişten başlar, görüldü işaretlenir, video desteği. Küp animasyonu ve ön yükleme yok.
- [x] P7.8 Yanıt → DM ("↩ Hikayene yanıt: …"), kendi hikayende görüntüleyenler ve iki adımlı silme; hikaye paylaşma Keşfet'teki "Hikaye ekle" → kamera → Paylaş.

## Faz 8 — Sohbet yenileme

- [~] P8.1 Backend: konuşma/mesaj/okundu/snap zaten vardı; eklendi: `clientId` ile idempotent gönderim, `kind: signal` sinyal paylaşımı (bağlantı + görüntü özeti, yazar yok), `DELETE .../messages/{id}` geri alma (yalnız gönderen, snap hariç), `PUT .../reaction` (sabit 6 emoji, kişi başı bir). Kanıt: BLK-CHAT-02 (14 kontrol) PASS. **Ertelendi:** mesaj istekleri klasörü ve dm_policy (arkadaş dışından mesaj bugün de açık, engel korumalı).
- [~] P8.2 Snapchat durum ikonları, okunmamış, hızlı kamera zaten vardı; liste artık "Sinyal paylaştı"/"Mesaj geri alındı" önizlemesini gösteriyor. Mesaj istekleri ve kaydırma eylemleri yok.
- [-] P8.3 Balonlar — bilinçli olarak mevcut balonsuz Snapchat satır düzeni korunuyor (kök CLAUDE.md §12.1, kullanıcının önceki tasarım kararı); "yazıyor/çevrimiçi" realtime gerektirir (D-005).
- [x] P8.4 text, snap (vardı), **signal** (paylaşılan sinyal kartı, dokununca yorum/beğeni paneli), unsent; hikaye yanıtı düz metin DM olarak.
- [~] P8.5 Uzun basma: 6 sabit tepki (kişi başı bir, aynısına basınca kalkar) ve kendi mesajını geri alma (iyimser + geri alma). Alıntılı yanıt/kopyala yok; bildirme profil üzerinden.
- [x] P8.6 Snap görüntüleyici zaten vardı (tek sefer, süre, Android ekran görüntüsü engeli). Ekran görüntüsü bildirimi yok (iOS engellenemez, bildirim güvenilir değil).
- [x] P8.7 Keşfet kartından "Sohbette paylaş" → arkadaş seç → sinyal mesajı (bağlantı + özet, yazar yok, `clientId` ile çift gönderim yok).
- [~] P8.8 Yeni sohbet kişi seçici zaten vardı; mesaj isteği klasörü yok (D-011).
- [x] P8.9 Göç gerekmedi: yeni alanlar isteğe bağlı, eski mesajlar olduğu gibi okunuyor.

## Faz 9 — Bildirimler

- [~] P9.1 Backend: bildirim satırları vardı; eklendi: IdentityService takip olaylarını RabbitMQ'ya yayınlıyor (`UserFollowedIntegrationEvent`, `FollowRequestAcceptedIntegrationEvent`; en iyi çaba, takip asla bu yüzden başarısız olmaz), NotificationsService yeni takipçi / takip isteği / istek kabul bildirimleri; beğeni bildirimi artık beğenenin adını, yorum bildirimi yazar ve gönderi kimliğini taşıyor (önceden boştu). Kanıt: BLK-NOTIFY-01 (9 kontrol) PASS. **Ertelendi:** gruplama, tercihler, sessiz saatler.
- [-] P9.2 Push — ertelendi (D-012: FCM/APNs kimlik bilgileri ve EAS proje kimliği gerekiyor; secret kullanıcıdan istenmeli). Sunucuda `IPushSender` (FCM/Noop) ve cihaz token deposu zaten var; bildirimler uygulama içinde görünüyor.
- [x] P9.3 `notifications/NotificationsScreen`: Bugün/Bu hafta/Daha önce, takip isteğine satır içi Onayla/Sil, açılınca hepsi okundu; boş/hata/iskelet durumları. ("Geri takip et" düğmesi profilden.)
- [~] P9.4 Bildirime dokunma: beğeni/yorum → sinyalin beğeni/yorum paneli, takip → kişinin profili (`blinkr://posts|users/{id}` ayrıştırma testli). Uygulama kapalıyken açılma push ile gelir (D-012).
- [~] P9.5 follow, follow_request, follow_accept, like, comment (BLK-NOTIFY-01). Yok: reply/mention/verify/place_update/question/badge/signal_expiring (karşılık gelen özellikler yok ya da ertelendi).
- [~] P9.6 Keşfet başlığındaki zilde okunmamış noktası (60 sn'de bir, yalnız ekran açıkken); Sohbet sekmesi noktası zaten vardı. Uygulama ikonu rozeti push ile (D-012).
- [-] P9.7 Tercihler — ertelendi (D-012), sunucuda tercih modeli yok.

## Faz 10 — Güvenlik, gizlilik, moderasyon

- [ ] P10.1 Metin filtresi (tr/en, normalizasyon), kişisel veri kalıbı uyarısı ve maskeleme
- [ ] P10.2 Görsel moderasyon sağlayıcı soyutlaması (`MODERATION_PROVIDER`), auto_hide
- [ ] P10.3 Rapor akışı (UI: neden seçimi + not), ağırlıklı rapor skoru, auto_hide
- [ ] P10.4 Admin uç noktaları + minimal admin sayfası/CLI; yaptırım merdiveni; kullanıcıya bildirim
- [ ] P10.5 Hassas yer kuralları (uyarı, okulda medya kapalı, HealthNotice + ülke acil numarası)
- [ ] P10.6 18 yaş altı varsayılanları
- [ ] P10.7 Hesap silme (2 adım, 30 gün, purge işi) + geri alma; veri indirme talebi
- [ ] P10.8 Konum gizliliği denetimi: log/analitik/hata raporlarında konum yok (otomatik test); ev bulanıklaştırma kuralı
- [ ] P10.9 Yetkilendirme test paketi (başkasının kaynağına erişim denemeleri)
- [ ] P10.10 Topluluk kuralları, kullanım şartları, gizlilik politikası ekranları (metinler yer tutucu + hukuki inceleme notu)

## Faz 11 — i18n, erişilebilirlik, performans, analitik

- [ ] P11.1 Tüm ekranlarda eksik çeviri taraması; CI anahtar eşitliği kontrolü
- [ ] P11.2 Birim/saat/sayı yerelleştirmesi; RTL hazırlık denetimi (start/end)
- [ ] P11.3 a11y geçişi: etiketler, roller, dokunma alanları, VoiceOver ile ana akışlar, "Liste olarak göster"
- [ ] P11.4 Hareketi Azalt desteği her animasyonda
- [ ] P11.5 Performans ölçümü (bütçe tablosu) ve iyileştirmeler; harita 300 pin testi
- [ ] P11.6 Analitik soyutlaması + olay şeması + rıza ayarı
- [ ] P11.7 Onboarding akışı (06 §10) ve ilk görev kartı

## Faz 12 — QA, seed data, yayın hazırlığı

- [ ] P12.1 Seed script'i: demo kullanıcılar, yerler, gerçekçi sinyaller, sohbetler (14 §2); mevcut kullanıcıya bağlı 20.035 seed sinyal temizliği
- [ ] P12.2 E2E senaryoları (14 §3) — Maestro veya Detox
- [ ] P12.3 Hata takibi (Sentry) mobil + backend
- [ ] P12.4 Uygulama ikonu, splash, mağaza ekran görüntüleri için demo modu
- [ ] P12.5 İzin metinleri (Info.plist / AndroidManifest) tr + en
- [ ] P12.6 Yayın kontrol listesi (14 §5)

## Faz 13 — (Opsiyonel / V1.1)

- [ ] P13.1 Arkadaş konumu (Ghost Mode varsayılan açık, süreli paylaşım, yalnızca arkadaşlar)
- [ ] P13.2 Yakın arkadaşlar listesi (`close_friends` görünürlüğü)
- [ ] P13.3 Grup sohbeti
- [ ] P13.4 Şehir lider tablosu, haftalık "en yardımsever" kartları
- [ ] P13.5 Cihaz üzerinde yüz bulanıklaştırma önerisi
- [ ] P13.6 Yer "genelde ne kadar kalabalık" saatlik grafiği (geçmiş sinyallerden)
- [ ] P13.7 Isı haritası katmanı (gerekirse Mapbox'a geçiş kararı)
- [ ] P13.8 #etiket araması ve etiket sayfaları

## Faz özetleri

<!-- Her faz bitince buraya ekle:
### Faz N — tarih
- Yapılanlar:
- Ertelenenler:
- Bilinen sorunlar:
- Ölçümler (varsa):
-->

### Faz 0 — 2026-09-22
- Yapılanlar: `AUDIT.md` yazıldı (stack tespiti, klasör yapısı, özellik envanteri, veri modeli, gap
  analizi, stack eşleme, riskler/açık sorular). `DECISIONS.md`'ye D-000/D-001/D-002 eklendi. Kod
  değişikliği yapılmadı (kural gereği).
- Ertelenenler: Faz 1'in tamamı — D-002 yanıtlanana kadar.
- Bilinen sorunlar: Bu planın MVP kapsamı (hikaye, takip/takipçi, keşfet feed'i, rozet/seviye/streak,
  V1.1 arkadaş konumu) kök `CLAUDE.md` Ürün Anayasası §2.2 ile doğrudan çelişiyor; ayrıca Faz 2'nin
  PostgreSQL+PostGIS'e geçiş önerisi kök belgenin EventStoreDB-authoritative kuralıyla çelişiyor ve
  veri kaybı riski taşıyan bir migrasyon sayılıyor. Bkz. AUDIT.md §7.
- Ölçümler: —

### Faz 4 — 2026-09-23
- Yapılanlar: Beğeni/yorum uçtan uca (6 gerçek backend bug'ı düzeltildi, D-006), yanıt, silme, anonim yazar gizliliği, `SignalThreadPanel`. BLK-ENGAGE-01.
- Ertelenenler: @bahsetme, yorum beğenisi, medya görüntüleyici, beğenenler listesi (D-006).
- Bilinen sorunlar: Fiziksel cihazda denenmedi.

### Faz 5 — 2026-09-23
- Yapılanlar: (+) → kamera / uzun basma → metin; basılı tut = 15 sn video + halka; "Aa"; kaydırarak filtre; çıkartmalar (döndür, çöp kutusu, çakışmasız yerleşim, emoji, tip önerisi); metin aracı; okulda medya sunucuda kapalı; sağlık/ibadet uyarısı; HealthNotice; konum belirsiz uyarısı; PNG/WebP meta verisi silme; TTL bilgisi; arkadaşlara snap; galeri 2 saat kuralı (sunucuda güven düşürme).
- Kanıt: 19 backend kabul betiği sıfır FAIL (yeni: BLK-ENGAGE-01, BLK-SENSITIVE-01, BLK-MEDIA-PRIVACY-01), `tests/PlacePosting` PASS, typecheck/test:nearby/test:ui/test:i18n/test:theme/test:product yeşil, `expo export` iOS+Android yeşil.
- Ertelenenler: P5.10 çevrimdışı kuyruk, P5.12 kopya birleştirme (D-008); kamera üzerinde yer çipi (D-007); Skia filtreler (katman tabanlı filtre korunuyor).
- Bilinen sorunlar: Basılı-tut kayıt, döndürme, çöp kutusu fiziksel cihazda denenmedi (yalnız tarayıcı).

### Faz 6 — 2026-09-23
- Yapılanlar: Takip + gizli hesap (D-009, BLK-FOLLOW-01), takip butonları/listeleri/istekleri, profil sayaçları ve ızgara, e-posta profilden kaldırıldı, kayıtlı yerler hesapta (BLK-SAVED-01).
- Ertelenenler (D-010): kullanıcı adı değiştirme, QR/derin link, güven puanı/rozet, koleksiyonlar, mute, öneriler.

### Faz 7 — 2026-09-23
- Yapılanlar: Keşfet (BLK-DISCOVER-01, sıralama birim kontrolleri), FeedCard, hikayeler uçtan uca (BLK-STORIES-01), tray + görüntüleyici + paylaşma + yanıt + görüntüleyenler.
- Ertelenenler: yer durum şeridi/önerilen kişiler, sekmeye tekrar dokununca başa kaydırma, küp geçiş, harita üstü tray.
- Bilinen sorunlar: Hikaye videosu ve dokunma hareketleri fiziksel cihazda denenmedi.

## Performans ölçümleri (Faz 11)

| Metrik | Hedef | Ölçülen | Cihaz |
|---|---|---|---|
| Soğuk açılış → harita | < 2,0 sn | | |
| (+) → kamera | < 500 ms | | |
| Pin → Sinyal Kartı | < 150 ms | | |
| Harita 300 pin fps | 55+ | | |
| API p95 harita/akış | < 300 ms | | |
