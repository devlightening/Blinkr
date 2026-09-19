# BLINKR — Mobil Uygulama Kök Neden Analizi, Ürün Revizyonu ve Kabul Şartnamesi

**Görev kodu:** BLK-MOBILE-REBUILD-09  
**Hedef:** iOS/Android'de çalışır, fiziksel cihazda doğrulanabilir, harita-merkezli bir özel beta.  
**Hedef araç:** Claude (mevcut Blinkr deposunu inceleyip değişiklik yapacak kod ajanı).  
**Belge niteliği:** Ekran görüntüleri + Expo loglarına dayalı hata raporu, uygulama talimatı ve kabul sözleşmesi.  
**Önemli:** Bu belgede belirtilen *gözlemler* kanıta dayalıdır. *Muhtemel nedenler* araştırma hipotezidir; kod ve çalışma zamanı logları incelenmeden kesin kök neden diye raporlanamaz.

---

## 1. Claude'a doğrudan görev

Blinkr deposunu aç. Önce mevcut uygulamanın çalışma zamanını, servislerini, veri akışlarını, ekran ağacını ve son değişikliklerini oku. Aşağıda belgelenen kritik hataları **yeniden üret, kök nedenlerini kanıtla, hedefli testler ekle ve düzelt**. Sonrasında mobil uygulamanın navigasyonunu, haritasını, gönderi oluşturucusunu, sohbetini, profilini, marka/ikon ve bileşen sistemini tutarlı, hızlı, erişilebilir, özgün ve tamamlanmış bir ürün deneyimi olarak yeniden düzenle.

**Yalnızca renk/arayüz revizyonu yapma.** Çalışmayan akışları önce gider. Ayrıca yalnızca bir `npm run typecheck` sonucuna dayanarak `PASS` yazma. Fiziksel iPhone testi benim tarafımdan yapılacaksa `PARTIAL — PHYSICAL_RETEST_REQUIRED` olarak belirt. Gerçekte uygulanmamış sohbet, bildirim, sosyal özellik veya medya altyapısını çalışıyormuş gibi gösterme. Büyük kapsam nedeniyle işi iç planında bağımlılıklara göre yürüt; tek görev içinde ara aşamaları bitirip kritik arızalar düzelmeden yalnız kozmetik teslimat yapma.

### Değişmez ürün vaadi

Kullanıcı uygulamayı açtığında haritaya ulaşır; yakındaki gerçek yerleri bulup seçebilir veya koordinat temelli içerik paylaşabilir; fotoğraf/video eklese de gönderiyi güvenli ve öngörülebilir şekilde yayınlar; yayınlanan içerik haritada veya seçilen yerin detayında doğru görünür. Kullanıcı teknik servis, PlaceId, doğrulama seviyesi ve HTTP kodlarıyla uğraşmaz.

---

## 2. Kanıt ve mevcut durum: gözlem / hipotez ayrımı

| ID | Ekranda / logda gözlenen gerçek | Doğrulanması gereken yorum |
|---|---|---|
| OBS-01 | Sohbet ekranı neredeyse tamamen boş, ortada yükleme göstergesi var. | Sonsuz loading, başarısız/boş sohbet sorgusu veya tanımsız boş durum olabilir; hangisi olduğu bilinmiyor. |
| OBS-02 | Harita üstünde `CANLI ÇEVRE · 0 görünür` ve alan tarama sırasında yüklenme gösteriliyor. | Gerçekten aktif veri olmayabilir; ağ hatası/boş veri/yanlış bounds da olabilir. Harita tabanı görüntüsü tek başına Blinkr verisinin geldiğini kanıtlamaz. |
| OBS-03 | Composer'da `Yakındaki yerler şu an yenilenemedi. Tekrar dene.` uyarısı ve boş yer listesi görülüyor. | GPS edinimi çalışsa da API, Gateway, PlaceService, auth veya request lifecycle nedeniyle sonuç gelmiyor olabilir. |
| OBS-04 | `Yakındaki yerler` için `accuracyMeters: 14` bulunan DEVICE isteği de, MAP_CENTER isteği de `failed` dönüyor. | Hata GPS kesinliği yetersizliğine indirgenemez. HTTP durum/response, hedef URL ve servis health ile ayrıştırılmalı. |
| OBS-05 | `Medya hazırlanıyor` metinli buton uzun süre pasif/yükleme halinde; fotoğraf/video paylaşılamıyor. | Medya durum makinesi, upload/state polling, submit enable koşulları veya iptal/timeout temizliği sorunlu olabilir. Ekran görüntüsü tek başına kesin sebebi söylemez. |
| OBS-06 | Harita ve composer üzerinde büyük, mavi dişli şeklinde yüzen görsel var; sohbet ekranında da görülüyor. | Muhtemelen debug/ayar kısayolu veya yanlış icon; amacı kodda bulunmalı, ürün akışına uygun yere taşınmalı. |
| OBS-07 | Bottom bar, sheet açıkken arkada görünmeye devam ediyor; içerik/alt işlem alanı birbirine yaklaşarak çakışıyor. | Z-index, safe-area, keyboard, sheet snap-point ve tab bar görünürlük politikası incelenmeli. |
| OBS-08 | `YER · 1/4` ve `SİNYAL · 2/4` aşamalarında hata üstte tekrarlanıyor; birbirinden bağımsız adımlar aynı yan hatadan etkileniyor. | Nearby fetch'in tüm composer/publish akışını kilitleyip kilitlemediği araştırılmalı. |
| OBS-09 | Referans ekranları yatay geçiş, mesaj listesi, kamera/oluşturma merkeziliği ve kompakt tab bar mantığı gösteriyor. | Bunlar yalnız etkileşim/yerleşim referansı; görseller, logo, karakterler ve birebir ekran kopyalanmayacak. |

