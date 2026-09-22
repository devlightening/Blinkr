# PROGRESS — İlerleme Takibi

> Claude Code bu dosyayı her görev bitiminde günceller. Yeni oturumda önce bu dosyayı oku ve ilk `[ ]` görevden devam et.
> Durumlar: `[ ]` yapılmadı · `[~]` devam ediyor · `[x]` tamam · `[-]` ertelendi (nedeni DECISIONS.md'de)

## Durum özeti

| Alan | Değer |
|---|---|
| Aktif faz | Faz 1 (yalnız P1.4 kaldı) |
| Son tamamlanan görev | P1.9 |
| Son güncelleme | 2026-09-22 |
| Engelleyici | — (D-002 → D-003 ile çözüldü: plan aynen uygulanır, backend mimarisi korunur) |


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
- [ ] P1.4 i18n altyapısı (i18next, tr/en, dil algılama); mevcut ekranlardaki ham metinleri anahtarlara taşı
- [x] P1.5 Temel bileşenler — plandaki 15 bileşenin 14'ü artık karşılanıyor. Bu oturumda yeni: `ui/BlinkrFreshnessRing.tsx` (`FreshnessRing`, imza öğe — `progress` doğrudan `productPresentation.ts`'teki `freshnessProgress()`'ten, canlı nabız `isFreshnessPulseDue()`'dan gelir, ikisi de testli), `ui/BlinkrTypeBadge.tsx` (`TypeBadge` — `BlinkrSignalCard`'daki tekrar eden rozet kodunu değiştirdi), `ui/BlinkrLevelMeter.tsx` (`LevelMeter`), `ui/BlinkrToast.tsx` (`Toast`), `ui/BlinkrIconButton.tsx` (`IconButton`, glass/surface/plain · 36/44), `ui/BlinkrSegmentedControl.tsx` (`SegmentedControl`, kayan gösterge Reanimated ile), `ui/BlinkrErrorState.tsx` (`ErrorState`). `Avatar`'da "hikaye halkası" ayrı bir bileşen olarak değil, `FreshnessRing` ile `Avatar`'ı sarma kompozisyonuyla karşılanıyor (plan da bunu "Halka: unseen/seen" olarak `FreshnessRing`'in kullanım yerlerinden biri sayıyor) — "Kit" sahnesinde üç örnekle gösteriliyor. Hepsi `test:ui`'de gerçek assertion'la doğrulandı (`scripts/ui-test.cjs`, "Kit" sahnesi). Zaten farklı adlarla var olanlar: `Button`→`ui/BlinkrButton`, `Chip`→`ui/BlinkrChip`, `Sheet`→`components/Sheet`+`ui/BlinkrSheetPanel`, `Skeleton`→`ui/BlinkrSkeleton`, `EmptyState`→`ui/BlinkrEmptyState`. **Bilinçli olarak eksik bırakılan tek bileşen:** `CenterModal` (Sinyal Kartı'nın harita merkezinde açılıp/kapanması) — bu, Faz 3 P3.5/P3.6'nın tanımlı işi, o fazın Sinyal Kartı tasarımıyla birlikte yapılacak. `Toast`/`ErrorState`/`IconButton` henüz hiçbir gerçek ekranda kullanılmıyor; mevcut ad-hoc eşdeğerleri (`MapScreen`'in toast'u, ekranların kendi hata+"Tekrar dene" satırları, kamera/sheet'lerin elle yazılmış yuvarlak butonları) bunlara taşınmadı — o taşıma ilgili ekrana dokunulacağı bir sonraki işte yapılır.
- [x] P1.6 Sinyal tipi kataloğu (istemci): tip → renk, seviye etiketleri — tek kaynak dosya. Yeni `src/signalCatalog.ts` (`SIGNAL_CATALOG`), daha önce üç ayrı dosyada dağınık olan veriyi birleştirdi: `signalLabels` (`presentation.ts`) ve `signalOptions` (`productPresentation.ts`) artık bu kataloğun türetilmiş re-export'ları — eski import eden hiçbir dosya değişmedi, testli (`product-presentation.test.ts`: katalog ile eski isimler her tip için birebir eşleşiyor). **Bilinçli olarak dışarıda bırakılanlar:** (a) ikon eşlemesi kataloğa taşınmadı, `SignalSymbol.tsx`'te kaldı — ilk denemede ikon'u da kataloğa taşıyınca `lucide-react-native` (→ `react-native`'in Flow sözdizimli dosyalarını içeriyor) `test:nearby`/`test:product`'ın düz `tsc`+`node` boru hattına sızdı ve `SyntaxError: Unexpected token 'typeof'` ile kırıldı (bundler'sız pipeline `react-native`'i hiç parse edemiyor); bu gerçek bir hataydı, düzeltilip testle kilitlendi. (b) TTL bilgisi eklenmedi — `10_SIGNAL_ENGINE.md`'nin TTL tablosu backend'de henüz uygulanmıyor (`BlogService`'te `ExpiresAt` çağıran tarafından veriliyor, sabit değil); burada uydurma dakika değeri yazmak sunucunun vermediği bir garanti iddia etmek olurdu — gerçek TTL motoru Faz 2 P2.7'nin işi.
- [x] P1.7 Yeni tab bar: Harita · Keşfet · (+) · Sohbet · Profil (Keşfet şimdilik mevcut "Yakında" ekranını gösterir); Harita varsayılan açılış — `ui/BlinkrBottomBar.tsx` sırası ve "Yakında"→"Keşfet" etiketi güncellendi, `scripts/ui-test.cjs` uyarlandı, `npm run typecheck`/`test:theme`/`test:ui` yeşil.
- [x] P1.8 Mevcut ekranlarda hızlı düzeltmeler — plandaki 4 alt madde de tamam: (a) yeni `ui/BlinkrStatRow.tsx` (`StatRow`), `PostDetailSheet.tsx`'teki ad-hoc `Stat`+`statDivider` bununla değiştirildi, "Orta güven **güven**" tekrarı çözüldü (`.tmp/product-ui/shot-detail-detail.png`). (b) #4 başlık/etiket tekrarı: yeni `meaningfulTitle()` (`src/presentation.ts`, testli) — composer boş başlık bırakıldığında tip adını başlık olarak gönderiyordu; `PostRow.tsx`, `PostDetailSheet.tsx`, `nearbyActivity.ts` düzeltildi. (c) #5 profilde e-posta zaten daha önce gizlenmişti (AUDIT.md §3). (d) #11 üst bar safe-area: `MapTopChrome` artık zorunlu `topInset` prop'u alıyor (`MapScreen.tsx` → `insets.top`), önceden `top: 0` sabitti — durum çubuğuna/çentiğe yapışma tarayıcı harness'inde görünmüyordu (çentik simülasyonu yok), gerçek cihazda görünen bir bug'dı; `.tmp/product-ui/shot-map.png` ile doğrulandı.
- [x] P1.9 Bileşen önizleme ekranı (yalnızca dev build'de) — `/dev/components` kelimenin tam anlamıyla değil (proje `expo-router` kullanmıyor, D-001 gereği mevcut ekran-değiştirme deseni korunuyor): yeni `DevComponentPreview.tsx`, `Ayarlar > Geliştirici > Bileşen önizleme` üzerinden açılıyor, yalnızca `__DEV__` true iken görünür (üretim build'inde bu bölüm hiç render edilmez). Tarayıcı harness'indeki "Kit" sahnesiyle aynı kataloğu kapsıyor ama gerçek uygulamanın **kendi içinde**, gerçek cihazda çalışan bir ekran — `test:ui`'de gerçek assertion'larla doğrulandı (`.tmp/product-ui/dev-component-preview.png`).

