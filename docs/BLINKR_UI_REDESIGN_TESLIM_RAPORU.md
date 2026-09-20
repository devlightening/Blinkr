# Blinkr UI Redesign — Teslim Raporu

Tarih: 20 Eylül 2026 · Dal: `feat/blinkr-theme-redesign` · Referans: `docs/blinkr_tema_kod`
Sonuç ekranları: `docs/blinkr_tema_kod/sonuc_ekranlar/` (tasarım görselleriyle yan yana bakmak için)

**Genel sonuç: PARTIAL.** Otomatik doğrulama tam yeşil. Native davranış (harita, dokunma, kamera, GPS) **fiziksel cihazda henüz doğrulanmadı**; bu rapor onu doğrulanmış saymaz.

## 1. Kapsam kararı: "eksiksiz" neyi kapsar?

Paketin kendi kuralı (`asamalar/00`, README) tasarım görsellerini **örnek/mockup** sayar ve uydurma veriyi yasaklar. Blinkr ürün anayasası da bazı öğeleri dışarıda bırakır. Bu yüzden tasarımın **her ekranı, her bileşeni ve görsel dili** uygulandı, ama aşağıdakiler **bilerek eklenmedi**:

| Tasarımdaki öğe | Neden yok | Yerine ne var |
|---|---|---|
| Puan `4.6 (328 yorum)` | Backend'de puan/yorum yok | — |
| `126 kişi şu anda burada`, `6 kişi burada` | Canlı ziyaretçi verisi yok; kişi konumu izleme anayasa dışı | Gerçek sinyal sayısı |
| `2.3B kaydetme` | Kaydetme sayısı sunucuda tutulmuyor (kayıtlar cihaz-yerel) | Gerçek `Kaydet` düğmesi |
| Doğrulama rozeti, `Topluluk doğruladı` | Doğrulanmış işletme/rozet yok | Sunucunun ürettiği güven etiketi (`Yüksek/Orta güven`) |
| Profil: `128 sinyal`, `9 rozet`, `Rozetlerin`, `Katkıların` | Backend yok (bkz. §6-A) | Gerçek kaydedilen yerler |
| Sohbet: `Yakınında`, `İstekler` sekmeleri, `Yakındaki kullanıcıları keşfet` | Sürekli kişi keşfi ve arkadaş grafiği anayasa dışı (§2.2) | Gerçek konuşma listesi |
| Sohbet: çevrimiçi noktaları, mekân çipleri | Presence/konuşma-mekân verisi yok | — |
| İnsan/yemek fotoğrafları | Uydurma içerik | Sinyallerin **gerçek** medyası |
| `Arkadaşlarınla` | Arkadaş grafiği yok | — |
| Kamera üstünde flaş/çevir | Sistem kamerası kullanılıyor (`expo-camera` yok, paket "gereksiz bağımlılık ekleme" diyor) | — |
| `Ayarlar` satırı | Çalışan bir ayar rotası yok | Gizlilik notu + Oturumu kapat |

## 2. Ekran bazında yapılanlar