**Ekran görüntüsü anahtarı (kullanıcının yüklediği sırayla):** 1: boş sohbet ve loading; 2: sinyal seçimi, uyarı ve medya hazırlanıyor; 3–4: yer seçimi, sonuç yok ve yayın butonu kilitli; 5: harita genel görünüm; 6: harita bağlantı hatası; 7–8: kullanıcı tarafından sunulan Snapchat açık/koyu tema etkileşim referansları. Claude'a ekran görüntüleri ayrıca eklenebilirse görsel kontrol yap; eklenemiyorsa bu maddelerde anlatılmayan ayrıntıları uydurma.

### Expo kanıtı — aynen korunmuş önemli satırlar

```text
[Blinkr NearbyRequest] {"accuracyMeters":14,"id":1,"reason":"COMPOSER_OPEN","source":"DEVICE"}
[Blinkr NearbyRequest] {"accuracyMeters":14,"id":2,"reason":"MANUAL_REFRESH","source":"DEVICE"}
[Blinkr NearbyRequest] {"accuracyMeters":14,"id":3,"reason":"MANUAL_REFRESH","source":"DEVICE"}
[Blinkr NearbyResult]  {"extended":0,"id":3,"nearestMeters":null,"primary":0,"status":"failed"}
[Blinkr NearbyRequest] {"accuracyMeters":null,"id":4,"reason":"MANUAL_REFRESH","source":"MAP_CENTER"}
[Blinkr NearbyResult]  {"extended":0,"id":4,"nearestMeters":null,"primary":0,"status":"failed"}
[Blinkr NearbyRequest] {"accuracyMeters":14,"id":5,"reason":"MANUAL_REFRESH","source":"DEVICE"}
[Blinkr NearbyResult]  {"extended":0,"id":5,"nearestMeters":null,"primary":0,"status":"failed"}
[Blinkr NearbyRequest] {"accuracyMeters":14,"id":6,"reason":"MANUAL_REFRESH","source":"DEVICE"}
[Blinkr NearbyResult]  {"extended":0,"id":6,"nearestMeters":null,"primary":0,"status":"failed"}
```

**Çıkarım sınırı:** `failed` hata tipi veya HTTP durumunu göstermiyor. `nearestMeters: null` başarısız sorguda beklenebilir; 'yakınında gerçekten yer yok' anlamına gelmez. `id:1/2` için sonuç görülmemesi, tek başına iptal mi yoksa eksik log mu olduğunu kanıtlamaz. Dört ayrı başarısız isteğin aynı sebepten kaynaklandığı da henüz doğrulanmamıştır.

---

## 3. Kritik hata envanteri — tam çözülmeden kozmetik PASS yasak

### P0-01 — Nearby Place yüklenmiyor

**Belirti:** cihaz konumu 14 m accuracy bildirirken yakın yerler yenilenemiyor; MAP_CENTER da başarısız. Yer seçimi ve Place post akışı engelleniyor.

**İncele ve kanıtla:**
1. iPhone'un kullandığı gerçek API base URL'si, cihaz–PC aynı ağ erişimi ve Gateway dinleme adresi. `localhost` telefonda PC değildir; önceki LAN IP'nin güncel olduğu varsayılmasın.
2. `start-blinkr-dev.ps1`/`status-blinkr-dev.ps1` ile tüm gerekli servis health; Gateway üzerinden `GET /api/places/nearby` ve doğrudan PlaceService karşılaştırması. API sadece HTTP 200 döndü diye başarılı katalog sorgusu sayma; response schema, coverage ve sonuç sayısını incele.
3. Expo `api.ts`, MapScreen ve nearby request ownership: gerçek URL, request origin, abort nedeni, timeout, stale-discarded, HTTP status, response parsing, state transition. Aynı composer açılışı gereksiz istek yağmuruna sebep olmasın.
4. Mongo POI kataloğunun test edilen GERÇEK cihaz bölgesindeki kapsaması, geospatial index, `lat/lon` sırası, kilometre/metre birimleri, koordinat yuvarlama, distance ve pagination. Eski Ankara/Etimesgut fixture'ları Osmaniye veya başka bölge için kapsama kanıtı değildir.
5. `DEVICE` / `MAP_CENTER` ayrımı; cihaz GPS'i seçilmişken harita merkezi konumuna sessizce geçme. MAP_CENTER seçildiyse sadece onun koordinatını esas al.
6. `FAILED`, `EMPTY`, `NOT_LOADED`, `READY`, `LOADING` durumlarını tutarlı ayır. Başarısızlıkta eski geçerli listeyi silme; ancak eski listenin hangi bölgeye ait olduğunu açıkça göster ve farklı konuma yanlışlıkla sunma.