→ **Faz 1'de tek kalan görev: P1.4 (i18n altyapısı)** — Faz 1'in en büyük ve en riskli parçası.
`i18next` kurulumunun kendisi küçük; asıl iş "mevcut ekranlardaki ham metinleri anahtarlara taşı" —
tüm proje boyunca yüzlerce dosyaya dokunan, tek oturumda bitmeyecek bir iş. Ayrı, dikkatli bir oturumda
ele alınmalı, muhtemelen ekran ekran (önce altyapı + tr.json/en.json + dil algılama, sonra ekranlar tek
tek taşınır — her taşımadan sonra `test:ui` ile o ekranın hâlâ doğru göründüğü doğrulanır). `npm run
typecheck`/`test:theme`/`test:nearby`/`test:product`/`test:ui` yeşil; `npx expo export --platform ios`
ve `--platform android` yeşil.

## Faz 2 — Backend temeli

- [ ] P2.1 Yerel geliştirme ortamı: docker-compose (postgres+postgis, redis, minio), `.env.example`
- [ ] P2.2 Migration'lar: 08'deki şema (mevcut tablolarla eşlemeli, veri koruyan)
- [ ] P2.3 Veri göçü: tip eşleme, `(#12345)` temizliği, konum → display_location, arkadaşlık → follows
- [ ] P2.4 Ortak altyapı: hata biçimi, zod doğrulama, cursor sayfalama, idempotency, rate limit, logger (konum maskeleme)
- [ ] P2.5 Auth: register/login/Apple/Google/refresh rotasyonu/logout (mevcut auth varsa uyarlama)
- [ ] P2.6 Görünürlük fonksiyonu (`shared/visibility`) + birim testleri (açık/gizli hesap, engel, anonim, takipçi)
- [ ] P2.7 Sinyal motoru saf fonksiyonları (10 §1–§7) + birim testleri: TTL, uzatma, doğrulama kuralları, bulanıklaştırma, canlı durum, güven puanı, sıralama
- [ ] P2.8 Medya: upload-url, complete, worker (EXIF sil, varyantlar, blurhash, video), temizlik işi
- [ ] P2.9 Sinyal uç noktaları: POST/GET/PATCH/DELETE, harita (bbox + kümeleme), yakındaki yerler
- [ ] P2.10 Realtime gateway: auth, odalar, `map:*`, `signal:*` olayları
- [ ] P2.11 İşler: `signal.expire`, `place.aggregate`, `counters.reconcile`
- [ ] P2.12 Paylaşılan tipler (`shared/types/api.ts`) mobil tarafa bağlandı; mobil API istemcisi (TanStack Query hook'ları, token refresh)
- [ ] P2.13 API entegrasyon testleri (sinyal oluştur → haritada görün → süresi dolsun)

## Faz 3 — Harita, pinler, Sinyal Kartı

- [ ] P3.1 Harita ekranı yeniden yerleşim: glass üst bar (arama, bildirim zili, avatar), filtre çipleri, konumuma dön, katmanlar sayfası, alt mini özet
- [ ] P3.2 Otomatik bbox yükleme (debounce), "Bu alanı tara" ve "0 görünür" kaldırıldı; boş durum mini özette
- [ ] P3.3 MapPin (FreshnessRing, tip ikonu, avatar varyantı, yaşlanma opaklığı, canlı nabız), ClusterPin, PlacePin
- [ ] P3.4 supercluster entegrasyonu; zoom<12 sunucu kümeleri
- [ ] P3.5 `CenterModal` + `SignalCard modal`: başlık, MediaCarousel (kırpmasız), TypeBadge, yer satırı, açıklama, HealthNotice, VerifyBar, ActionRow, yorum önizleme, yorum ekle alanı
- [ ] P3.6 Açılış/kapanış animasyonu (pinden merkeze), aşağı kaydırarak kapatma, overlay + blur
- [ ] P3.7 Kart içi yatay kaydırma (küme/yer sinyalleri), medya carousel önceliği
- [ ] P3.8 Doğrulama akışı: Evet (optimistic), Değişti (seviye alt sayfası → yeni sinyal), uzaklık kontrolü ve pasif durum
- [ ] P3.9 Tepki (çift dokunma ❤️, uzun basma ReactionBar), kaydet, paylaş sayfası, ⋯ menüsü (Bildir/Engelle/Sil)
- [ ] P3.10 Realtime: `geo:` abonelikleri, yeni pin nabızla belirir, süresi dolan pin kaybolur; açık kart için `signal:` odası
- [ ] P3.11 Görüntülenme toplu gönderimi
- [ ] P3.12 Yer sayfası (04 §5): canlı durum, StatRow, takip et, yol tarifi, soru sor (UI + API), son sinyaller ızgarası, geçmiş
- [ ] P3.13 Arama ekranı (Yerler | Kişiler), sonuçtan haritaya uçma

## Faz 4 — Gönderi detayı, yorumlar, medya görüntüleyici

- [ ] P4.1 Backend: yorum uç noktaları, yanıtlar, beğeni, @bahsetme çözümleme, yorum kapatma, moderasyon kancası
- [ ] P4.2 Gönderi detayı ekranı; karttan paylaşılan öğe geçişi
- [ ] P4.3 Yorum listesi (sıralama: öne çıkan/en yeni), yanıtlar, "n yanıtı gör", sonsuz kaydırma
- [ ] P4.4 CommentInput: klavyeye yapışık, hızlı emoji satırı, @ otomatik tamamlama, yanıtla modu
- [ ] P4.5 Yorum eylemleri: beğen (çift dokunma), uzun basma menüsü, sil, bildir; "Paylaşan" rozeti
- [ ] P4.6 Realtime yeni yorum; optimistic gönderim + hata geri alma
- [ ] P4.7 Tam ekran medya görüntüleyici: pinch-zoom, kaydırarak kapatma, video kontrolleri
- [ ] P4.8 Tepki verenler listesi (alt sayfa)

## Faz 5 — Kamera ve oluşturma akışı

- [ ] P5.1 (+) → doğrudan tam ekran kamera (eski seçim sayfası kaldırıldı); uzun basma → metin modu
- [ ] P5.2 Kamera: foto/video (basılı tut, 15 sn halka), flaş, çevir, zoom, galeri, "Aa"
- [ ] P5.3 Yer algılama + en yakın yer çipi; konum belirsiz uyarısı; hassas yer uyarısı; okulda medya kapalı
- [ ] P5.4 Düzenleme: kaydırarak filtre (Skia; mevcut 8 filtre), filtre adı gösterimi
- [ ] P5.5 Çıkartmalar: bağlam + tip + emoji; sürükle/ölçekle/döndür/çöpe at; çakışmasız yerleşim
- [ ] P5.6 Metin aracı (3 stil, renk)
- [ ] P5.7 Flatten + stickers metadata; istemci sıkıştırma; EXIF silme
- [ ] P5.8 Detaylar sayfası: tip çipleri, seviye segmenti, yer listesi, açıklama (@, sayaç), görünürlük, anonim, TTL bilgisi
- [ ] P5.9 Gönder sayfası: Harita, Hikayem, arkadaşlar (snap)
- [ ] P5.10 Arka plan yükleme kuyruğu, ilerleme çipi, yeniden deneme, taslak saklama, gecikmeli sinyal
- [ ] P5.11 Galeri: EXIF tarih/konum okuma, "Galeriden" etiketi, 2 saat kuralı
- [ ] P5.12 Kopya sinyal birleştirme yanıtının UI'ı ("Mevcut sinyalin güncellendi")

## Faz 6 — Profil, takip, kaydedilenler

- [ ] P6.1 Backend: follow/unfollow/istek/kabul/red, takipçi çıkar, block, mute, öneriler, arama (trigram), user_stats sayaçları
- [ ] P6.2 Kendi profil ekranı: üst bölüm, sayaçlar, güven/seviye, bio, butonlar, rozetler şeridi
- [ ] P6.3 ProfileTabs: Izgara (3 sütun, rozetler, halka, soluk sona erenler, metin kareleri), Harita sekmesi, Kaydedilenler, Doğrulamalar
- [ ] P6.4 Başka kullanıcı profili: FollowButton durumları, Mesaj, ortak takipçiler, gizli hesap kilidi, ⋯ menüsü
- [ ] P6.5 Takipçi/takip listeleri + arama + takipçi çıkarma
- [ ] P6.6 Takip istekleri ekranı (gizli hesap)
- [ ] P6.7 Profili düzenle: avatar (foto veya illüstrasyon seti), ad, kullanıcı adı (canlı kontrol, 14 gün kuralı), bio, şehir, bağlantı
- [ ] P6.8 Kaydedilenler: koleksiyonlar, sinyal/yer kaydetme, cihazdaki kayıtlı yerlerin sunucuya göçü (`/me/saved/import`)
- [ ] P6.9 Profil paylaş: link + QR kodu; derin link `/u/{username}`
- [ ] P6.10 Güven puanı açıklama sayfası, seviye ilerleme; rozet detayları
- [ ] P6.11 Engelleme sonrası içerik anında her yerden kalkar (React Query önbellek temizliği)

## Faz 7 — Keşfet akışı ve hikayeler

- [ ] P7.1 Backend: `/feed/nearby` (skor + çeşitlilik), `/feed/following`, yer durum şeridi, önerilen kişiler
- [ ] P7.2 Keşfet ekranı: başlık (arama, zil), StoryTray, Yakınımda|Takip, filtreler, yarıçap seçici
- [ ] P7.3 SignalCard feed varyantı; yer durum kartları şeridi; önerilen kişiler kartı; boş durumlar
- [ ] P7.4 Çekerek yenile, sonsuz kaydırma, sekmeye tekrar dokun = başa kaydır
- [ ] P7.5 Backend: stories tray, kullanıcı hikayeleri, seen, viewers
- [ ] P7.6 StoryTray (harita + keşfet) sıralama ve görüldü durumları
- [ ] P7.7 Hikaye görüntüleyici: ilerleme çubukları, dokun/tut/kaydır hareketleri, kullanıcılar arası küp geçiş, ön yükleme
- [ ] P7.8 Hikayeye yanıt → DM (story_reply), görüntüleyenler listesi (kendi hikayen), hikayeden kaldır

## Faz 8 — Sohbet yenileme

- [ ] P8.1 Backend: konuşmalar, mesajlar (idempotent client_id), okundu, istek klasörü, dm_policy, snap aç/tek sefer, geri al, tepki
- [ ] P8.2 Konuşma listesi: Snapchat durum ikonları, okunmamış, mesaj istekleri, hızlı kamera, kaydırma eylemleri
- [ ] P8.3 Sohbet ekranı: balonlar, gruplama, gün ayırıcı, okundu, yazıyor, çevrimiçi
- [ ] P8.4 Mesaj tipleri: text, snap, media, signal_share (SharedSignalBubble), story_reply, system
- [ ] P8.5 Mesaj eylemleri: tepki, yanıtla (alıntı), kopyala, geri al, bildir
- [ ] P8.6 Snap görüntüleyici (tek sefer, 10 sn), ekran görüntüsü bildirimi
- [ ] P8.7 Sinyali sohbete paylaş (karttan ve detaydan)
- [ ] P8.8 Yeni sohbet (kişi seçici), mesaj izni yoksa istek olarak gönderim
- [ ] P8.9 Mevcut sohbet verisinin yeni yapıya geçişi

## Faz 9 — Bildirimler

- [ ] P9.1 Backend: notification satırları, gruplama (group_key, 6 sa pencere), tercihler, sessiz saatler, `notify.fanout`
- [ ] P9.2 Push: cihaz kaydı, Expo Push gönderimi, geçersiz token temizliği, push metinleri tr/en
- [ ] P9.3 Bildirimler ekranı: gruplar (Bugün/Bu hafta/Daha önce), takip istekleri girişi, satır içi eylemler (Geri takip et)
- [ ] P9.4 Derin link yönlendirme (bildirime dokun → doğru ekran, uygulama kapalıyken de)
- [ ] P9.5 Tüm tetikleyiciler: follow, follow_request/accept, reaction, comment, reply, mention, verify, place_update, question, badge_earned, signal_expiring
- [ ] P9.6 Rozet sayıları: tab bar (Sohbet), zil; uygulama ikonu rozeti
- [ ] P9.7 Bildirim tercihleri ekranı

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

## Performans ölçümleri (Faz 11)

| Metrik | Hedef | Ölçülen | Cihaz |
|---|---|---|---|
| Soğuk açılış → harita | < 2,0 sn | | |
| (+) → kamera | < 500 ms | | |
| Pin → Sinyal Kartı | < 150 ms | | |
| Harita 300 pin fps | 55+ | | |
| API p95 harita/akış | < 300 ms | | |