- **Tema (03):** `src/theme.ts` tek kaynak, yeni palet (lime `#D9FF57`, mint `#65E6B5`, koyu yeşil yüzeyler), eski token adları yeni palete bağlandı. `npm run test:theme` her okunur metin/arka plan çiftini WCAG AA (≥4.5:1) için denetler. `textMuted` 3.53:1 olduğu için yalnızca dekoratif/büyük metin.
- **Ortak bileşenler (04):** `BlinkrButton`, `Chip`, `Card`, `Header`+`HeaderAvatar`, `EmptyState`, `BottomBar`, `SignalCard`, `SheetPanel`. Mevcut `AnimatedPressable` ve `Sheet` üzerine kuruldu.
- **Harita (05):** header, dört katmanlı filtre (ikonlu), `Bu alanı tara`, konum düğmesi, kategoriye göre renkli marker'lar, sinyal marker'ları, lime halkalı cluster'lar. Filtre mantığı `mapSelection.ts`'e çıkarıldı ve test edildi. Native beyaz marker callout'u kaldırıldı.
- **Mekân detayı (06):** gerçek fotoğraf şeridi, durum bandı, dört **gerçek** bilgi (sinyal sayısı, tazelik, güven, uzaklık), `Sinyal bırak` + `Kaydet/Paylaş/Yol tarifi` (üçü de çalışıyor), sinyal kartları.
- **Composer (07):** dört adım (CLAUDE.md §12.2) ve arkasındaki tüm kurallar aynen, sunum yenilendi: tam ekran katman, arkada gerçek çekilen medya, ilerleme çubuğu, gerçek `SignalType`'lar için ikonlu çipler, büyük `Sinyal bırak`.
- **Sohbet (08):** liste, konuşma, kullanıcı arama. Gerçek okunmamış rozeti (backend'e `unreadCount` eklendi).
- **Profil (09):** hesap, cihaz-yerel kayıtlı yerler (kullanıcıya göre ayrılmış), gizlilik, çıkış.
- **Navigasyon (10):** tek alt bar; harita her zaman monte kalır; kamera ve "kayıtlı yeri aç" tek seferlik istek; Android geri; sheet/composer/açık konuşmada bar gizlenir.

## 3. Düzeltilen buglar ve kanıtlar

| Bug | Kanıt | Düzeltme |
|---|---|---|
| Her filtre değişiminde harita kullanıcının konumuna geri dönüyor olabilir | Kod: mount `useEffect` bağımlılığı `moveToDeviceLocation` → `mapLayer`'a bağlıydı (kod incelemesi; **cihazda doğrulanmadı**) | Katman `ref` üzerinden okunuyor, bağımlılık kalktı |
| Uzun sheet içeriği ekranın üstünden taşıyor | Tarayıcı ekran görüntüsü: başlık ve fotoğraflar kesiliyordu | `maxHeight` yüzde yerine pencere yüksekliğinden hesaplanan sayı |
| `Yerler` katmanında canlı sinyali olan Place kayboluyor | `test-location-map-core` adım `[G]` düzeltmeden önce FAIL, sonra PASS | (önceki commit `4ea4045`) |
| Çıkış-giriş sonrası önceki kullanıcının kayıtlı yerleri görünür olurdu | Anahtarlar `userId` ile ad alanına alındı; `logout` tüm kabuk state'ini sıfırlıyor | `savedPlaces.ts`, `App.tsx` |
| Her App render'ında yeni `acceptAuth`/`logout` → ekranlarda polling/yükleme yeniden başlıyor | Kod: efekt bağımlılıkları | `useCallback` ile sabit kimlik |
| Aynı anda iki alt bar / sohbet ekranında eksik bar | Mevcut ekran görüntüleri 03 | Tek `BlinkrBottomBar` |
| Sonsuz spinner riski (sohbet) | Önceki oturumda ele alındı | Bkz. `b913f53` |

## 4. Çalıştırılan komutlar ve gerçek sonuçlar

| Komut | Sonuç |
|---|---|
| `npm run typecheck` | geçti |
| `npm run test:theme` | geçti (15 kontrast çifti) |
| `npm run test:nearby` (+ `map-selection`) | geçti |
| `npm run test:product` | geçti |
| `npm run test:ui` | geçti (composer akışları, harita kromu, profil, sohbet durumları, detay, kit) |
| `npx expo export --platform ios` | **geçti** (3014 modül) |
| `npx expo export --platform android` | **geçti** |
| `scripts/test-chat-smoke.ps1` | 22/22 PASS |
| `scripts/test-product-08.ps1` | exit 0, 60 PASS / 0 FAIL, `PHYSICAL_RETEST_REQUIRED` |

## 5. Cihazda doğrulanan / doğrulanamayan

**Doğrulanan (tarayıcı, react-native-web):** bileşen görünümü ve etkileşimleri, dar/geniş ekran (320/390/430/820), klavye gerektirmeyen tüm formlar, hata/boş/yükleniyor durumları, ham hata metninin sızmaması.

**Doğrulanamayan — fiziksel cihaz gerekir (yapılmadı):**
- Harita pan/zoom, marker/cluster dokunma, Apple/Google Maps koyu tema görünümü
- Sheet'i 15 kez aç/kapat, marker'dan marker'a geçiş, iOS `trackedTouchCount` uyarısı
- Sistem kamerası, medya yükleme, izin reddi/kalıcı ret akışları
- GPS, `Konumuma git`, 200 m proximity, klavye + composer
- Alt bar ve home indicator çakışması, Android geri tuşu, arka plan/ön plan
- Sekme değişince haritanın gerçekten aynı kalması (kodla sağlandı, cihazda görülmedi)
- Tasarımdaki yuvarlak font: sistem fontu kullanıldı, özel font dosyası yok

## 6. Bilinen sınırlamalar ve kalan işler

- **A. Profil "Sinyallerim/Katkıların" için backend gerekli.** `GET /api/posts-read/author/{id}` anonim erişime açık ve **her yazar için 0 dönüyor** (author filtresi çalışmıyor; kök neden bulunamadı). Ayrıca düzeltilirse, sahibi dışında anonim (`AnonymousMap`) paylaşımları listelememesi gerekir (anayasa §10.3). Çözüm: kimlik doğrulamalı, sahibine özel yeni bir uç nokta. Profil bu yüzden kaydedilen yerleri gösteriyor.
- **B. Sheet açıkken alt bar gizli.** Tasarım (02) barı sheet üstünde gösteriyor; tek overlay sahibi ve dokunma kilidi riski (CLAUDE.md §12.4) nedeniyle bar gizleniyor.
- **C. Marker üstü ön izleme balonu yok** (tasarım 01'deki "Hayat Lokantası / N kişi burada"). Marker'a dokunmak doğrudan detayı açıyor; ara durum eklemek dokunma yaşam döngüsünü karmaşıklaştırır ve balonun içeriği (kişi sayısı) uydurma olurdu.
- **D. Composer tasarımı tek panel, uygulama dört adım.** Yer seçimi ve proximity açıkça ayrı adım olarak kalmalı (CLAUDE.md §12.2, §10).
- **E. Sohbet okunmamış noktası** sohbet dışındayken 30 sn'de bir, yalnızca ön planda kontrol ediliyor (kalıcı bağlantı yok, CLAUDE.md §6.5 uyumlu).
- **F. Harita `/api/map/bounds` ilk çağrı gecikmesi ~2 sn** (sonrakiler 20–90 ms). Önbellek ıskalaması değil; kök neden bulunmadı.
- **G. `Tümü` katmanı** son gözlemi 180 dk içinde olan Place'i, canlı durumu bitmiş olsa da gösteriyor (mevcut davranış; taşındı, değiştirilmedi ve testle belgelendi).
- **H. `messageId` üzerinde tekil index** (BlogService) worker'ın `processed_messages` koleksiyonunda; ikinci bir consumer eklenirse yanlış "duplicate" üretebilir (mevcut, bu işle ilgisiz).
- Tasarım paketindeki `ornek-kod/` dosyaları referans olarak okundu, doğrudan kopyalanmadı (gerçek tip/route/veri kaynaklarına uyarlandı).

## 7. Cihaz testi için adımlar (iki telefon)

1. `http://192.168.1.35:5080/health` telefon tarayıcısında açılıyor mu (Firewall).
2. `cd src\Clients\Blinkr.Expo; npm run start:lan`
3. Harita: filtre değiştir → harita **yerinde kalmalı**; marker'a art arda dokun → detay aç/kapat → haritayı kaydır.
4. Sekme: Harita → Sohbet → Harita: viewport/filtre korunmalı.
5. Composer: alt bar kamerası → çek → Yer/Sinyal/İçerik/Sinyal bırak; 200 m dışı Place'te sunucu reddi mesajı.
6. Sohbet: iki kullanıcı; okunmamış rozeti ve alt bardaki nokta; en yeni mesaj altta.
7. Profil: bir yeri kaydet → Profil'de görünsün → dokun → haritada açılsın; çıkış-giriş → başka kullanıcıda liste boş.
8. Sorun olursa Metro/Xcode `[Blinkr ...]` loglarını ve ekran görüntüsünü ilet.