**Düzeltme:** Yer seçimi local catalog üzerinden hızlı sonuç vermeli; yavaş dış OSM/Overpass çağrısı foreground'u kilitlememeli. Eksik kapsamada hızlı, dürüst `NOT_LOADED`; hatada retry; gerçek boş listede `EMPTY`. Sahte POI ekleyerek testi geçirme.

**Kabul:** sağlıklı ağ + katalog bulunan bölgede yakın yerler mesafeye göre seçilebilir; ağ kesintisinde sonsuz spinner yok; hata ayrıntısı geliştirme logunda mevcut; coordinator değişince eski yanıt yeni sonucu ezmez. Başarısız durumda koordinat paylaşımı çalışmaya devam eder.

### P0-02 — Fotoğraf/video ile post yayınlanmıyor; `Medya hazırlanıyor` takılıyor

**İncele ve kanıtla:**
- Compose açılır açılmaz neden `Medya hazırlanıyor` görüldüğünü kontrol et. Medya **seçilmemişse** medya yüklemesi submit'i bloke edemez.
- Kamera/galeri izinleri, URI/MIME, dosya boyutu, doğrulama, network/timeout, JWT/refresh, presign, upload, status, ATTACHED geçişi ve `POST /api/posts` arasındaki gerçek state transitions.
- Mevcut sözleşme: `PENDING -> READY -> ATTACHED -> EXPIRED`; public okuma yalnız `ATTACHED`. Bu güvenlik modelini kaldırma veya bypass etme.
- Upload statüsü `READY` olup post ekleme `ATTACHED` olmadan mı bekliyor? `ATTACHED` geçişi post transaction'ında mı gerçekleşiyor? Döngü/deadlock var mı? Mevcut kod ve logla kanıtla.
- Fotoğraf ve videoyu ayrı ayrı test et; video poster/thumbnail henüz implemente değilse bağımsız bir sınırlama olarak raporla, mevcut oynatma yolunu gereksiz bozma.
- Retry, kullanıcı iptali, ekran kapatma, uygulama yeniden açılışı, bağlantı kaybı, duplicate submit/idempotency ve başarısız POST sonrasında formun/medyanın korunmasını doğrula.

**Beklenen durum makinesi:** `IDLE -> SELECTED -> PREPARING/UPLOADING -> READY -> PUBLISHING -> SUCCESS` ve açık `FAILED/CANCELLED` yolları. Ön hazırlık ile gönderi yayınlama durumları ayrı olmalı. Hata sonrası eylemli `Tekrar dene`; arka planda sonsuz polling yok. Buton metni gerçekleşen eylemi tarif etmeli: `Yayınla`, `Fotoğraf yükleniyor`, `Yayınlanıyor` vb.

**Kabul senaryoları:** metin-only; sinyal-only; fotoğraf-only (ürün sözleşmesi izin veriyorsa); video-only (izin veriyorsa); sinyal + fotoğraf; Place + fotoğraf; COORDINATE + fotoğraf. Her birinde başarı cevabı, post kimliği ve doğru map/place projection sonucu doğrulanmalı. İstek başarısızsa başarı toast'ı gösterme.

### P0-03 — Composer, Nearby hatası yüzünden kilitleniyor

Yakındaki yerler fetch'i başarısız olduğunda **yer seçmeden koordinat postu** oluşturulabilmeli. `nearbyLoading`, `mediaPreparing` ve `isPublishing` ayrı state'ler olmalı; yalnız ilgili adımın kullanıcı eylemini kısıtlasın. Yer zorunluluğu yalnız gerçekten PLACE yayın tercih edildiyse devreye girsin. Haritada seçilen koordinat ve cihaz koordinatı bilinçli seçilmeli; kaynağı kullanıcıya gösterilmeli. Form, ağ hatası veya sheet kapat/aç yüzünden kendiliğinden silinmemeli.

### P0-04 — Harita scan / marker ve 0 görünür durumu

`CANLI ÇEVRE · 0 görünür` gerçek active dataset boşluğu, viewport filtresi, yanlış zaman penceresi, yanlış backend base URL veya ağ hatası mı? `GET /api/map/bounds` için cihaz viewport bounds, `sinceMinutes`, `limit`, payload count ve applied state'i uçtan uca doğrula. Harita sağlayıcısının çizdiği ticari yer ikonları Blinkr Place katalog/aktif marker'ı değildir. Ana harita tüm import edilen POI'leri çizmemeli; aktif Place ve taze koordinat sinyallerini göstermeli. 0 veri, loading ve network error birbirinden ayrılmalı. Scan her başarı/abort/timeout/error durumunda sonlanmalı; başarısızlıkta var olan pinler sebepsiz sıfırlanmamalı. Yeni yayınlanan post, doğru bounds ve projection gecikmesi hesaba katılarak görünür hale gelmeli; anında kesin sonuç yoksa dürüst pending göster.

### P0-05 — Auth / servis bağlantısı ve 502 regresyonu

Daha önce Gateway `:5080`, Identity `:5188`, Blog `:5215`, Place `:5225` ve diğerleriyle çalışan local stack vardı; servislerin **şu an** çalıştığını varsayma. Tek komut startup/health'i koru. iPhone'dan Gateway'e erişim, CORS yerine mobil bağlantı gerçekleri, LAN/firewall, token expiry/refresh, backend route'ları, medya upload URL'si ve response body'sini teşhis et. `HTTP 502` / `401` / `422` / timeout birbirinden farklı durumlar; yalnız 'internet yok' mesajı ile hepsini gizleme. User-facing metin sade; geliştirme logu korelasyon kimliği ile ayrıntılı. Gerçek port/route kanıtı göstermeden hatanın Overpass'tan olduğunu iddia etme.

### P1-01 — Sohbet ekranı boş ve loading süresiz

Ekran açıldığında spinner'ın ne zaman sonlanacağını belirle. Sohbet backend'i/mesajlaşma API'si gerçekten mevcut mu, auth ve endpoint çalışıyor mu, veri dönüyor mu? Eğer sohbet henüz yoksa sahte konuşma ve boş çalışan görünüm üretme; bu özelliği dürüstçe 'yakında' durumu ile devre dışı bırak veya gerçek minimal mesajlaşma dikeyini mevcut mimariyle planla/uygula. Eğer varsa chat listesi, unread, search, empty, offline, retry ve conversation detayını tamamla. Sadece spinner bırakma; isteğe üst süre sınırı ve teardown ekle.

### P1-02 — Konum/PLACE güven düzeyi ve posting

Kullanıcı PlaceId girmez. Yakınlıkla Place **seçmek**, gerçekten mekânda olduğunu **doğrulamak** ile ayrı kavramlar. Daha önceki gereksinim: yakındaki Place hakkında paylaşım mümkün; güvenilir canlı Crowd/Queue gibi durum yalnız sunucunun doğruladığı katılımdan etkilenir. Depoda bu `VERIFIED_LIVE` / `NEARBY_PLACE_POST` ayrımı gerçekten var mı önce kontrol et. Yoksa yalnız UI kuralını gevşeterek uzak mekândan sahte canlı sinyal gönderilmesine izin verme; sunucu domain, projection ve istemci kontratını birlikte, testli biçimde güncelle. Mevcut 200 m realtime enforcement keyfi kaldırılmayacak. Büyük park/AVM için OSM geometry/polygon mümkünse merkeze değil geometriye yakınlık; yoksa doğrulanmamış alan toleransını belirsiz 'verified' olarak gösterme. Accuracy 2000 m gibi kötü ölçümler güven sağlamaz. Place içeriği için tam şube kimliği korunur (aynı isimli BİM'leri adla birleştirme). Medyalı post bu politikayı atlamaz.

### P1-03 — UI etkileşim / touch freeze regresyonu

Geçmişte iOS MapView marker + native Modal responder çakışması ve `trackedTouchCount` uyarıları yaşandı. MapScreen tek overlay host, kapalıyken unmount, abort/sequence guard yaklaşımını koru. Yeni animasyon/gesture navigasyonu eski donmayı geri getirmemeli. `Place -> kapat -> Signal -> kapat -> Composer -> geri` döngülerini tekrar test et.

---

## 4. Görsel ve ürün sorunları — ekran bazlı tasarım denetimi

| Ekran / bileşen | Sorun | Hedef çözüm |
|---|---|---|
| Sohbet | Koyu, içeriksiz geniş alan; yalnız spinner; büyük dişli sağ üstte. | İşlevsel chat veya dürüst empty/error state, başlık + arama + liste; settings Profil'e; kalıcı loading yok. |
| Harita üst bar | Aşırı yüksek ve koyu blok; içerik üzerinde yer kaplıyor; `0 görünür` muğlak. | Kompakt floating header, net live count, durum ayrımı, safe area. |
| Üst filtreler | `Tümü / Canlı / Yerler / Sinyaller` yatay alanda sıkışıyor ve haritayı gölgeliyor. | Scrollable, belirgin seçili state, erişilebilir chip'ler; uygun zoom/viewport davranışı. |
| Mavi dişli | Marka paletinden kopuk, hem haritada hem sohbet ekranında yüzerken arayüzü domine ediyor. | Gerçek işlevini tespit et; debug ise dev-only; ayarlar ise Profil'e taşı. Silme kararını mevcut işlevi koruyarak ver. |
| Harita alt bar | Fazla yüksek/opak; farklı yerlerde seçili renk ve ikon dili değişiyor. | Tutarlı tek navigation component, safe area, düşük görsel yük, 44pt+ hedefler. |
| Composer | Sürekli büyük kırmızı network banner; yanlış yerde tekrarlanıyor, akışı bölüyor. | Bileşene özgü küçük inline hata, bağlamlı yeniden dene, form çalışıyorsa global block yok. |
| Signal seçenekleri | 2 sütunlu büyük kartlar ekranda çok alan kaplıyor; ikon/renk semantiği tam tutarlı değil. | Daha kompakt, aynı grid ritmi, seçili/disabled state ve erişilebilir etiketler. |
| Yer seçimi | Yer listesi yoksa yalnız hata görünüyor, sonra sanki tüm gönderi bloke. | Cihaz/harita noktası, yer arama, cached/empty/not-loaded state, coordinate fallback. |
| Üç aksiyon yan yana | `Yer ara`, `Yakınımdaki yerler`, `Haritadaki nokta` mobil genişlikte metinleri sıkıştırıyor. | İki satır veya uygun responsive layout; ikona + satır kırılımına güvenip ezilme oluşturma. |
| Yayın CTA | `Medya hazırlanıyor` belirsiz, tek state her şeyi bloke ediyor; alttaki alanla çakışıyor. | Sticky safe-area CTA; gerçek upload durumu, retry ve bağımsız loading; yalnız `isPublishing` submit kilidi. |
| Logo/marka | Görsel kimlik yeni olsa da aşırı koyu/lime ve mavi gear tutarsızlığı var. | Özgün blinkr renk/ikon token'ları; ikon kontrast ve gerçek işlev tutarlılığı. |
| Loading/empty | Harita, chat ve nearby için sonsuz spinner/yalancı boşluk. | Bounded loading + skeleton + eksiksiz EMPTY/ERROR/OFFLINE/NOT_LOADED ayrımı. |

**Özgünlük kuralı:** Kullanıcının Snapchat ekranları yalnız sayfalar arası akış, kompakt navigasyon, chat hiyerarşisi, kamera/oluşturma merkeziyeti ve hızlı etkileşim ilkesi için referanstır. Snapchat karakterleri, marka rengi zorunluluğu, aynen ikonlar, görseller veya piksel düzeyi ekran klonu yapılmayacak. Blinkr'ın harita + taze sinyal kimliği korunacak.

---

## 5. Navigasyonun hedef davranışı (kesin ve test edilebilir)

**İlk açılış / oturum geri yükleme sonrası ana ekran: HARİTA.** Auth gerekiyorsa auth akışı tamamlandıktan sonra map'e geç.

**Bottom bar soldan sağa:** `Sohbet | Harita | + (Paylaş) | Profil`. Ortadaki `+` ayrı bir tam ekran sekme olmak zorunda değil; seçili yer/sinyal bağlamıyla bir **composer overlay/akışı** açan merkez aksiyondur. Harita ikonuna basmak her zaman haritaya götürür. En sağ `Profil` ve ayarlar Profil içindedir; yüzen gear gereksiz. Açılmamış özellik tab'i ekleme.

**Kaydırma isteği:** Kullanıcının istediği yönü açık şekilde uygula ve test et: **haritadayken sola yatay kaydırma → Sohbet; sohbetten sağa kaydırma → Harita**. Profil tab barın en sağında, profile tab ile erişilir; profil için swipe eklenecekse map/chat hareketleriyle çakışmayan ve keşfedilebilir ayrı bir kural tasarla, rastgele ters swipe davranışı oluşturma. Native screen-stack/tab geçişleri üzerinden implement et; karmaşık el yapımı gesture router kurma. Swipe davranışı uygulamadaki `MapView` pan ve yatay Place filtreleriyle çakışmamalı: haritaya dokunup yatay sürüklemek normalde haritayı kaydırmalı, ekran değişimi sadece açıkça belirlenmiş navigation gesture alanında veya tab tap ile olmalı. Kullanıcı için alternatif daima tap olacaktır.

**Sheet açıkken:** yatay navigasyon devre dışı; sheet swipe down/kapat çalışır; klavye açıkken keyboard dismiss ve safe-area sabit; alt bar sheet'in altında yanlış etkileşime açık olmaz; composer kapanınca içerik/draft geri döndürme politikası nettir. İlk açılışta gereksiz izin popup'ları, otomatik composer veya chat'e düşme yok.

**Not:** Snapchat'in kendi gesture ekran sırasını birebir kopyalamak zorunlu değil; yukarıdaki explicit yönler kullanıcının mevcut Blinkr isteği olarak uygulanacaktır. Harita ile sohbet arasındaki swipe harita pan ile güvenle birleştirilemiyorsa tab tap'i güvenilir varsayılan tut, çatışmayı raporla ve yanlış çalışan gesture ekleme.

---

## 6. Baştan sona mobile yeniden düzenleme kapsamı

### 6.1 UI mimarisi ve tasarım sistemi

- Önce mevcut Expo SDK/React Native ve navigation bağımlılıklarını incele; uygulamaya uyumsuz yeni kütüphaneler yığma. Expo Go ile desteklenmeyen native modül eklemeden önce dev build gerekeceğini belirt.
- `theme/tokens`: renk, spacing, radius, shadow/elevation, font type scale, semantic color, dark/light mode, reduced motion, safe-area.
- Yeniden kullanılabilir: `AppScaffold`, `BottomNav`, `FloatingMapHeader`, `Chip`, `PlaceRow`, `SignalTypeTile`, `ComposerSheet`, `MediaTile`, `PrimaryButton`, `InlineError`, `EmptyState`, `Skeleton`, `PlaceDetailSheet`, `SignalDetailSheet`.
- Dark tema kontrastı gözle kontrol et; siyah üstüne koyu yeşil yazı, aşırı neon lime, gereksiz ağır başlık, yatay taşma ve text truncation yok. System dynamic font size, VoiceOver/accessibility labels, 44pt dokunma hedefleri.
- Logo, app icon, splash ve marker'ları Blinkr kimliğine uygun **özgün vector-first** çöz; SVG/PNG pipeline ve Expo app.json/app.config güncellemelerini denetle. Yeni logo üretimini işlevsel beta blocker'lardan önce yapma.
- Mümkün olduğunda gerçek ekranda farklı iPhone boyutları için screenshot test/manuel kontrol; tablet/Android kırılmalarını kontrol et.

### 6.2 Map-first ürün

- Açılışta map render; izin reddedilirse manuel konum/harita merkezi ve açıklayıcı durum. Cihaz lokasyonunu alır almaz haritayı kontrolsüz sürekli recenter etme.
- Konum mavi dot/accuracy circle kısa ve sade; mahremiyete uygun yaklaşık public pin, tam GPS'i public response'a dökme.
- Harita üst bar ve active filters map içeriğini örtmesin; loading sınırlı; map bounds fetch debounce/request ownership ile performanslı; active marker + signal cluster görsel dili tutarlı.
- Marker tıklama detay aç/kapat, z-index ve native responder güvenli; touch freeze regresyonu yok.
- Place/Signal distinct marker, type semantiği, freshness ve selected state; düşük zoom'da clustering, yüksek zoom'da kararlı selection; mükerrer işaretçi yok.

### 6.3 Composer ürün akışı

1. `Nerede?`: cihaz konumu / yakın POI / arama / harita noktası. Place seçimi zorunlu değil.
2. `Ne oluyor?`: sinyal kategorisi; kategorisiz text/media post destekleniyorsa mevcut backend kontratına sadık kal.
3. `Anlat / Kanıt ekle`: kısa başlık, açıklama, galeri/kamera ve medya preview/remove/retry.
4. `Önizle / Yayınla`: Place adı veya yaklaşık konum, görünürlük, güven düzeyi hakkında sade dil; gerekli validasyon; yapışkan yayın butonu.

Adım başlıkları ve progress sayacı uygulanan state ile gerçekten eşleşmeli. Kullanıcı adım geri geldiğinde seçimler kaybolmamalı. Medya işlemi yer listesi hatasından etkilenmemeli. Bir kullanıcı `Gözlem + metin + fotoğraf + coordinate` yolunu, POI hiç yüklenmese bile tamamlayabilmeli. Yetkisiz token'da sessiz fail yerine tekil refresh/login akışı; çift basış duplicate post üretmemeli.

### 6.4 Sohbet

Gerçek sistem hazırsa conversation listesi, arama, unread, preview, relative time, boş durum, hata/retry, avatar fallback; backend yoksa dürüst 'henüz kullanıma açılmadı' empty state ve çalışmayan CTA'ları kaldır. Sonsuz loader ve hayalî kişiler yok. Mesajlaşma için yeni mikroservis gerekiyorsa mevcut bounded context ve güvenlik modelini bozmadan uygulama planını ve gerçek uygulanmış kapsamı raporla; sırf tasarım talebi yüzünden sahte backend varmış gibi yapma.

### 6.5 Profil

Profil tab'ı gerçek hesap bilgisi, avatar/placeholder, kendi gönderileri veya kullanılabilir gerçek bölümler, görünürlük/gizlilik tercihleri (gerçekte desteklenenler), ayarlar, çıkış ve oturum yönetimi içersin. Mavi gear buraya taşınmalıysa burada tutarlı ikonla sun; debug seçenekleri dev-only olsun. Boş, çalışmayan butonları gizle/devre dışı bırak ve nedenini belirt. Başka kullanıcının private verisini açığa çıkarma.

---

## 7. Sağlam konum ve yayın sözleşmesi

- Place catalog **yer bulmak** içindir; haritada görünen Apple Maps POI otomatik Blinkr Place değildir. Import edilen POI'lerin tümü ana haritada çizilmez.
- `DEVICE` ile `MAP_CENTER` origin'leri ayrı. Mümkünse taze konum, timestamp + accuracy; eksik accuracy `0` gibi gösterilmez. Mesafe aynı origin ile hesaplanır; sıralama düz çizgi mesafesi ise 'yaklaşık' yazılır, Google Maps yürüyüş rotası ile eşit olduğu iddia edilmez.
- Kapsama bulunmayan bölgede sonuç yoksa bunu dürüstçe belirt; gerektiğinde uygun bölgesel katalog işlemini iste. Kaynağı belirsiz Osmaniye POI'sini Ankara kataloğundan üretme.
- Place seçiminde canlı/yer hakkında paylaşım ayrımını koru. 200m live verification policy'yi sadece client üstünde bypass etme. Yakın ama doğrulanmamış yer postu sözleşmesi gerçekten yoksa backend/domain/projection ve smoke test birlikte uygulanmadan UI'ı 'yayınlandı' gösterme.
- COORDINATE paylaşımında hassas ev koordinatlarını ifşa etmeyen public pin; yanlış pin konumu ve rastgele sahte offset ile başka mekâna işaret etme riskini gizlilik politikasıyla tutarlı çöz.
- Yayın durumları: `post accepted` ile `map projection visible` aynı an olmayabilir; durum mesajı ve gerekirse kısa, sınırlı refresh/poll uygula. Sonsuz `işleniyor` yok.

---

## 8. Teşhis için zorunlu yapılandırılmış log ve dev aracı

**Yalnız development build'de**, kişisel GPS'i, token'ı ve medya URL imzalarını açık loglamadan şu korelasyonu ekle:

```text
[Blinkr API] route, requestId, source, elapsedMs, httpStatus, errorCode, aborted, timeout
[Blinkr Nearby] requestId, source, accuracyBucket, coverageState, resultCount, applied|stale|failed
[Blinkr Media] mediaId(partial), mime, state, elapsedMs, failedStage, httpStatus
[Blinkr Publish] attemptId, anchorType, postId(partial), serverStatus, projectionState
[Blinkr Map] boundsRequestId, applied, placesCount, signalsCount, errorCode
[Blinkr Chat] loading|ready|empty|failed, status, elapsedMs
```

Kişisel konum için raw koordinat yerine testte isteğe bağlı redacted/bucketed origin; auth token, password, kullanıcı e-postası, tam GPS, EXIF ve object-store secret'ı hiçbir loga yazma. Teknik log ile Türkçe kullanıcı hata metni ayrı tutulmalı. Request trace ID backend–Gateway–client arasında mümkünse taşınmalı. Bir istek `failed` olduysa sebebini HTTP status/exception/code olarak geliştirme logunda kanıtla; `failed` tek başına yeterli değil.

**Çalıştırma rehberi** (gerçek repo/path/IP doğrulanarak):

```powershell
# Repo kökünden, PowerShell
powershell -ExecutionPolicy Bypass -File .\scripts\start-blinkr-dev.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\status-blinkr-dev.ps1

# Gerçek yerel IPv4 adresini doğrula; aşağıdaki örneği körlemesine kullanma.
ipconfig

# Cihazın erişebildiği güncel LAN IPv4 ile değiştir:
$env:EXPO_PUBLIC_BLINKR_API_URL = "http://<GERCEK_PC_LAN_IPV4>:5080"
cd .\src\Clients\Blinkr.Expo
npx expo start --lan --clear
```

`<GERCEK_PC_LAN_IPV4>` açıklama amaçlı placeholder'dır; geçerli IP girilmeden komutu çalıştırma. `--clear` her açılışta zorunlu bir çözüm değildir; değişen bundle/config cache'i temizlemek gereken testte kullan. Kullanıcıya aynı anda 11 ayrı terminali elle açtırma. Status READY ve yerel/telefon bağlantısı ayrı kontrol edilmelidir.

---

## 9. Uygulama ve test sırası — kalite kapıları

**Gate A — çalışma ortamı:** Dev stack health READY; iPhone'dan Gateway'e gerçekten istek gidebiliyor; Expo config güncel; Blog/Place/Identity route'ları doğrulanıyor. Elde edilen sağlık raporunu paylaş. Sağlık testi PASS olmadan UI refactor ile network arızasını örtme.

**Gate B — veri erişimi:** DEVICE ve MAP_CENTER için başarılı/fail/empty/not-loaded senaryoları; gerçek cihaz bölgesinde POI kataloğu ve en yakın 5 yer; branch ID + doğru mesafe + kategori; geç yanıt/stale ownership regresyon testi.

**Gate C — yayın:** koordinat metin, place metin, koordinat + fotoğraf, place + fotoğraf, video (mevcut kontrat destekliyorsa), hata/retry ve auth refresh. POST sonucu ile place/map read-model sonucu ayrımı. Gerçek media dosyası post'a bağlanmalı ve public erişim yalnız ATTACHED; orphan cleanup korunmalı.

**Gate D — kritik UX:** tüm loading/error/empty durumları, composer step progression ve geri dönüş, CTA state, keyboard, safe area, düşük ağ, offline, request cancel; sheet arkasındaki tablar pasif.

**Gate E — yeniden tasarım:** tasarım sistemi + marka, üst bar, tab bar, harita filtreleri/pinler, sohbet, composer, place/signal detay, profil; iOS küçük/büyük ekran ve Android düzeni.

**Gate F — performans/regresyon:** JS render sayısı, fetch debounce, map marker clustering, iOS touch interactions, memory/list virtualisation, app cold start; yeni dependencies Expo sürümü ile uyumlu. Paket uyarılarını ayrıca raporla, `expo-av` deprecation'ı network root cause sayma.

### Otomasyon / smoke / unit test minimumu

Repo gerçekten hangi testleri içeriyorsa onları çalıştır, yoksa test ekle; olmayan script adını PASS gibi yazma:

```text
npm run typecheck
npm run test:nearby
scripts/test-auth-gateway-smoke.ps1
scripts/test-nearby-distance-contract.ps1
scripts/test-nearby-place-ux-core.ps1
scripts/test-location-map-core.ps1
scripts/test-place-live-signal.ps1
scripts/test-content-media-smoke.ps1
scripts/test-reliable-event-delivery.ps1
```

Gerekli yeni testler: request failure reason mapping; offline nearby -> coordinate publish remains enabled; submit disabled only by actual publish/media conditions; no-media submit; media retry/cancel; duplicate submission prevention; presence trust projection isolation; chat loading timeout/empty; view state reset; map marker pressed & sheet closed; navigation gesture vs MapView pan.

### Benim fiziksel iPhone kabul listem

| Test | İşlem | Beklenen sonuç |
|---|---|---|
| D01 | Temiz açılış/login | İlk ana ekran HARİTA; servis erişimi. |
| D02 | Haritada pan/zoom | Harita hareket eder; rastgele chat'e geçmez, spinner takılmaz. |
| D03 | Composer aç → yakındaki yerler | Gerçek yakın POI, ad/kategori/mesafe; listede hata varsa nedeni + retry. |
| D04 | `MAP_CENTER` seç | DEVICE'dan bağımsız doğru origin; yerler buna göre. |
| D05 | Yakın Place seç | Seçilen şubenin PlaceId'si doğru; izin verilen yayın türü açıkça gösterilir. |
| D06 | POI servisini erişilemez kıl → koordinat postu | Yer listesi hata verirken koordinat paylaşımı hâlâ yapılabilir (diğer servisler erişilebilirken). |
| D07 | Metin-only coordinate paylaş | Başarı + haritada pin + detay; gereksiz `Medya hazırlanıyor` yok. |
| D08 | Fotoğraf ekle, gönder | Upload READY / POST / ATTACHED güvenli ve tamamlanır, doğru pin/detail. |
| D09 | Video ekle (destekleniyorsa) | Upload/playback veya açıkça raporlanan destek sınırı; sonsuz spinner yok. |
| D10 | Place + fotoğraf | Post ilgili Place detayına bağlanır; doğrulanmamış live state'i sahte güncellemez. |
| D11 | Uçak modu/bağlantı kesilmesi | Hata, retry, korunmuş draft; sonsuz bekleme yok. |
| D12 | 10× Place ve 10× Signal detayı aç/kapat | Dokunmatik çalışır; overlay responder sızıntısı yok. |
| D13 | Haritada sola kaydır / sohbetten sağa | Çatışmasız istenen geçiş; map pan yanlış route açmaz. |
| D14 | Sağdaki Profil'e bas | Gerçek profil ve ayarlar; yüzen mavi gear yok. |
| D15 | Sohbet aç | İçerik/boş durum/hata açık; kalıcı spinner yok. |
| D16 | Uygulamayı kapat/aç | Oturum, draft davranışı, navigasyon ve map state öngörülebilir. |
| D17 | İkinci cihazda aynı alanı aç | Birinci cihazın yayınlanan içeriği yetki/gizlilik kuralları içinde görünür. |

---

## 10. Kapsam disiplinleri ve güvenlik

- Çalışan mikroservisleri komple yeniden yazma; sorun kanıtı olmayan auth/EventStore/RabbitMQ/OSM mimarisini sırf refactor uğruna bozma.
- Kod içinde test için sabit konum, key, gerçek kullanıcı hesabı, şifre, debug fake place veya hard-coded IP bırakma. Test fixture'ları prod verisine karışmasın.
- Güvenlik: server-side JWT ve ownership, EXIF sanitization, medya content/signature kontrolü, private location ve public pin anonimleştirme korunacak; canlı Place güvenilirliği istemci boolean'ıyla değiştirilmeyecek.
- Chat için bildirim/okundu/onay gibi altyapı yoksa sahte başarı ve sahte konuşma üretme.
- Kapsam dışı büyük sosyal ağ özelliklerine dalmadan önce P0 akışlarını bitir. Öncelik: **çalışan paylaşım > güvenilir konum > harita görünürlüğü > sohbet boş/gerçek durum > navigasyon > estetik**.
- Testlerde `PASS` yalnız komut gerçekten çalışmış ve sonuç kaydedilmişse. Çalışmayan Gateway sebebiyle skip edilen smoke PASS değildir.

---

## 11. Claude'un teslim formatı (kısa ancak kanıta dayalı)

Lütfen uygulamayı gerçekten düzenledikten sonra yalnız aşağıdaki başlıklarla rapor ver:

```text
## Overall Result: PASS | PARTIAL | FAIL
## Observed Root Causes (each with file/line + request trace evidence)
## Fixed P0 Defects (before/after)
## Nearby / Map / Media / Publish End-to-End Proof
## Chat: implemented vs unavailable (no fake feature)
## New Navigation & Gesture Contract
## Mobile Screens and Design System Changed
## Commands Executed and Results
## iOS/Android Device Tests: performed vs awaiting user
## Remaining Blockers and Exact Reproduction
## Changed Files
## Commit Message
```

**Kabul koşulu:** `NearbyResult status=failed` yerine yalnız görünümü saklamak, hatayı toast'la maskelemek veya `Medya hazırlanıyor` butonunun yazısını değiştirmek çözüm değildir. Place/coordinate ve medyalı postun gerçek API/veri/projection zinciri çalışmalı. Fiziksel cihazda doğrulanamayan kısım dürüstçe PARTIAL olarak kalmalı.

**Şimdi başla:** Önce çalışma ortamı ve ilk başarısız Nearby isteğinin gerçek hata nedenini izole et. Ardından metin ve medyalı postu uçtan uca yeşile getir. Bunlar düzelmeden büyük kozmetik refactor'a geçme; sonrasında yukarıdaki mobile-first Blinkr tasarımını tamamla.
