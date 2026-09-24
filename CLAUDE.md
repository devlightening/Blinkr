# Blinkr Proje Rehberi ve Mimari Calisma Sozlesmesi

Bu belge, Blinkr deposunda calisacak Claude veya baska bir yazilim ajaninin urunu, domaini, mevcut mimariyi, kritik veri akislarini, degismez urun kurallarini ve siradaki muhendislik hedeflerini tek okumada anlayabilmesi icin hazirlanmistir.

Bu belgeyi bir pazarlama metni olarak degil, proje devir dokumani ve calisma sozlesmesi olarak kullan. Bir degisiklik yapmadan once ilgili kodu ve testleri yine oku; bu belge yon verir ancak calisan kodun yerine gecmez. Kod ile bu belge celisirse once celiskiyi kanitla, sonra Product Constitution'a uygun olan cozumle ikisini birlikte guncelle.

## 1. En Kisa Tanim

Blinkr, insanlarin gercek dunyada bir yer hakkinda daha hizli, daha dogru ve daha guvenli karar vermesini saglayan harita merkezli bir mobil urundur.

Blinkr'in temel sorusu sudur:

> Su anda bu yerde ne oluyor ve bu bilgi karar vermem icin yeterince taze ve guvenilir mi?

Urunun merkezi nesnesi kullanici profili veya genel sosyal medya gonderisi degil, `Place` yani gercek dunyadaki yerdir. Kullanici bir yerin kalabalikligini, sirasini, gecici durumunu, firsatini, etkinligini veya genel gozlemini kisa omurlu bir `Signal` olarak paylasir. Diger kullanicilar bu sinyali haritada gorur ve bir yere gitme, bekleme, alternatif arama veya vazgecme kararini daha iyi verir.

Blinkr'in basarisi ekranda gecirilen sureyle degil, yer kararinin kalitesi ve kullaniciya kazandirdigi zamanla olculmelidir.

> **2026-09-22 pivot notu:** Kullanicinin bilincli kararıyla Blinkr, yukaridaki "yer karari" cekirdeginin
> uzerine Snapchat (kamera-oncelikli paylasim, hikayeler, harita) ve Instagram (profil, takip/takipci,
> yorum/tepki, kesfet akisi) tarzi bir sosyal katman ekleyerek genisliyor. Bu genisleme icin tam,
> ayrintili yürütme plani `docs/sinyal-mvp-plan/` altindadir (kendi `CLAUDE.md`'si var; `docs/plan/00_START_HERE.md`'den baslar). §2.2'deki bazi maddeler bu pivotla bilincli olarak gevsetildi;
> hangileri ve hangi korumalarla, §2.3'te yazili. Bu genisleme calisirken bile asagidaki §3-27'de
> tarif edilen mevcut mimari (EventStoreDB+Mongo CQRS/ES, .NET mikroservisleri, server-owned trust,
> privacy-by-default) **degismedi**; `docs/sinyal-mvp-plan/docs/plan/DECISIONS.md` D-001 geregi
> korunuyor ve yeni sosyal ozellikler bu mimariye uyarlanarak insa ediliyor, yerine yeni bir mimari
> yazilmiyor.

## 2. Product Constitution

Depodaki en ust urun kaynagi `docs/Product_Constitution_Blinkr_Urun_Anayasasi.docx` dosyasidir. Tum ADR'ler, mimari kararlar, roadmap ve ozellik talepleri bu anayasaya uymak zorundadir.

Yeni bir ozellik veya mimari degisiklik icin su dort soru yazili olarak cevaplanmalidir:

1. Kullanicinin bir yer hakkinda daha hizli karar vermesini sagliyor mu?
2. Kararin dogrulugunu veya guvenilirligini artiriyor mu?
3. Mahremiyeti ve kisisel guvenligi koruyor mu?
4. Blinkr'in `map-first` ve `place-first` kimligini guclendiriyor mu?

Bu sorularla uyumu gosterilemeyen bir ozellik MVP kapsaminda degildir. Guvenlik, mevzuat, kotuye kullanim onleme, operasyonel surdurulebilirlik veya sistem guvenilirligi icin gerekli ozellikler istisna olabilir; fakat azalttiklari risk acikca belgelenmelidir.

### 2.1 Degismez urun ilkeleri

- `Map-first`: Ana deneyim haritadir. Uygulama bir feed acilis ekrani degildir.
- `Place-first`: Icerik mumkun oldugunca bir `Place`, geo-cell veya yaklasik alan baglamina aittir.
- `Privacy by default`: Kesin cihaz konumu public arayuzde aciga cikmaz. Yaklasik alan ve yer merkezi tercih edilir.
- `Freshness over volume`: Az ama taze ve anlamli sinyal, cok ama eski icerikten degerlidir.
- `Trust is server-owned`: Mesafe, yakinlik ve yayin guveni istemcinin iddiasiyla degil sunucu politikasi ile belirlenir.
- `Reliability is product value`: Kaybolan event, geciken projection veya eski marker yalniz teknik sorun degil, yanlis yer karari uretebilen urun sorunudur.
- `Decision utility over engagement`: Ozellikler kullaniciyi daha uzun tutmak icin degil, karari kolaylastirmak icin vardir. **(2026-09-22: sinyal-mvp-plan kapsamindaki sosyal/kesfet/hikaye yuzeyleri icin bu ilke §2.3'teki kosullarla gevsetildi; cekirdek harita/sinyal/yer akisi icin degismez kaliyor.)**

### 2.2 Bilincli olarak yapilmayanlar

Blinkr su anda genel bir sosyal medya urunune donusturulmemelidir:

- Sonsuz ve eglence merkezli genel feed
- Kullanici tutma amacli story veya kisa video akisi
- Surekli kisi takibi veya canli konum izleme
- Genis ve gosterisli profil ekonomisi
- Reklami dogrulanmis yer sinyali gibi gosteren yuzeyler
- Mahremiyet veya guvenligi engagement icin zayiflatan mekanikler

Medya, yorum, begeni veya bildirim ancak yer karari dongusunu destekledigi olcude anlamlidir. Bunlar urunun merkezi degildir.

Bilincli urun karariyla eklenen istisnalar:

1. 1:1 DM/chat (bkz. 6.5): kullanici arama ile baslatilir, urunun ana giris ekrani degildir ve map-first kimligi degistirmez.
2. Arkadaslik (bkz. 6.1): kullanici talebiyle ("profil biraz sosyal olsun, arkadas ekleme olsun") eklendi. Bu, "kalici arkadas grafigi olusturmaz" ilkesini bilincli olarak gevsetir; risk su korumalarla sinirlidir ve bu korumalar degismez kuraldir:
   - Arkadaslik yalniz birbirini bulmak ve mesajlasmak icindir. Konum paylasmaz, canli konum izlemez, bir sinyalin kime gorunecegini degistirmez (`AnonymousMap` her durumda anonim kalir).
   - Baskasinin arkadas listesi, arkadas sayisi ve e-postasi hicbir yerde gosterilmez; herkese acik profil yalniz avatar, ad, kisa "hakkinda", katilim ayi ve herkese acik (anonim olmayan) sinyalleri gosterir.
   - Feed, "arkadaslarin ne yapiyor" akisi, takip/takipci, begeni-sayisi ekonomisi ve arkadas onerisi YOKTUR ve eklenmemelidir. Arkadaslar yalniz sohbet ve arama sonuclarinda one alinir. **(2026-09-22: bu satir §2.3'teki pivotla iliskili olarak yeniden degerlendirilmeli — sinyal-mvp-plan takip/takipci ve Kesfet akisini MVP'ye ekliyor. Mevcut "Arkadaslik" ozelligi (karsilikli onayli, kapali) ile planin "takip" modeli (tek yonlu, acik) farkli kavramlardir; hangisinin/ikisinin birlikte nasil yasayacagi Faz 6 P6.1'de netlestirilecek ve burada guncellenecek. O karara kadar bu satirin geri kalani gecerlidir: arkadaslik listesi/sayisi hala herkese acik degildir.)**
   - Kotuye kullanim siniri: ayni anda en fazla 50 bekleyen giden istek; reddedilen istek 7 gun boyunca ayni kisiden tekrar gonderilemez (reddeden kisi istedigi zaman isteyebilir; gonderene reddedildigi acikca soylenmez).
   - Guvenlik zorunludur: kullanici icerigi ve kisiler arasi temas olan her yuzeyde engelleme ve bildirme vardir (bkz. 6.1, 6.5). Engel iki yonludur, karsi tarafa bildirilmez ve mesajin kimin tarafindan engellendigini soylemez.
   - Bu ozellik cekirdek harita dongusunun onune gecemez; P0 dongusu bozuksa genisletilmez.

### 2.3 2026-09-22 pivot: sinyal-mvp-plan ile gevsetilen kurallar

Kullanici, `docs/sinyal-mvp-plan/` planinin **aynen** uygulanmasina ve mevcut backend mimarisinin
**korunmasina** (PostgreSQL+PostGIS'e gecis YOK) acikca karar verdi
(`docs/sinyal-mvp-plan/docs/plan/DECISIONS.md` D-002 ve D-001). Bu, yukaridaki §2.2 listesindeki asagidaki
maddeleri **MVP kapsaminda** bilincli olarak gevsetir:

- **"Sonsuz ve eglence merkezli genel feed"** → Kesfet akisi (Yakinimda/Takip, `02_INFORMATION_ARCHITECTURE.md`) artik MVP'nin bir parcasidir. Fark: bu feed rastgele eglence icin degil, place-first sinyallerden olusur (post'lar hala bir Place/koordinata bagli, hala TTL'li); "eglence merkezli" olmayan bu nitelik korunmalidir — feed'e sinyal disi, yer-bagimsiz "genel gonderi" turu eklenmemelidir.
- **"Kullanici tutma amacli story veya kisa video akisi"** → Hikayeler (`05_SCREENS_CREATE_FEED_STORIES.md`) artik MVP'nin bir parcasidir.
- **"Genis ve gosterisli profil ekonomisi"** → Instagram-tarzi profil izgarasi, takip/takipci sayaclari, rozet/seviye/guven puani (`06_SCREENS_PROFILE_SOCIAL_CHAT.md`) artik MVP'nin bir parcasidir.
- **"Surekli kisi takibi veya canli konum izleme"** → **KISMEN, dar bir istisnayla:** yalniz Faz 13 (V1.1, MVP DISI) "Arkadaş konumu (Ghost Mode)" icin — plan'in kendi tanimiyla varsayilan KAPALI, opt-in, sureli paylasim, yalniz arkadaslar. MVP'de (Faz 0-12) surekli/varsayilan-acik konum izleme YOKTUR ve bu turden bir ozellik en erken Faz 13'te, ayrica ele alinarak yapilir.

**Degismeyenler (bu pivotla degismedi, hala mutlak kural):**
- `Privacy by default`, `Trust is server-owned`, `Reliability is product value` (§2.1) aynen gecerli: yeni sosyal katman da kesin konum sizdirmaz, yakinlik/guven hesaplarini istemciye birakmaz.
- "Reklami dogrulanmis yer sinyali gibi gosteren yuzeyler" ve "Mahremiyet veya guvenligi engagement icin zayiflatan mekanikler" **hala YASAKTIR** — plan bunlari zaten istemiyor.
- Mimari: backend .NET mikroservisleri + EventStoreDB (authoritative) + MongoDB kaliyor (D-001). Plan'in Faz 2 backend gorevleri bu mimariye uyarlanarak yapilir, PostgreSQL+PostGIS'e tam gecis yapilmaz.
- Bu bolumdeki her genisleme, `docs/sinyal-mvp-plan/docs/plan/13_ROADMAP_PHASES.md`'deki faz sirasina gore, faz faz, her faz sonunda calisir durumda kod ile yapilir — tek seferde "hepsi" yazilmaz.

Ilerleyen fazlarda bu dosyanin (ozellikle §6 Bounded Context haritasi ve §11-13) yeni sosyal
context'leri (Feed/Discovery, Stories, Social Graph/Follow, genisletilmis Notifications, Moderation)
yansitacak sekilde **faz tamamlandikca** guncellenmesi gerekir; bu, sinyal-mvp-plan'in kendi "Bitti
tanimi" kuralidir (`00_START_HERE.md` §6: "README/CLAUDE gibi yasayan dokumanlar guncellendi").

## 3. Hedef Kullanici Problemi

Harita uygulamalari bir yerin nerede oldugunu ve statik bilgilerini gosterir; klasik sosyal medya ise cok fazla, baglamsiz ve hizla eskiyen icerik uretir. Blinkr bu iki alan arasindaki boslugu hedefler:

- Mekan acik gorunuyor ama gercekte yogun mu?
- Kafede masa var mi?
- Eczane veya isletmede sira ne durumda?
- Park, etkinlik veya kamusal alan su anda kullanilabilir mi?
- Bir yerde gecici kapanma, firsat veya olay var mi?
- Bu bilgi ne kadar yeni, kac kisi tarafindan destekleniyor ve kaynagi ne kadar guvenilir?

Beklenen urun sonucu, kullanicinin haritada bir alani acmasi, taze sinyalleri anlamasi ve gercek dunyada daha bilincli hareket etmesidir.

## 4. Cekirdek Urun Dongusu

Blinkr'in ilk gercek kabul testi ve tum mimarinin kalbi su zincirdir:

```text
Kullanici A giris yapar
  -> cihazdan taze ve yeterince dogru konum alir
  -> katalogdan bir Place secer veya yaklasik koordinat secimi yapar
  -> mobil arayuzden Signal/Post yayinlar
  -> Gateway istegi BlogService'e yollar
  -> BlogService kimlik, payload, medya ve yakinlik politikasini dogrular
  -> PostAggregate domain eventi uretir
  -> event EventStoreDB'ye kalici olarak yazilir
  -> checkpoint'li publisher event'i RabbitMQ'ya aktarir
  -> Projection Worker MongoDB post read modelini idempotent gunceller
  -> PlaceService, Place'e bagliysa PlaceSignal projection'ini gunceller
  -> Gateway bounds cevabi Place ve koordinat sinyallerini birlestirir
  -> Kullanici B ayni alanda yeni pini gorur
  -> pin detail dogru icerik, yer, tazelik ve guven bilgisini acar
```

Bu zincirin herhangi bir halkasi eksikse urun tamamlanmis sayilmaz. Yalniz API ile post olusturmak veya yalniz haritada statik marker gostermek yeterli kabul kaniti degildir.

## 5. Domain Dili

Kod, test, dokuman ve UI ayni dili kullanmalidir.

### Place

Gercek dunyadaki anlamli bir mekan veya kamusal alan. Ornek: kafe, park, eczane, cami, market, restoran, okul. Kalici kimligi, adi, kategorisi, koordinati, opsiyonel poligon geometrisi, adresi ve kaynak bilgisi vardir.

### Signal

Bir kullanicinin belirli bir Place veya yaklasik koordinat hakkinda yaptigi zaman duyarli gozlem. Signal, teknik olarak mevcut sistemde `PostAggregate` ve `PostCreatedEvent` uzerinden tasinir. Her post signal olmak zorunda olmasa da mobil cekirdek deneyim signal yayinlar.

Desteklenen sinyal tipleri:

- `GeneralObservation`: Genel guncel gozlem
- `Crowd`: Kalabaliklik/doluluk
- `Queue`: Sira veya bekleme
- `TemporaryStatus`: Gecici durum, acik/kapali veya erisim sorunu
- `Offer`: Zamana bagli firsat
- `Event`: Yerle baglantili etkinlik
- `NewOpening`: Yeni acilis

### Place Signal

Bir `PlaceId` ile yayinlanan ve PlaceService tarafinda yerin son durumuna katkida bulunan signal projection'idir.

### Coordinate Signal

Bir Place secmeden, yaklasik alan koordinatiyla yayinlanan sinyaldir. Haritada ayri pin olarak gorunur. Koordinat paylasimi sahte bir Place olusturmaz.

### Current Place State

Yerin aktif ve guvenilir sinyallerinden hesaplanan ozet durumdur. `SignalType`, `SignalValue`, `Freshness`, `Confidence`, `ConfidenceValue`, `ObservedAtUtc`, `ExpiresAtUtc` ve aktif sinyal sayisini tasir.

### Freshness

Bilginin zamansal degeri. Mevcut hesaplayici en yeni dogrulanmis sinyali `FRESH`, `RECENT`, `STALE` veya `NONE` olarak siniflandirir. Canli harita eski/sona ermis icerigi yeniymis gibi gostermemelidir.

### Publication Trust

Sunucunun yayin aninda hesapladigi guven seviyesi:

- `VERIFIED_LIVE`: Etkin mesafe en fazla 200 m. Canli yer durumuna katkida bulunabilir.
- `NEARBY_PLACE_POST`: Etkin mesafe 200-600 m. Yer hakkinda icerik olarak yayinlanabilir fakat canli durum toplamasini degistirmez.
- `OUT_OF_RANGE`: 600 m disinda Place'e yayin yapamaz.
- `UNVERIFIED`: Gerekli konum veya dogruluk kaniti yoktur.

### Discovery ve Trust ayrimi

Bir yeri gorebilmek veya secebilmek, o yerde oldugunu kanitlamak degildir.

- Discovery: Kullaniciya 1.5 km'ye kadar anlamli yerler gosterebilir.
- Selection: Kullanici listeden bir Place secebilir.
- Publication: Place'e post atabilme siniri sunucu tarafinda en fazla 600 m'dir.
- Realtime trust: Canli duruma katkida bulunma siniri en fazla 200 m'dir.

UI, uzaktaki Place'i gizleyerek bu ayrimi bozmaz. Secim gosterilir; yayin kurali ve nedeni acikca anlatilir.

### Coverage

Belirli bir bolgede yerel Place katalog verisinin yuklenmis olup olmadigini ifade eder. `not_loaded`, o cevrede hic yer olmadigi anlamina gelmez; Blinkr katalog kapsamasinin eksik oldugu anlamina gelir.

## 6. Bounded Context ve Capability Haritasi

### 6.1 Identity Context

Sorumluluklar:

- Kayit
- Giris
- Refresh token
- Kullanici kimligi ve roller
- JWT uretimi
- Profil: avatar (`AvatarCatalog`), kisa `Bio` (en fazla 160 karakter; bosluklar/satir sonlari sunucuda toparlanir)
- Arkadaslik: `Friendship` tablosu (cift basina tek satir, `UserAId < UserBId` ile normalize; durum `Pending|Accepted|Declined`), istek gonder/kabul/reddet/geri al, arkadasi cikar. Karsilikli istek otomatik kabuldur.
- Guvenlik: `UserBlock` (kim kimi engelledi; engel arkadasligi bitirir, arama ve profilde iki tarafi birbirinden gizler, arkadaslik istegini ve sohbeti durdurur; engellenen kisi bilgilendirilmez) ve `Report` (kullanici veya sinyal bildirimi: `spam|harassment|hate|nudity|violence|privacy|self_harm|wrong_info|other` (`inappropriate` eski istemciler icin hala kabul edilir), en fazla 300 karakter not, ayni hedef icin tek kayit, kisi basina gunde en fazla 20). Moderasyon (`IdentityService.Api/Moderation`): rapor agirligi (1 gunden genc hesap 0,5), acik raporlarin agirlikli toplami 3 olunca sinyal gizlenir (`PostModerationChangedIntegrationEvent`; worker dokumani `posts` -> `posts_moderated`, PlaceService `place_signals` -> `place_signals_moderated` tasir, boylece hicbir okuma yolu gizli sinyali gosteremez). Admin rolu `/api/admin/reports`, `/api/admin/reports/resolve`, `/api/admin/actions` kullanir (`scripts/moderation.ps1`, `scripts/make-admin.ps1`); her karar `ModerationActions` denetim izine yazilir. Yaptirimlar: `warn`, `restrict_24h` (erisim token'inda `posting_restricted_until`, sinyal/yorum/hikaye 403 `POSTING_RESTRICTED`), `suspend_7d`/`ban` (giris 403 `ACCOUNT_SUSPENDED`, yenileme 401).

Kod: `src/Services/IdentityService`

Canonical MVP JWT authority `IdentityService`tir. `IdentityServerService` solution'da bulunur ancak aktif yerel mobil akis icin canonical authority degildir. Yeni auth kodu iki authority olusturmamalidir.

### 6.2 Content and Signal Context

Sorumluluklar:

- Post/signal komutlari
- Event-sourced `PostAggregate`
- Medya yukleme sozlesmesi
- Place yakinlik/presence politikasi
- Post read API'leri
- Unified map response composition

Kod: `src/Services/BlogService`

BlogService yazma tarafinda EventStoreDB'yi authoritative store olarak kullanir. Mongo read model sorgularina ve PlaceService ile harita kompozisyonuna da ev sahipligi yapar.

### 6.3 Place Context

Sorumluluklar:

- Place katalog kayitlari
- OSM kaynak kimligi ve kategori normalizasyonu
- Nearby, search, bounds ve detail sorgulari
- Place'e bagli sinyal projection'i
- Current Place State hesaplama
- Coverage ve kontrollu provider refresh davranisi

Kod: `src/Services/PlaceService`

### 6.4 Projection Context

Sorumluluklar:

- RabbitMQ integration eventlerini tuketmek
- MongoDB read modelini guncellemek
- Eventleri consumer bazinda idempotent islemek
- Retry ve hata kuyrugu davranisi
- Redis cache invalidation

Kod: `src/Services/WorkerService/Blinkr.Projections.Worker`

### 6.5 Notification Context

Sorumluluklar:

- Device subscription/token
- Kullanici konum aboneligi
- Like/comment gibi eventlerden bildirim uretme
- Okunmamis sayisi ve read durumu
- 1:1 sohbet (DM): konusma baslatma/listeleme, mesaj gonderme/okuma, kullanici aramasi IdentityService `/api/users/search` uzerinden yapilir
- Snap (bir kez izlenip kaybolan foto/video): konusma icinde `kind: "snap"` mesajidir. Medya ozel diskte (`App_Data/snaps`, hicbir statik middleware sunmaz) tutulur; yalniz alici, `open` cagrisiyla durum `sent -> opened` gectikten sonra ve sunucunun zorladigi kisa izleme penceresi (sure + 30 sn; sureli olmayanlarda 3 dk) icinde `content` ile cekebilir. Acilis atomiktir (tek kazanan), ikinci acma 410 `SNAP_OPENED`, sure dolan 410 `SNAP_EXPIRED` (acilmayan snap 24 saatte biter), pencere bitince dosya hemen silinir (`SnapCleanupService` yedek supurucudur, hicbir istisnayi disari firlatmaz). Gonderen kendi snap'ini acamaz/cekemez, yabanci 403. Fotograflarin EXIF/APP segmentleri (konum dahil) saklanmadan once silinir; bayt imzasi bildirilen ture uymayan dosya 400. Acilmamis snap okunmamis sayilir, sohbeti acmak onu tuketmez (`MarkRead` snap'lere dokunmaz). Snap arkadas grafigi veya takip olusturmaz; seri (streak) ve arkadas konumu (Snap Map) bilincli olarak YOKTUR (anayasa 2.2). Hikayeler (sinyal-mvp-plan Faz 7, §2.3 pivotu) ayri bir ozelliktir: `/api/stories`, 24 saat, yalniz yazar ve onayli takipciler, konum yok; mobilde Kesfet ustunde `stories/StoryTray` + tam ekran `stories/StoryViewer` (segment cubuklari, dokun ileri/geri, basili tut duraklat, yana kaydirinca kup gecisle sonraki/onceki kisi (Hareketi Azalt: duz kayma), asagi kaydirinca kuculerek kapanir, sonraki kisi onceden yuklenir, gorulme, begeni kalbi, 6 hizli emoji ve yanit = DM, kendi hikayende goruntuleyenler (begenenler kalpli, ustte) ve silme).
- Engel denetimi: blok verisinin sahibi IdentityService'tir. Sohbet baslatma, mesaj ve snap gonderme oncesi `IBlockGuard` (Api: `IdentityBlockGuard`) kisinin kendi bearer token'i ile `GET /api/blocks/status/{userId}` sorar (paylasilan sir yoktur; `Services:IdentityBaseUrl`, varsayilan `http://localhost:5188`). Cevap alinamazsa sohbet KAPALI basarisiz olur (503 `CHAT_UNAVAILABLE`), engelli biri sessizce gecirilmez. Mevcut snap'i acmak/cekmek etkilenmez.

Kod: `src/Services/NotificationsService`

Bu context MVP harita dongusunun birincil bloklayicisi degildir. Cekirdek event ve map akisi bozukken notification genisletilmemelidir.

Chat v1 gercek zamanlilik icin WebSocket/SignalR kullanmaz; mobil istemci kisa aralikli (aktif konusma ekraninda ~4sn, liste ekraninda ~8sn) REST polling yapar. Bu bilincli bir MVP kapsam karari; sonsuz/agresif polling'e donusturulmemelidir.

### 6.6 Gateway Context

Sorumluluklar:

- Mobil istemcinin tek backend giris noktasi
- YARP ile servis route'larini yonlendirme
- LAN uzerinden fiziksel cihaz erisimi
- `/health`

Kod: `src/Gateway/ApiGateway`

Mobil istemci BlogService veya PlaceService'e dogrudan baglanmamalidir. `EXPO_PUBLIC_BLINKR_API_URL` yalniz Gateway adresini gostermelidir.

### 6.7 Mobile Experience Context

Sorumluluklar:

- Harita-first deneyim
- Auth oturumunun guvenli saklanmasi ve refresh
- Nearby Place secimi
- Dort adimli signal composer
- Medya secme/yukleme
- Harita katmanlari, cluster, marker ve detail sheet'leri
- Stale response, abort ve loading yasam dongusu

Kod: `src/Clients/Blinkr.Expo`

Aktif ve tek mobil istemci React Native + Expo'dur (`src/Clients/Blinkr.Expo`). Eski MAUI istemcisi (`Blinkr.Mobile`) repodan tamamen kaldirilmistir; yeniden eklenmemelidir.

### 6.8 Tooling and Catalog Import

Kod: `src/Tools/Blinkr.Tools.OsmPlaceImporter` ve `scripts/bootstrap-place-catalog.ps1`

OSM PBF dosyasindan anlamli POI'leri MongoDB `BlinkrPlaces` kataloguna idempotent bicimde aktarir. OSM `ExternalProvider` ve `ExternalId` kimlikleri korunur; yeniden import duplicate uretmemelidir.

## 7. Fiziksel Mimari

```text
Expo iOS / Android
        |
        | HTTP + JWT, LAN development
        v
API Gateway :5080
        |
        +--> IdentityService      :5188 --> PostgreSQL
        +--> BlogService          :5215 --> EventStoreDB + MongoDB + Redis + PostgreSQL
        |                                  |            |
        |                                  |            +--> read queries/cache
        |                                  +--> checkpointed publisher
        |                                                |
        |                                                v
        |                                            RabbitMQ
        |                                                |
        |                     +--------------------------+------------------+
        |                     v                                             v
        |             Projection Worker :8082                    PlaceService consumer
        |                     |                                             |
        |                     v                                             v
        |             Mongo post read model                     Mongo PlaceSignal
        |
        +--> PlaceService         :5225 --> Mongo Place catalog/state
        +--> NotificationsService :5290 --> Mongo + RabbitMQ
```

### 7.1 Yerel portlar

| Bilesen | Port | Rol |
| --- | ---: | --- |
| Gateway | 5080 | Mobil icin tek API girisi |
| IdentityService | 5188 | Register, login, refresh, JWT |
| BlogService | 5215 | Post/signal write-read, media, map composition |
| PlaceService | 5225 | Place katalog, nearby/search/detail/state |
| NotificationsService | 5290 | Bildirim ve subscription API |
| Projection Worker | 8082 | RabbitMQ -> Mongo projection health |
| PostgreSQL | 5432 | Identity ve destekleyici relational data |
| Redis | 6379 | Cache/rate limit altyapisi |
| RabbitMQ | 5672 | Integration event bus |
| RabbitMQ UI | 15672 | Yerel queue gozlemi |
| EventStoreDB | 2113 | Authoritative event stream |
| MongoDB | 27017 | Read models ve Place catalog |
| Mongo Express | 8081 | Yerel Mongo inceleme araci |
| Expo Metro | 8083 varsayilan | Fiziksel cihaz JS bundle server |

### 7.2 Veri sahipligi

- EventStoreDB: Post aggregate'in authoritative event gecmisi.
- MongoDB `BlinkrReadModel`: Sorgulanabilir post projection'lari ve processed message/inbox kayitlari.
- MongoDB `BlinkrPlaces`: Place katalogu, PlaceSignal projection'lari ve coverage kayitlari.
- PostgreSQL: Identity kullanicilari ve mevcut servislerin relational destek verileri.
- Redis: Kalici source of truth degildir; cache ve hizlandirma katmanidir.
- RabbitMQ: Kalici domain store degildir; servisler arasi event dagitimidir.
- Cihaz SecureStore: Mobil access/refresh token oturumu. Sunucu verisinin kaynagi degildir.

## 8. CQRS ve Event Sourcing

### 8.1 Write yolu

`PostsController` komutu MediatR handler'a yollar. Handler domain kurallarini ve Place proximity politikasini uygular, `PostAggregate` olusturur ve domain eventlerini EventStoreDB stream'ine yazar.

Authoritative write path EventStoreDB'dir. Yeni bir yazma akisi MongoDB'ye dogrudan yazarak EventStore'u atlamamalidir.

### 8.2 Event delivery

`EventStoreToRabbitMqPublisher` tum EventStore eventlerini checkpoint'ten devam ederek okur. Domain eventini integration event sozlesmesine cevirir, RabbitMQ'ya publish eder ve basarili publish sonrasinda checkpoint'i kaydeder.

Bu tasarimin semantigi pratikte `at-least-once` delivery'dir. Exactly-once iddiasi kullanma. Guvenilirlik su iki mekanizmanin birlikte calismasiyla saglanir:

- Producer/publisher: Kalici EventStore + Mongo checkpoint + retry/backoff
- Consumer: Stable event kimligi + idempotent upsert/inbox

Checkpoint event publish edilmeden ilerletilmemelidir. Consumer duplicate event gordugunde state'i ikinci kez bozmamalidir.

### 8.3 Integration eventleri

Ana sozlesmeler `src/BuildingBlocks/Shared.Events` altindadir:

- PostCreated
- PostContentUpdated
- PostDeleted
- PostLiked
- PostUnliked
- PostCommentAdded
- PostLocationAdded
- PostLocationUpdated
- PostLocationRemoved

`PostCreated` event'i author, konum, `PlaceId`, publication trust, signal semantigi, audience/privacy, expiration ve medya metadata'sini tasir. Bu sozlesmede breaking change yapmak worker, PlaceService ve notification consumer'larini birlikte etkiler.

### 8.4 Read yolu

Projection Worker eventleri MongoDB dokumanlarina donusturur. Read endpointleri aggregate'i EventStore'dan her istekte tekrar kurmak yerine Mongo projection'larini sorgular.

Bir write API 200/201 donse bile projection henuz gorunmeyebilir. UI ve testler event-driven eventual consistency'yi kisa ve kontrollu polling/retry ile ele almalidir; sonsuz polling veya request storm olusturmamalidir.

## 9. Place Katalog ve Discovery Mimarisi

### 9.1 Neden yerel katalog

Normal composer akisi dis OSM/Overpass servisine bagimli olmamalidir. Provider gecikmesi veya kesintisi kullanicinin yakindaki yer listesini saniyelerce kilitlememelidir. Ana hizli yol MongoDB'deki yerel `BlinkrPlaces` katalogudur.

### 9.2 Veri kaynagi

Kalici cozum Turkiye geneli OSM extract'idir:

```text
C:\osm\turkey-latest.osm.pbf
```

Import komutu:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-place-catalog.ps1 -PbfPath C:\osm\turkey-latest.osm.pbf
```

Katalog dosyasi git'e eklenmez. Import idempotent olmali, OSM external kimliklerini korumali ve kategori normalizasyonunu uygulamalidir.

### 9.3 Nearby kurallari

- `VERY_NEAR`: 0-200 m
- `NEAR`: 0-600 m; composer ana listesinde mesafeye gore en yakin en fazla 5 Place
- `EXTENDED`: 600-1500 m; `Daha fazla yer` bolumu
- Siralama birincil olarak geodesic kus ucusu mesafedir.
- Kategori veya isim kalitesi, cok daha uzaktaki bir yeri yakin yerin onune tasimamali.
- Yaya rota mesafesi kullanilmaz.
- GPS jitter'i icin 45 m altindaki ayni kaynak origin'ler esdeger kabul edilir.

### 9.4 Kategori normalizasyonu

UI'ya ham OSM tag'i veya yanlis genel kategori sizmamali. En az su anlamlar dogru korunmalidir:

- mosque / Muslim place of worship -> `Cami` veya `Ibadethane`
- leisure=park -> `Park`
- leisure=playground -> `Oyun alani`
- shop=supermarket -> `Market`
- amenity=pharmacy -> `Eczane`
- amenity=cafe -> `Kafe`
- amenity=restaurant -> `Restoran`
- amenity=school -> `Okul`
- Bilinmeyen deger -> `Diger`; bilinmeyen amenity otomatik `Magaza` olmamalidir.

### 9.5 Coverage semantigi

Yerel sonuc varsa hemen don. Coverage eskiyse kontrollu background refresh yapilabilir; mobil cevap provider'i beklememelidir.

Yerel sonuc yoksa ve synchronous provider fallback kapaliysa:

- 200 + bos dizi donulebilir.
- `X-Blinkr-Place-Coverage: not_loaded` header'i gercek durumu belirtir.
- UI, "bu cevrede yer yok" dememeli; "Blinkr yer katalogu bu bolgede hazir degil" demelidir.
- Coordinate fallback kullanilabilir kalmalidir.

Provider timeout veya failure basarili bos coverage olarak cache'lenmemelidir. Daha once import edilmis Place'ler provider kesintisinde kaybolmamalidir.

### 9.6 Yer arama (harita "Nereye gidiyorsun?")

Kullanici "yakinimdaki 1 km'deki Soulmate kafe" gibi bir sey yazdiginda bulunmalidir. Kurallar:

- Sunucu (`GET /api/places/search?q&lat&lon&radiusMeters&expand`): ad, kelime onekleri ve tek kelime birlestirmesi (`Soul Mate` = `Soulmate`) Turkce duyarsiz (`PlaceSearchText.Fold`) `SearchTokens` uzerinden eslesir; `PlaceSearchBackfillService` eski kayitlara arka planda token ekler ve asla exception firlatmaz (host'u durdurur). `expand=true`: yakinda 10'dan az sonuc varsa Turkiye geneli token aramasi ve sonuc yoksa 2 harfli onek ile yazim hatasi kurtarma eklenir. Ozel kategori kelimeleri (eczane, kafe, market, park, cami...) kategoriye eslenir.
- Istemci (`placeSearch.ts`): mesafe kisinin kendi konumundan hesaplanir (sunucudaki mesafe harita merkezindendir); harita baska bir sehre bakiyorsa (>25 km) iki merkez de aranir. Siralama once mesafe bandi (Yakininda <=3 km, Sehirde <=30 km, Diger sehirler), band icinde ad skoru, sonra mesafedir. Uzaktaki tam eslesme yakindaki kismi eslesmenin onune gecemez. Yazim hatasi: 5-7 harfte 1, 8+ harfte 2 duzenleme mesafesi.
- `test-place-search.ps1` (BLK-SEARCH-01) gercek katalogla bunu kanitlar; fixture testi yerine gecmez.

## 10. Yakinlik, Guven ve Mahremiyet

### 10.1 Sunucu tarafli proximity

Mobilin gonderdigi `proximityAllowed`, distance veya trust degeri yetki kaynagi degildir. BlogService su verilerle karari tekrar hesaplar:

- Place nokta koordinati veya gecerli Polygon/MultiPolygon geometrisi
- Observation latitude/longitude
- Observation accuracy
- Signal type

Kurallar:

- Maksimum kabul edilen cihaz dogrulugu 150 m.
- Guven hesabinda kullanilan accuracy allowance en fazla 50 m.
- `effectiveDistance = max(0, geometryDistance - cappedAccuracy)`.
- `effectiveDistance <= 200 m` ise `VERIFIED_LIVE`.
- `effectiveDistance <= 600 m` ise en az `NEARBY_PLACE_POST` ve yayin izinli.
- 600 m disinda Place'e yayin engellenir.
- Gecerli Place poligonu varsa centroid yerine poligon sinirina mesafe kullanilir.
- Gecersiz veya desteklenmeyen geometride nokta fallback kullanilir.

### 10.2 Canli state

`CurrentPlaceStateCalculator` yalniz `VERIFIED_LIVE` ve suresi dolmamis sinyalleri toplar. `NEARBY_PLACE_POST` place detail'de icerik olarak gorunebilir ancak kalabalik/sira gibi canli state'i degistiremez.

Kisi basina tek ses: hesaplayici ayni yazarin ayni sinyal turundeki yalnizca en yeni dogrulanmis sinyalini sayar (`PlaceSignalDocument.AuthorId`, yalniz sunucuda tutulur, API cevaplarinda yoktur). Ayni degeri tekrarlamak guveni sismirmez; "degisti" eski degeri gercekten yerine koyar. `ActiveSignalCount` bu nedenle katki yapan kisi sayisidir. Yazari bilinmeyen eski sinyaller ayri ses sayilir.

Confidence ve freshness, event sayisi ile birlikte zaman agirligi kullanilarak hesaplanir. Bu mekanizma ileride degisebilir ancak daha az guvenilir yayinlarin canli state'i zehirlememesi degismez kuraldir.

### 10.3 Privacy

- Public haritada kesin cihaz koordinatini gereksiz yere gostermeme.
- Place postunda kamusal konum olarak Place merkezi/geometrisi kullanma.
- Coordinate signal'da `ApproximateArea` semantigini koruma.
- `AnonymousMap` seciminde author adini public projection/detail'e sizdirmama.
- Loglarda raw koordinatlari, JWT'yi, refresh token'i veya kullanici sifresini yazmama.
- Konum iznini urunun zorunlu olmayan alanlarinda gereksiz istememe.
- Loglara koordinat yazilmaz; cerceve istek/HttpClient/YARP loglari Warning seviyesindedir (URL'deki `?lat=&lon=` yuzunden). `scripts/test-log-privacy.ps1` (BLK-LOGPRIV-01) bunu calisan servislerde denetler.
- Kullanici metni `Shared.Moderation.ContentTextFilter`'dan gecer: tehdit/nefret/hedefli hakaret 422 `CONTENT_BLOCKED`; herkese acik metinde (gonderi, yorum, hikaye, bio) gecerli TC kimlik no. ve plaka maskelenir, ozel sohbette maskelenmez; hafif kufur yayinlanir ama Kesfet'te geriye itilir ve `sensitive` isaretlenir. Telefon/adres yalniz uygulamada uyarilir (`textSafety.ts`).

## 11. Harita Davranisi

Mobil harita dort katmana sahiptir:

- `Tumu`: Taze Place activity ve coordinate signal'lar
- `Canli`: Dogrulanmis aktif state'i olan Place'ler
- `Yerler`: Aktif sinyali olmasa da katalog Place'leri; viewport basina sinirli
- `Sinyaller`: Place'e bagli olmayan coordinate signal'lar

Gateway unified endpoint:

```text
GET /api/map/bounds
```

`includeCatalogPlaces=true`, `Yerler` katmani icin aktif sinyali olmayan katalog Place'lerini de dahil eder. BlogService PlaceService `/bounds` ve post read modelini birlestirir. Katalog Place sayisi haritayi bogmamak icin viewport basina en fazla 80 ile sinirlanir.

Apple Maps veya Google Maps taban haritasindaki POI etiketleri Blinkr verisi degildir. Blinkr marker'i yalniz kendi Gateway cevabindan olusur.

Harita refresh hatasinda mevcut marker state'i bos diziyle ezilmemelidir. Stale-while-revalidate uygulanir: eski gecerli marker'lar kalir, kucuk hata/retry durumu gosterilir, loading her success/failure/abort/stale yolunda kapanir.

Viewport requestlerinde eski cevap yeni state'i ezmemelidir. Generation/request identity ile stale response korunmasi kullan. Anlamli viewport degismeden tekrar tekrar istek baslatma.

## 12. Mobil Uygulama Mimarisi

### 12.1 Ana ekranlar

- `App.tsx`: navigasyon kabugu. Kutuphanesiz `activeTab` (`chat | map | nearby | profile`); `MapScreen` her zaman monte kalir (viewport, katman ve marker'lar sekme degisince kaybolmaz), Sohbet, Yakinda ve Profil onun ustunde tam ekran katman olarak acilir. Tek alt bar `BlinkrBottomBar` (Harita | Kesfet | + | Sohbet | Profil; ortadaki "+" sekme degil eylemdir: dokunma kamerayi, basili tutma yalniz yazili sinyal composer'ini acar - sinyal-mvp-plan P5.1); sheet/composer/acik konusma/avatar secici varken bar gizlenir (native'de kardes zIndex sirasi yuzunden bar acik sheet'in ustune biner). Paylas ve "kayitli yeri ac" tek seferlik istektir (`shareRequested`/`focusPlace` + `on...Handled`), Android geri tusu sekmeyi haritaya dondurur.
- Paylasim: "+" dogrudan uygulama ici kamerayi acar (galeri dugmesi kameranin icindedir); basili tutmak medyasiz sinyal icin composer'i acar. Iki yol da ayni `SignalComposer`'a varir (yer, yakinlik ve sunucu guveni orada belirlenir). Eski `ShareHubSheet` kaldirildi; Snap Sohbet ekranindaki kamera dugmelerinden gonderilir.
- Uygulama ici kamera (`camera/SignalCamera`, `expo-camera`): tam ekran canli onizleme (Snapchat gibi kenardan kenara; onceki kutulanmis/kisa onizleme "kamera yarim aciliyor" hissi veriyordu), canli lensler (`cameraEffects.ts`: renk katmani + vignette), flas/cevirme, iki parmakla yakinlastirma (`zoomMultiplierLabel`; pill dokununca 1.0x'e sifirlanir), fotograf ve video (`photoOnly` prop'u video modunu tamamen kaldirir). `onCameraReady` bazi Android cihazlarda hic tetiklenmeyebilir; ~1.2 sn sonra deklanşör otomatik acilir (donuk kamera hissi vermesin diye), izin durumu cozulene kadar da bos ekran yerine yukleniyor gostergesi vardir. Fotograf `PhotoEditor`'da lens + cikartma ile `react-native-view-shot` ile dosyaya islenir; lenssiz/cikartmasiz fotograf oldugu gibi gecer. Video lenssiz kaydedilir (kayit sonradan islenemez) ve arayuz bunu soyler. Cikartmalar dekorasyondur, sinyal verisi degildir; sinyalin tur/degeri composer'da secilir ve sunucuda dogrulanir. Kamera eylemi yalniz dosya teslim eder (`onCapture`), yayin yolu degismez. Kamera ve Snap gonderme ekranlari `colors.flare` (sicak altin) vurgusunu kullanir; bu renk yalniz cekim akisina ozeldir, uygulamanin geri kalani sakin mint kimligini korur.
- `AuthScreen`: register/login
- `MapScreen`: harita state'i, layers, marker'lar, nearby ve composer orchestration. Ust krom `map/MapTopChrome` (header + `MapLayerBar` + tara/konum satiri), filtre mantigi `mapSelection.ts`.
- `SignalComposer` (plan-devam Faz D, D-019): tek sayfa, tam ekran. Medya, yer satiri (yakin yer cipleri; "Yer sec/Degistir" yer seciciyi ayri gorunumde acar: Yer ara / Yakinimdaki yerler / Haritadaki nokta / Bu konumda paylas), buyuk tur kareleri + seviye, tek aciklama (280, baslik alani yok), gorunurluk, "Nereye gonderilsin?" (Haritaya her zaman; Hikayem medya varsa, anonimde degil; Arkadaslar = snap, yalniz fotografla), sari Gonder. Gonder dosyayi yuklemez: `MapScreen` yer sinyalinde taze konumu alip paylasimi giden kutusuna (`shareOutbox.ts`, kurallar `shareQueue.ts`) yazar ve composer kapanir; yukleme/yayin arka planda, baglanti yoksa cihazda bekler, sunucu reddederse `map/ShareProgressChip` "Paylasilamadi" (tekrar dene/vazgec) gosterir. Kamera acikken (izin zaten varsa) konum alinir, `cameraPlace.ts` 100 m icindeki en yakin yeri cipte gosterir ve composer onunla baslar; hassas yerde tek seferlik uyari. Lensler kaydirmayla (`LensIndicator`), cikartmalar hafif egik. 2 saatten eski galeri medyasi kartta "Galeriden" (`fromGallery`, sunucu cekim zamanini saklamaz).
- `PlacePicker`: nearby ve extended Place secimi
- Sinyal Karti (plan-devam Faz C, D-018; sunum D-023): pine dokunmak `signal/SignalCardModal`'i acar (Snap Map yer karti gibi alttan yukselen, kenarlardan 10 pt icerde yuzen kart; harita bulaniklastirilmaz, `scrimSoft` ile hafif kararir; yer ve sayfa 1/3 kartin basliginda; acilis `springs.sheet` yayi, basliktan surukle-kapat, her kapanis once animasyonla cikar - UI thread'de tek `progress` degeri, PanResponder yok; kumeye dokunmak zoom < 16'da yakinlastirir, 16+'da kumedeki sinyalleri kart olarak acar). V2-2 (D-025): kart tam sayfaya buyur (basliktan yukari cek, yorum dugmesi ya da tek sinyalde "Tam sayfa ac"; asagi cek/Geri karta doner) ve tam sayfa `SignalThreadPanel` (`fill`) ile tum yorumlari ve sabit yorum kutusunu gosterir. Tum videolar `signal/VideoPlayer` (kartta sessiz dongu + ses, tam ekranda oynat/duraklat, surukle, hiz 0,5-2x). `blinkr://posts/{id}` baglantisi sinyali haritada acar (`deepLinks.ts`). Kart (`signal/SignalCard`): halka+avatar, "Konumda" (sunucu VERIFIED_LIVE), kalan sure, kirpilmayan medya (`MediaCarousel`; 9:16-4:5 arasi kendi orani, disi blur uzerine contain; cift dokunma begeni; dokunma `MediaViewer`), metin karti, yer satiri, HealthNotice, "Hala boyle mi?" (Evet tek dokunusla ayni deger/turde normal sinyal yayinlar, Degisti composer'i acar; 500 m disi/kendi sinyali/konum yok -> pasif), begeni/yorum/sohbette paylas/yeri kaydet, en yeni yorum, menu (bildir, engelle, kendi sinyalini sil). Gorulme >= 1 sn -> 10 sn'de bir `POST /api/posts/views`, sayiyi yalniz yazar gorur. Saf kurallar `signalCard.ts` (test). Yer sayfasi (`PostDetailSheet`) karttaki yer satirindan/seridinden acilir.
- `PostDetailSheet`: Place veya coordinate signal detayi (gercek medya seridi, sinyal sayisi/tazelik/guven/uzaklik, Kaydet/Paylas/Yol tarifi). Taze ve yapilandirilmis (Doluluk, Bekleme, Durum, Etkinlik, Firsat) canli durumu olan Place'te "Hala boyle mi?" sorusu (`recheckSignal`): "Evet" composer'i son adimda ayni degerle, "Degisti" sinyal adiminda ayni turle acar. Cevap ozel bir olay degil, normal sinyaldir; canli duruma katkisini yine sunucu kisinin gercek konumundan karar verir.
- `feed/DiscoverScreen` ("Kesfet" sekmesi, sinyal-mvp-plan Faz 7): Yakinimda (`GET /api/discover/nearby`, tazelik > yakinlik > log etkilesim, kisi basina sayfada en fazla 2, kaba mesafe, anonimde yazar yok), Takip (`GET /api/discover/following`, son 7 gun, anonim yok) ve Yerler (asagidaki `NearbyScreen`, `embedded`). `feed/FeedCard`: begeni yerinde (iyimser), yorumlar `SignalThreadPanel` sheet'inde, yazar profili `UserProfileSheet`, yere bagli sinyalde "Haritada goster". Sonsuz akis yok (en fazla 10 sayfa), yenileme hatasinda son liste kalir.
- `NearbyScreen` ("Yakinda" sekmesi): haritanin liste gorunumu. Cihaz konumunun 1,5 km cevresindeki taze ve suresi dolmamis Place durumlarini ve koordinat sinyallerini `GET /api/map/bounds` cevabindan `nearbyActivity.ts` ile siralar (once tazelik kovasi: son 15 dk / daha eski, sonra geodesic mesafe; en fazla 30 satir, sonsuz akis yok; katalog Place'i aktif durum olmadan listelenmez). Konum izni yalniz kisi butona basinca istenir; yenileme hatasinda son liste kalir. Satira basmak haritada Place/sinyal detayini acar (`focusPlace`/`focusSignal`). Canli rozeti yalniz sunucunun dogruladigi Place durumunda gorunur.
- `ProfileScreen`: hesap, kisa hakkinda (`EditProfileSheet`), gercek Sinyal/Takipci/Takip sayilari (dokununca `friends/FollowListSheet`), bekleyen takip istegi girisi, hesapta saklanan kayitli yerler (`savedPlaces.ts`: giris yapilmissa sunucu `/api/users/me/saved-places` dogrudur, cihazdaki eski kayitlar bir kez aktarilir, cihaz yalniz cevrimdisi onbellek tutar; anahtarlar userId ile ad alanina alinir), gizlilik notu, cikis. E-posta profilde gorunmez, yalniz Ayarlar > Hesap. Bekleyen arkadaslik istegi "Arkadaslar - N" dugmesinde ve alt cubukta Profil noktasinda gorunur.
- `friends/FriendsScreen` (Arkadaslarim | Istekler | Ekle; kullanici adiyla arama, kabul/reddet/geri al), `friends/UserProfileSheet` (herkese acik profil: bio, katilim ayi, son 5 herkese acik sinyal, iliski dugmesi, Mesaj gonder, arkadasliktan cikar icin iki adimli onay). Saf mantik `friends.ts` (bio siniri, iliskiye gore eylem, siralama), API cagrilari `friendActions.ts`. Sohbet "Yeni mesaj" ekrani once arkadaslari listeler ve aramada iliski etiketi gosterir.
- `SettingsScreen` (Profil ustundeki disli): hesap bilgisi, Verilerimi iste (`account/DataRequestView`), Hesabi sil (`account/DeleteAccountView`), Hakkinda altinda Topluluk kurallari / Kullanim sartlari / Gizlilik politikasi (`LegalDocView`, metinler `legalContent.ts`, taslak notlu), Engellenen kisiler (engeli kaldir), gizlilik ozeti, surum ve OpenStreetMap atfi (ODbL; yer verisi lisansi geregi), cikis. Yalniz gercek bilgi vardir; hicbir sey yapmayan anahtar yoktur. `ReportPanel`: sheet icinde rapor formu (sebep secimi, istege bagli not); profil ve sinyal detayi ayni sheet'te icerigi degistirir, ikinci bir sheet acmaz. Sohbette ust cubuktaki ad/avatar profili acar; oradan engellenen kisinin sohbeti listeden kalkar.
- Kaydedilen yerlerde canli durum (`savedLive.ts`, `GET /api/places/batch`): yalniz dogrulanmis ve taze (FRESH/RECENT) aktivite "Canli" satiri olarak gorunur, canli olanlar uste alinir; bayat durum yeni gibi gosterilmez, arama basarisiz olursa onceki durum korunur. `OnboardingScreen` (`onboardingContent.ts`): ilk giriste bir kez, kisi basina uc kart; konum izni burada istenmez. `ui/BlinkrSkeleton`: liste yuklenirken satir sekilli soluk isik (Sohbet, Yakinda, Arkadaslar, Profil); `haptics.ts` sessiz onay titresimleri (arkadas ekleme/kabul, engelleme, bildirim gonderme, profil kaydi).
- `chat/ChatListScreen`, `chat/ConversationScreen`, `chat/UserSearchSheet`: 1:1 sohbet, Snapchat duzeninde. Liste satiri durum cizgisi tasir (`snapPresentation.ts`): dolu kirmizi kare "Yeni Snap" (dokununca dogrudan izleyiciyi acar), dolu mavi kare "Yeni sohbet", ok "Gonderildi/Acildi", kontur "Acildi/Suresi doldu"; sagdaki kamera dugmesi o kisiye hizli Snap gonderir, uzun basma sohbeti acar. Konusma ekrani balonludur (plan-devam Faz E, D-020): benimkiler sagda marka tonunda, karsi taraf solda notr; ayni kisinin 5 dk icindeki mesajlari gruplanir (saat grubun sonunda), gunler arasinda Bugun/Dun/tarih ayiricisi, son giden mesajin altinda "Goruldu ss:dd", karsi taraf yazarken "yaziyor..." (yoklamayla: yazarken en fazla 3 sn'de bir `POST .../typing`, sunucu bellekte 6 sn tutar). Snap balonu durumunu gosterir, bekleyen snap dokunulabilir; paylasilan sinyal balonu Sinyal Karti'ni acar. Uzun basma: tepki, alintili yanit (`replyToId`; alinti geri alininca bosalir), kopyala, geri al (kendi), bildir (karsi taraf). Saf duzen `chatThread.ts`. `snap/SnapViewer`: tam ekran, sure ilerleme cubugu (resim yuklenince baslar), dokun-kapat, video sonuna kadar, Android'de ekran goruntusu engeli (`expo-screen-capture`; iOS engellenemez), sunucu 410 verirse sade mesaj. `snap/SnapFlow` + `SnapSendStep`: kamera (`photoOnly`, lens/cikartma) -> yazi + sure + alicilar -> her kisiye tek tek gonder, basarisiz olanlar secili kalir. Snap gonderimi yalniz fotografdir (video kaydetme secenegi Snap akisinda yoktur); sunucu tarafi ve alici gorunumu (SnapViewer) daha once gonderilmis video snap'leri hala oynatabilir, bu geriye donuk uyumluluktur, yeni video Snap uretilmez. Bu akis Sohbet ekranindaki kamera dugmelerinden acilir.
- Harita aramasi (`map/MapSearchOverlay`, `placeSearch.ts`): ust cubuk "Nereye gidiyorsun?" alanidir; tam ekran arama, yazmadan once kategori kisayollari + son aramalar + kayitli yerler, yazinca Turkce-duyarsiz siralanan sonuclar (ad eslesmesi > mesafe), canli rozeti, adres/bolge icin cihaz geocoder yedegi ("konumuna git"). Sonuca dokunmak haritayi ucurur ve detay sheet'ini acar.
- `Sheet`: uygulama ici ortak bottom sheet yapisi; gorunum kabugu `ui/BlinkrSheetPanel`
- `BlinkrMapMarker` (native sarmalayici) + `MapMarkerVisuals`, `PlaceSymbol`, `SignalSymbol`: semantik marker sunumu. Place = sivri uclu damla pin (uc, konumun kendisidir; `anchorOf` ile koordinata oturur), canli/dogrulanmis aktivitesi olan Place kategori renginde dolu, parlar ve ustunde NE oldugunu gosteren durum rozeti tasir; aktivitesiz katalog Place'i kucuk ve sessizdir. Koordinat sinyali = konusma balonu; etrafindaki halka sinyalin omru azaldikca kisalir (`lifetimeFraction`). Kume = koyu disk + lime halka + sayiyla buyuyen isi halesi. Geometri `markerGeometry.ts`'te test edilir; marker icinde animasyon yoktur (native marker bitmap'i).
- `Avatar`, `AvatarPickerSheet` (`avatars.ts`): avatar cizilmis karakterdir (renk 8 x yuz 6 x aksesuar 6 = 288, anahtar uc hane, ornegin `253`), yuklenen fotograf degildir; kimsenin yuzu saklanmaz. Sunucu (`IdentityService AvatarCatalog`) tam ayni kumeyi kabul eder, gecersiz anahtar 400 `INVALID_AVATAR`. Secmeyenlere kullanici kimliginden kararli bir varsayilan cizilir. Avatar yalnizca profil, sohbet ve baslikta gorunur; harita pinlerinde yazar avatari YOKTUR (mahremiyet: anonim paylasimlar kisiye baglanamaz, surekli kisi takibi yapilmaz).
- `ui/`: ortak tasarim bilesenleri (`BlinkrButton`, `BlinkrChip`, `BlinkrCard`, `BlinkrHeader`, `BlinkrEmptyState`, `BlinkrBottomBar`, `BlinkrSignalCard`, `BlinkrSheetPanel`)

Tasarim token'lari tek kaynaktan gelir: `src/theme.ts` (plan-devam Faz B, D-017; V2 D-024). Koyu tema varsayilandir (kayitli secim yoksa koyu; zemin #0E0F12, kart #17191D), acik tema tam desteklidir; marka gradyani `gradients.brand` (#FFC83D -> #FF6B6B -> #B06BFF) yalniz (+), gorulmemis hikaye halkasi (`ui/GradientRing`), `BlinkrButton variant="create"` ve secili sekme noktasinda; tek renk vurgu `primary` koyuda #FF6B6B, acikta #D43A48; alt cubuk etiketsiz (Instagram), Profil sekmesi avatar; Ayarlar > Gorunum: Sistem / Acik / Koyu. Ekranlar stillerini modul yuklenirken kurdugu icin tema, `index.ts`'in ilk importu `src/themeBoot.ts` ile ekranlar yuklenmeden secilir (`applyThemeMode` token tablolarini yerinde doldurur); tercih degisince uygulama yeniden yuklenir (`expo-updates` `reloadAsync`, gelistirmede dev-settings). Token adlari degismedi (`background`, `surface`, `text`, `textSecondary`, `primary`, `mint`, `ink` = vurgu dolgusu uzerindeki yazi, `onCreate` = gunes dolgusu uzerindeki yazi). Gorsel dil "yumusak renk + cesur form": sicak kagit zemin (#FCFBF8), beyaz kartlar, tek marka rengi adacayi (acikta #2E7A60, koyuda #7FCAA9), komur koyu zemin (saf siyah degil). Gunes sarisi (`flare` #FFC83D) yalniz (+) ve gonder eylemlerinde. Sinyal tipleri tint (dolgu) + ink (yazi/ikon) ciftidir (`signalTints`/`signalInks`; `signalColors` acikta ink, koyuda tint). Kamera/fotograf/video ustundeki krom (kamera, duzenleyici, snap ve hikaye goruntuleyici) her iki temada sabit koyu paleti (`mediaColors`) ve `media` ortu token'larini kullanir. Tipografi: basliklar, rakamlar ve butonlar Outfit (Turkce glifleri font cmap'inde dogrulandi), govde sistem fontu; olcek display 34/40, headline(title1) 24/30, title(title2) 19/25, heading 16/21, body 15/21, callout 14/19, caption 12/16, micro 11/13; BUYUK HARF etiket yoktur. Yaricap 10/16/24/32, buton 40/48/56. Hareket: varsayilan yay hafif tasar (`bouncy`), ciddi baglamlarda `gentle`, basma olcegi 0.96, sheet'ler tasmasiz; "Hareketi Azalt" acikken `ReduceMotion.System`. UI dosyalarinda ham hex/rgba yoktur (avatar ve lens cizimleri sanat sabiti). Harita: acikta sakin kagit stili, koyuda komur (`mapDarkStyle.ts`, iOS `userInterfaceStyle`); pinler tint dolgu + ink ikon + 2px `pinBorder` + yumusak golge, secili pin beyaz hale ve 1.2x. `npm run test:theme` iki temada kontrasti (WCAG AA) ve olcek/hareket kurallarini denetler. Tarayici onizlemesi `?theme=dark` ile koyu temayi cizer ve Outfit'i gercek dosyadan yukler. Sheet icindeki liste ogelerine `entering` animasyonu verme (react-native-web'de sheet kapanirken `removeChild` hatasi uretir).

Dil (plan-devam Faz G, D-022): kullanici metni `tx('ns:anahtar', 'Turkce kaynak')` ile (`src/i18n/tx.ts`), anahtarlar `src/i18n/locales/{tr,en}`; i18n acilista temadan hemen sonra baslar (`src/i18n/boot.ts`), Ayarlar > Dil secimi uygulamayi yeniden yukler. Tarih/saat/sayi `i18n/locale.ts` ile uygulama dilinde. Yeni metin koda yazilmaz: `npm run test:i18n` anahtar esitligini ve `scripts/i18n-scan.cjs` ile koddaki metni denetler. Analitik `analytics.ts` (`track`; sema disi alan atilir, konum/e-posta/metin gonderilmez), riza Ayarlar > Gizlilik (varsayilan kapali), saglayici bagli degil. Harita pinlerinin ekran okuyucu etiketi `markerA11y.ts`.

Yumusak premium gorunum (D-023): yuzeyler cizgiyle degil ton ve yumusak golgeyle ayrilir (`colors.border` neredeyse gorunmez kil cizgi; yuzen yuzeyler `shadowFloat`, kartlar `shadowSoft`); cipler, arama, alt cubuk ve segment kontrolu hap bicimindedir; harita pinleri beyaz cizgili + golgeli, kumeler dolu marka diski; secili katman koyu hap. Yeni ekranda cizgili kutu yerine bu dili kullan.

Tasarim referansi: `docs/blinkr_tema_kod`. Tasarim gorsellerindeki puan, "N kisi burada", rozet, kaydetme sayisi gibi ogeler ornek veridir; backend'de karsiligi olmadan uretim ekranina eklenmez.

Tarayicida gorsel inceleme: `node scripts/ui-shot.cjs <sahne> [genislik] [yukseklik] [sorgu]` (sahneler `scripts/ui-scenes.tsx`); ciktilar `.tmp/product-ui/`.

### 12.2 Composer (tek sayfa)

Yer (onceden secili, degistirilebilir) -> tur ve opsiyonel yapilandirilmis deger -> aciklama ve medya -> kimlik gorunurlugu -> gonder hedefleri -> Gonder. Yayin sunucu tarafinda giden kutusu uzerinden, arka planda yapilir.

Yayin butonu gecersiz konum, devam eden medya islemi, proximity engeli veya aktif submit sirasinda tekrar tetiklenmemelidir.

### 12.3 Nearby request ownership

Nearby DEVICE discovery tek bir sahibi olan request lifecycle kullanir:

- Composer acilisinda bir taze cihaz konumu snapshot'i al.
- `locationAgeMs`, render, loading state, result state veya GPS object identity refetch nedeni degildir.
- Ayni etkin origin icin inflight request yeniden kullanilir.
- Yeni request yalniz composer reopen, manuel refresh, source degisimi veya anlamli hareket ile baslar.
- DEVICE -> MAP_CENTER gibi gercek supersession eski requesti abort/stale-discard eder.
- Stale response yeni sonucu ezemez.
- Composer kapaninca request ve loading temizlenir.

Bu lifecycle'i yeniden tasarlamadan once `src/nearbyRequestOwnership.ts` ve testlerini oku.

### 12.4 Native interaction guvenligi

Map marker onPress, sheet acma/kapama, backdrop ve Pressable overlay ayni touch event icinde kontrolsuz mount/unmount edilmemelidir. Invisible overlay `pointerEvents` ile haritayi kilitlememelidir. iOS'taki `Ended a touch event which was not counted in trackedTouchCount` uyarisi bastirilacak bir log degil, interaction lifecycle hatasi sinyalidir.

Modal/sheet degisikliginde:

- Tek overlay sahibi olsun.
- Backdrop kapaninca unmount ve pointerEvents state'i birlikte bitsin.
- Marker press sirasinda state zincirini minimumda tut.
- Place ve signal detail ayni sheet davranis kurallarini izlesin.
- Fiziksel iPhone'da tekrarli ac/kapat testi yap.

## 13. API Yuzeyi

Mobil istemci Gateway uzerinden asagidaki ana route'lari kullanir.

### Identity

- `POST /api/auth/register` (`birthYear` zorunlu, plan-devam F5: 13 alti 400 `AGE_TOO_YOUNG`, yoksa 400 `BIRTH_YEAR_REQUIRED`; 18 alti gizli hesapla baslar ve yalniz arkadaslariyla mesajlasir. Gelistirmede yalniz `e2e_` test hesaplari yilsiz kayit olabilir)
- `POST /api/users/me/deletion` (`{ password }`; 30 gun sonra silinir, tum oturumlar biter; 400 `WRONG_PASSWORD`), `DELETE /api/users/me/deletion` (vazgec). Giris/yenileme/`me` cevaplari `deletionScheduledForUtc` tasir.
- `POST /api/users/me/data-requests` (30 gunde bir; tekrar ayni talebi doner), `GET /api/users/me/data-requests` (`{ latest }`)
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/users/...`
- `PUT /api/users/me/profile` (`{ bio }`; 160 karakter ustu 400 `BIO_TOO_LONG`; bos deger temizler)
- `GET /api/users/me` (kendi e-postan, `bio`, `friendCount`, `incomingRequestCount`); `GET /api/users/{id}` herkese acik profil (`bio`, `joinedAtUtc`, `relation`; e-posta, arkadas listesi ve sayisi YOK); `GET /api/users/search` her sonucta `relation` (`none|self|friends|incoming|outgoing`) tasir
- `PUT /api/users/me/avatar` (`{ avatarKey }`, katalog disi anahtar 400 `INVALID_AVATAR`; `null` varsayilana doner). Login/register/refresh cevaplari, `GET /api/users/{id}` ve arama `avatarKey` tasir.

### Posts and signals

- `POST /api/posts`
- `GET /api/posts/{id}`
- `PUT /api/posts/{id}`
- `DELETE /api/posts/{id}`
- `POST /api/posts/{id}/comments` (`{ commentText, parentCommentId? }`; yanit tek seviyedir; 400 `COMMENT_EMPTY`/`COMMENT_TOO_LONG` (500), 404 `NOT_FOUND`)
- `GET /api/posts/{id}/comments?page&pageSize&sort=newest|oldest` (ust seviye yorumlar + yanitlari; `Cache-Control: private, no-store`; AnonymousMap gonderide yazarin kendi yorumu `authorId` tasimaz, "Paylasan" olarak gorunur)
- `DELETE /api/posts/{id}/comments/{commentId}` (yorumun veya gonderinin sahibi; yanitlar da silinir; 403 `COMMENT_FORBIDDEN`)
- `POST /api/posts/{id}/likes` (toggle, `{ liked }` doner; kendi gonderisi 400 `CANNOT_LIKE_OWN`); `GET /api/posts/{id}` `isLikedByCurrentUser` tasir
- `GET /api/posts-read/bounds`
- `GET /api/posts-read/nearby`
- `GET /api/posts-read/author/{id}?page&pageSize` (sayfa numarasi en fazla 1000; `X-Total-Count`): yazarin paylasimlari. Anonim (`AnonymousMap`) paylasimlar yalnizca yazarin kendisine doner ve o yanit `Cache-Control: private, no-store`'dur; baskalarina, giris yapmamislara ve herkese acik `?authorId=` listesine asla donmez (anayasa 10.3).
- `POST /api/posts/place-presence`

### Map

- `GET /api/map/bounds`
- `GET /api/map/nearby`

### Places

- `GET /api/places/{id}`
- `GET /api/places/{id}/signals`
- `GET /api/places/nearby`
- `GET /api/places/search?q&lat&lon&radiusMeters` (varsayilan 1,5 km = composer; harita aramasi 30 km'ye kadar ister; gunluk kelimeler kategoriye eslenir: eczane, hastane, kafe, market, akaryakit, firin, mUze...; ad, kategori ve adrese bakar)
- `GET /api/places/bounds`
- `GET /api/places/batch?ids=a,b,c` (en fazla 20 id; bilinmeyen/gecersiz id sessizce atlanir; cevap her yer icin `currentState` tasir; kaydedilen yerlerin canli durumu icin)
- `POST /api/places` yetkili write

### Media

- `POST /api/v1/media/presign`
- `PUT /api/v1/media/uploads/{mediaId}/content`
- `GET /api/v1/media/uploads/{mediaId}`
- `GET /api/v1/media/public/{mediaId}`

### Notifications

- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `POST /api/notifications/read`
- `POST /api/subscriptions`
- `POST /api/subscriptions/location`

### Friends

- `GET /api/friends` (arkadaslarim), `GET /api/friends/requests` (`{ incoming, outgoing }`)
- `POST /api/friends/requests` (`{ userId }`; karsi taraf zaten istediyse kabul eder; 400 `SELF`, 404 `USER_NOT_FOUND`, 403 `REQUEST_NOT_ALLOWED` (reddedildikten sonra 7 gun), 429 `TOO_MANY_REQUESTS` (50 bekleyen))
- `POST /api/friends/requests/{userId}/accept` ve `/decline` (yalniz istegin alicisi; 404 `REQUEST_NOT_FOUND`), `DELETE /api/friends/requests/{userId}` (gonderen geri alir), `DELETE /api/friends/{userId}` (iki taraf da bitirebilir; 404 `NOT_FRIENDS`)
- Her eylem `{ userId, relation }` doner. Gateway: `/api/friends/{**catch-all}` IdentityService'e gider.

### Follows (sinyal-mvp-plan Faz 6, D-009)

- `POST /api/follows/{userId}` (acik hesapta `{ follow: "following" }`, gizli hesapta `"requested"`; 400 `SELF`, 403 `FOLLOW_NOT_ALLOWED` (engel), 429 `TOO_MANY_REQUESTS`/`TOO_MANY_FOLLOWS`), `DELETE /api/follows/{userId}` (takibi birak / istegi geri al)
- `GET /api/follows/requests`, `POST /api/follows/requests/{userId}/accept|decline`, `DELETE /api/follows/followers/{userId}` (takipciyi cikar; bildirilmez)
- `GET /api/users/{id}/followers|following?page&pageSize` (gizli hesapta yalniz onayli takipciye; aksi 403 `PRIVATE_ACCOUNT`), `PUT /api/users/me/privacy` (`{ isPrivate }`; aciga donmek bekleyen istekleri onaylar), `GET /api/follows/visibility/{id}` (`{ canSee }`, BlogService sorar)
- `GET /api/users/{id}` artik `followerCount`, `followingCount`, `follow`, `followsYou`, `isPrivate`, `canSeeContent` tasir; `GET /api/users/me` `followerCount`, `followingCount`, `followRequestCount`, `isPrivate`. `GET /api/posts-read/author/{id}` gizli hesapta takipci olmayana 403 `PRIVATE_ACCOUNT`, kimlik servisine ulasamazsa 503 `PROFILE_UNAVAILABLE`. Takip konum paylasmaz ve haritada kimin neyi gorecegini degistirmez; arkadaslik (sohbet/snap) ayri kalir.

### Stories (sinyal-mvp-plan Faz 7)

- `POST /api/stories?durationSeconds&caption` (govde ham medya; foto 3/5/10 sn, video 0; 24 saat yasar; EXIF silinir; 400 `INVALID_DURATION`/`MEDIA_MISMATCH`/`UNSUPPORTED_MEDIA`/`MEDIA_SIZE`, 429 `TOO_MANY_STORIES`), `GET /api/stories/tray`, `GET /api/stories/users/{id}` (yazar ve onayli takipciler; aksi 403 `STORY_FORBIDDEN`), `GET /api/stories/{id}/content` (`no-store`), `POST /api/stories/{id}/seen`, `GET /api/stories/{id}/viewers` (yalniz yazar), `DELETE /api/stories/{id}`, `POST/DELETE /api/stories/{id}/like` (V2-3, D-026: idempotent; kendi hikayen 400 `SELF`; ilk begeni gorulme sayilir ve yazara bir kez `StoryLiked` bildirimi; `likeCount` yalniz yazara, izleyen `likedByMe` gorur; `viewers` cevabinda `liked`, begenenler ustte). NotificationsService, snap diskini paylasir; takip/engel bilgisini IdentityService `GET /api/follows/graph`ten kisinin kendi token'i ile sorar, cevap alamazsa 503 `STORIES_UNAVAILABLE`. Hikayede konum yoktur; anonim sinyal hikayeye gonderilmez.

### Saved places (P6.8)

- `GET /api/users/me/saved-places` (yeniden eskiye), `PUT /api/users/me/saved-places/{placeId}` (`{ name, category, latitude, longitude }`, idempotent; 400 `INVALID_PLACE`, 429 `SAVED_LIMIT` (100)), `DELETE /api/users/me/saved-places/{placeId}`, `POST /api/users/me/saved-places/import` (`{ items }`, cihazdaki eski kayitlar; yeni olanlar eklenir, birlesik liste doner). Yalniz hesabin sahibi okur; kimsenin kayitli yerleri baskasina gosterilmez.

### Safety

- `GET /api/blocks` (engelledigim kisiler), `POST /api/blocks` (`{ userId }`, idempotent; arkadasligi bitirir; `{ userId, relation: "blocked" }`), `DELETE /api/blocks/{userId}` (arkadaslik geri gelmez), `GET /api/blocks/status/{userId}` (`{ blocked }`, iki yonlu; sohbet servisi sorar)
- Engel etkileri: arama sonucunda ve `GET /api/users/{id}` ile iki taraf birbirini goremez (engellenen icin 404; engelleyen icin `relation: "blocked"` ve bos profil); arkadaslik istegi 403 `REQUEST_NOT_ALLOWED`; sohbet/mesaj/snap 403 `CHAT_FORBIDDEN`.
- `POST /api/reports` (`{ targetType: user|signal, targetId, reason: spam|harassment|hate|nudity|violence|privacy|self_harm|wrong_info|other, note? }`; ayni hedef tekrar bildirilirse 200; 400 `INVALID_REPORT`/`NOTE_TOO_LONG`/`SELF`, 404 `USER_NOT_FOUND`, 429 `TOO_MANY_REPORTS`). Gateway: `/api/blocks/**` ve `/api/reports/**` IdentityService'e gider.

### Chat

- `GET /api/users/search?q=`
- `GET /api/chat/conversations` (her ogede `unreadCount`: karsi tarafin okunmamis mesajlari)
- `POST /api/chat/conversations`
- `GET /api/chat/conversations/{id}/messages`
- `POST /api/chat/conversations/{id}/messages`
- `POST /api/chat/conversations/{id}/read`
- `POST /api/chat/conversations/{id}/typing` ("yaziyor"; saklanmaz, 6 sn; mesaj listesi yaniti `otherTyping` tasir). Mesajlar kendi mesajimda `seen`/`seenAtUtc`, yanitta `replyTo { messageId, senderId, text, kind }` tasir.
- `POST /api/chat/conversations/{id}/snaps?durationSeconds=&caption=` (govde ham medya, `Content-Type` = medya turu; foto 3/5/10 sn, video 0 = sonuna kadar; en fazla 41 MB)
- `POST /api/chat/conversations/{id}/messages/{messageId}/open` (alici; 200 `{ contentUrl, mediaType, durationSeconds, caption, viewUntilUtc }`, 410 `SNAP_OPENED`/`SNAP_EXPIRED`)
- `GET /api/chat/snaps/{messageId}/content` (yalniz alici, yalniz pencere icinde, `Cache-Control: no-store`)
- `POST /api/chat/conversations/{id}/messages` ayrica `{ clientId? , signal? }` alir: ayni `clientId` ikinci mesaj uretmez; `signal: { postId, signalType, signalValue?, title?, locationName? }` `kind: "signal"` mesaji olusturur (yazar bilgisi tasimaz). `DELETE /api/chat/conversations/{id}/messages/{messageId}` gonderen geri alir (`kind: "unsent"`, icerik iki taraftan silinir; snap geri alinamaz). `PUT .../messages/{messageId}/reaction` (`{ emoji }`, sabit set ❤️😂😮😢👍🔥, kisi basi bir, null temizler).
- Konusma ogeleri `lastMessageKind`, `lastMessageState` (`sent|opened|expired`), `lastMessageId` tasir; mesajlar `kind` ve `snap` (medya veya depolama anahtari asla) tasir.

API contract degisikligi yaparken mobil type'lari, Gateway route'larini, integration event consumer'larini ve smoke testlerini birlikte kontrol et.

## 14. Authentication ve Authorization

IdentityService, HS256 access token uretir. Canonical degerler:

- Issuer: `Blinkr.Identity`
- Audience: `blinkr.api`
- Clock skew: 60 saniye
- Canonical user id claim ve role claim `Shared/Auth` sozlesmesiyle servislerde ayni olmali.

Identity, Blog, Place ve Notifications ayni issuer, audience ve signing key modelini kullanmalidir. Signing key kaynak koda veya bu belgeye yazilmaz; environment/config secret olarak kalir.

Mobil:

- Tokenlari Expo SecureStore'da saklar.
- 401 halinde kontrollu refresh dener.
- Refresh basarisizsa oturumu temizler ve login'e doner.
- Expired token ile sonsuz retry yapmaz.

Gateway su anda reverse proxy'dir; token dogrulamasi downstream servislerde yapilir. Yeni endpointte `[AllowAnonymous]` veya authorization policy secimi bilincli olmalidir.

## 15. Media

Mobil medya akisi metadata-first sozlesmeyi izler:

1. Presign/upload kaydi al.
2. Binary content'i upload endpointine gonder.
3. Hazir media kimligini post payload'ina ekle.
4. Event ve projection medya metadata'sini korur.

Mevcut limit post basina en fazla 4 medyadir. Dosya turu, boyut, content type, boyutlar, sure ve thumbnail bilgisi desteklenir. UI ham storage hatasini veya stack trace'i kullaniciya gostermemelidir.

Medya basarisizken postun yarim ve yaniltici sekilde yayinlanmasina izin verme. Retry, cleanup ve orphan upload davranisini goz onunde bulundur.

## 16. Dayaniklilik Kurallari

- Harita veya nearby refresh hatasinda onceki gecerli state'i koru.
- Tum loading flag'leri success, timeout, abort, stale ve exception yolunda settle et.
- External provider failure'i basarili bos coverage olarak kaydetme.
- Duplicate event projection'i iki kez uygulama.
- RabbitMQ retry sonunda hata queue'sunu gorunur tut; mesaji sessizce yutma.
- EventStore write basarili, publish basarisizsa checkpoint ilerletme; publisher yeniden denesin.
- Cache source of truth olmasin.
- HTTP timeoutlari rastgele topluca buyutme; gercek gecikme katmanini olc.
- Kullaniciya raw exception veya stack trace gosterme; detay server logunda, sade mesaj UI'da kalsin.
- Tam koordinat veya token gibi hassas verileri loglama.

## 17. Gozlemlenebilirlik

Kritik loglarda mumkun oldugunca su kimlikleri kullan:

- CorrelationId
- EventId
- PostId
- PlaceId
- Consumer adi
- Request generation/id
- Source ve reason
- Sureler, sonuc durumu ve sayilar

Nearby mobil tanilari koordinat yazmadan su semantigi korur:

```text
[Blinkr NearbyRequest] id reason source accuracyMeters
[Blinkr NearbyResult] id status primary extended nearestMeters
```

Place discovery logu:

```text
[Blinkr PlaceDiscovery] localMs providerMs totalMs source status
```

Uretim icin izlenmesi gereken metrikler:

- Event publish hata ve retry sayisi
- Consumer lag ve error queue boyutu
- Projection gecikmesi
- Nearby ve bounds latency/error orani
- Provider timeout orani
- Coverage eksik bolge orani
- Mongo geospatial query suresi
- Cache hit/miss
- Auth refresh basari orani
- Media upload basari ve orphan orani

## 18. Yerel Gelistirme

### 18.1 Gereksinimler

- Windows + PowerShell
- Docker Desktop, Linux containers
- .NET 8 SDK
- Node.js 22.13 veya daha yeni
- Expo SDK ile uyumlu Expo Go ya da development build
- Fiziksel cihaz ve bilgisayar ayni Wi-Fi/LAN'da
- Repository root'ta yerel `.env`

### 18.2 Canonical backend baslatma

Repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-blinkr-dev.ps1
```

Bu script Docker altyapisini ve su uygulamalari baslatir: Identity, Blog, Place, Notifications ve Gateway. Servis health'lerini ve Gateway downstream route'larini kontrol etmeden `READY` dememelidir.

Durum:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\status-blinkr-dev.ps1
```

Kapatma:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-blinkr-dev.ps1
```

Docker altyapisini da durdurmak icin `-Infrastructure` kullan; volume'lari silme.

### 18.3 Canonical Expo baslatma

```powershell
cd .\src\Clients\Blinkr.Expo
npm install
npm run start:lan
```

Launcher uygun LAN IPv4 adresini bulur, API'yi `http://<LAN-IP>:5080` olarak ayarlar ve Metro'yu 8083 civarinda acar. Fiziksel cihaz bu adrese erisebilmelidir.

Dogru mental model:

- `npx expo start` Metro'yu baslatir.
- LAN ayari Expo'nun alternatifi degildir; fiziksel telefonun bilgisayardaki Metro ve Gateway'e ulasabilmesi icin gereken network modudur.
- `localhost` telefonda bilgisayari degil telefonu ifade eder.
- Mobil API adresi Gateway'dir, Blog API degildir.

## 19. Test Stratejisi

### 19.1 Hizli statik kontroller

```powershell
dotnet build Blinkr.sln
cd src\Clients\Blinkr.Expo
npm run typecheck
npm run test:theme
npm run test:nearby
npm run test:product
npm run test:ui
```

`test:ui` tarayicida (react-native-web) render eder; `MapScreen`, `App` ve react-native-maps'i kapsamaz. Onlarin derlendigini `npx expo export --platform ios` (ve `android`) ile dogrula.

### 19.2 Canonical backend kabul runner'i

Backend ayaktayken:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-product-08.ps1
```

Ilgili hedefli kontroller:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-auth-gateway-smoke.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\test-reliable-event-delivery.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\test-nearby-distance-contract.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\test-nearby-place-ux-core.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\test-location-map-core.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\test-place-live-signal.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\test-place-search.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\test-friends.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\test-safety.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\test-place-batch.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\test-content-media-smoke.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\test-place-catalog-coverage.ps1 -Strict
```

Gateway kapaliyken Gateway integration testi `PASS` raporlanamaz. Fixture-only test gercek katalog kabulunun yerine gecmez.

### 19.3 Fiziksel iki cihaz kabul testi

Otomasyon native GPS, iOS touch, kamera, video playback ve gercek LAN davranisini kanitlamaz. Release adayinda iki fiziksel cihazla:

1. Iki ayri kullanici giris yapar.
2. A cihazinda taze ve dogru DEVICE location alinir.
3. Gercek yakindaki Place listesi bir kez yuklenir ve settle olur.
4. A, mobil UI'dan Place veya coordinate signal yayinlar.
5. EventStore event, RabbitMQ publish, worker consume, Mongo projection ve PlaceSignal kanitlanir.
6. B ayni bounds icinde dogru pini gorur ve detail'i acar.
7. Place adi, kategori, konum, icerik, medya, freshness ve trust dogrudur.
8. App restart, pan-away/back ve kisa Wi-Fi kesintisi sonrasinda state geri gelir.
9. Place/signal detail tekrar tekrar acilip kapanir; touch kilitlenmez.
10. PostId ve iki cihaz ekran/video kaniti kaydedilir.

Fiziksel cihaz kaniti olmadan native acceptance tamamlandi veya release hazir denmemelidir.

## 20. Mevcut Durum

Repository snapshot'inda su alanlar buyuk olcude uygulanmistir:

- Expo tabanli map-first istemci
- Kayit, giris, refresh ve SecureStore oturumu
- Gateway uzerinden servis erisimi
- EventStoreDB tabanli PostAggregate write modeli
- Checkpoint'li EventStore -> RabbitMQ publisher
- Idempotent Mongo projection worker
- Place katalog, nearby/search/bounds/detail API'leri
- OSM PBF importer ve kategori normalizasyonu
- Place/coordinate signal ayrimi
- Server-owned proximity ve publication trust
- Current Place State ve freshness/confidence
- Medya upload ve detail sunumu
- Harita katmanlari, semantic marker'lar ve cluster
- Nearby request ownership ve stale-response korumasi
- Tek komut yerel backend orchestration
- Contract, smoke, mobile logic ve browser component testleri

Ancak `uygulandi` ile `uretimde tam dogrulandi` ayni sey degildir. `docs/BLK-PRODUCT-08.md` son otomasyon kanitini ve kalan fiziksel testleri listeler.

### 20.1 Bilinen acik alanlar

- Iki fiziksel cihazla son native acceptance her degisiklikten sonra tekrar kanitlanmali.
- Turkiye katalog importu ve Osmaniye/Ankara/Istanbul coverage kontrolu tamamlanmis olmalidir.
- Production secret yonetimi, TLS, CORS ve Gateway security hardening gerekir.
- Paket/NuGet guvenlik uyarilari temizlenmelidir.
- CI quality gate ve signed native build/release pipeline olgunlastirilmalidir.
- Event delivery, reconciliation ve error queue operasyonlari load/failure altinda test edilmelidir.
- MonitoringService ve dashboard/alerting uretim seviyesine getirilmelidir.
- Backup, restore, disaster recovery ve data retention politikasi yazilmalidir.
- Moderasyon kuyrugu, otomatik gizleme, yaptirimlar ve denetim izi var (BLK-MODERATION-01), fakat arayuzu yalniz CLI (`scripts/moderation.ps1`); gorsel moderasyon saglayicisi yok (API anahtari gerekir), itiraz icin gercek bir destek adresi yok, 24 saat icinde mudahale sureci operasyonel olarak kurulmali.
- Hesap silme var (plan-devam F3, D-021): Ayarlar > Hesap > Hesabi sil (iki adim + sifre), 30 gun bekleme (giriste `PendingDeletionScreen` "Silmeyi geri al"), sonra `AccountPurgeService` `UserDeletedIntegrationEvent` yayinlar; Blog (`Consumers/UserDeletedConsumer`: sinyaller PostDeleted ile, yorum/begeni kaldirma, goruntulenme, medya dosyalari) ve Notifications (mesajlar bosaltilir, snap/hikaye dosyalari, tepkiler, bildirimler, jetonlar) siler, Identity kisisel veriyi bosaltir. Acik: EventStore olay gecmisinde eski sinyal olaylari kaliyor (tombstone + scavenge isletim gorevi). Destek/itiraz adresi hala `{{DESTEK_EPOSTA}}` yer tutucusu (`legalContent.ts`); yayindan once doldurulmali.
- Rate limit'ler hala eksiktir (arkadaslik/engel/rapor icin yalniz uygulama ici tavanlar var).
- Push bildirimi yok: bekleyen arkadaslik istegi ve kaydedilen yerin canli durumu yalniz uygulama acikken gorunur.
- Kayitli yerler hesapla senkron (sinyal-mvp-plan P6.8, BLK-SAVED-01); koleksiyonlar ve sinyal kaydetme henuz yok.
- OSM complex relation geometrilerinin tam destegi sinirlidir; nokta fallback devam eder.
- GPS server tarafli hesaplanir ancak donanim attestation olmadigi icin mutlak spoof-proof degildir.

## 21. Oncelikli Yol Haritasi

**2026-09-22 notu:** §2.3'teki pivot kararindan sonra sosyal capability genisletme calismasi artik
`docs/sinyal-mvp-plan/docs/plan/13_ROADMAP_PHASES.md`'deki Faz 1-13 sirasiyla, kendi PROGRESS.md'si
uzerinden yurutuluyor; asagidaki P0/P1/P2 listeleri hala gecerlidir ve core loop guvenilirligi
sinyal-mvp-plan'in fazlarindan bagimsiz olarak korunmalidir (bir sosyal ozellik ugruna P0 zayiflatilmaz).

### P0 Cekirdek dogrulama

- Turkiye geneli Place katalogunu tamamla ve bolgesel coverage smoke testlerini yesile cevir.
- `Yerler` katmaninda katalog Place'lerini kontrollu ve performansli goster.
- Iki cihazda A yayinlar -> B gorur zincirini kayit altina al.
- iOS touch lifecycle, loading settle ve stale request regresyonlarini fiziksel cihazda kapat.
- Core loop yesil olmadan yeni business capability acma; sinyal-mvp-plan'in DM/story/sosyal fazlari bile bu satirin bir istisnasi degildir — core loop regresyona girerse o faz durur, once core loop duzeltilir.

### P1 Uretim guvenilirligi

- Event publisher checkpoint ve consumer inbox semantigini failure injection ile test et.
- Reconciliation araci/isi ile EventStore ve Mongo projection farklarini bul ve onar.
- DLQ/error queue gorunurlugu, alarm ve tekrar oynatma proseduru ekle.
- Health/readiness/liveness ayrimini gercek bagimliliklara gore netlestir.
- Timeout, retry ve circuit breaker'lari katman bazinda olcerek ayarla.

### P1 Guvenlik ve auth

- Tum servislerde issuer/audience/scope/policy tutarliligini otomatik test et.
- Development signing key fallback'lerini production'da fail-closed yap.
- Gateway ve servisler icin TLS, CORS, secret store ve rate limit hardening yap.
- Refresh token rotation/revocation ve cihaz oturum yonetimini tamamla.
- PII/konum retention ve silme politikasini uygula.

### P1 Quality gate

- CI'da dotnet build/test, Expo typecheck/test, contract/integration testleri calistir.
- NuGet/npm security auditlerini kontrollu sekilde kapat.
- API/event schema compatibility testleri ekle.
- Importer ve geospatial query performans testleri ekle.
- Signed iOS/Android development ve release buildlerini dogrula.

### P2 Place ve trust kalitesi

- Katalog coverage metrigi ve import surumleme ekle.
- Duplicate Place birlestirme ve yanlis kategori duzeltme operasyonu tasarla.
- Place claim/verification'i ancak domain ve moderation kurallari netlestikten sonra ekle.
- Trust score'u aciklanabilir sinyallerle gelistir; opaque tek sayiya indirgeme.
- Kullanici geri bildirimiyle eski/yanlis sinyal duzeltme akisi kur.

### P2 Safety ve moderation

- Report, moderation case ve audit trail modeli
- Spam/abuse hiz limitleri
- Hassas konum ve kisi guvenligi politikalari
- Isletme icerigi ile topluluk sinyalini acikca ayiran kaynak badge'leri

## 22. Bir Milyon Kullanici Perspektifi

Mevcut yapi portfolyo ve MVP icin guclu bir temel olsa da bir milyon kullanici icin su riskler ele alinmadan production-ready sayilmaz:

- Tek node EventStoreDB, RabbitMQ, Mongo ve PostgreSQL yuksek erisilebilir degildir.
- Local Docker Compose production orchestration degildir.
- Mongo geospatial bounds sorgulari, aktif signal join'leri ve viewport limitleri yuk testine muhtactir.
- Hot metropolitan viewport'larda marker clustering server/client birlikte olceklenmelidir.
- RabbitMQ consumer partitioning, prefetch ve ordering semantigi domain bazinda test edilmelidir.
- Checkpoint publisher tek instance/leader ve failover davranisi netlestirilmelidir.
- Media object storage, CDN, malware/content validation ve lifecycle policy gerekir.
- Push notification fan-out ve proximity subscription maliyeti kontrol edilmelidir.
- Auth signing key rotation ve revocation operasyonu gerekir.
- Rate limiting yalniz IP/device header'a guvenmemelidir.
- OSM lisans/attribution, veri guncelleme ve silme proseduru operasyonellestirilmelidir.
- SLO, dashboard, alert, on-call runbook ve kapasite planlamasi eksiksiz olmalidir.
- Backup restore tatbikati yapilmadan veri dayanikliligi varsayilmamalidir.

Olcekleme icin hemen yeni mikroservis ekleme. Once metrik, profiling ve yuk testiyle gercek darbogazi kanitla. Context sinirlari servis sinirina donusebilir, fakat dagitim maliyeti urun degerinden once gelmemelidir.

## 23. Kod Degistirirken Kurallar

1. Once Product Constitution filtresini uygula.
2. Ilgili servis, test ve contract'i birlikte oku.
3. Mevcut calisma agaci kirli olabilir; kullanicinin degisikliklerini geri alma.
4. Aktif Expo istemcisini hedefle; MAUI kaldirilmistir, geri getirme.
5. Mobil backend'e yalniz Gateway uzerinden gider.
6. Domain event veya integration event degisirse tum producer/consumer/projection zincirini guncelle.
7. Place discovery ile trust enforcement'i birbirine karistirma.
8. UI'dan gelen trust/distance bayragina yetki verme.
9. Eski veri veya refresh hatasinda gecerli UI state'ini gereksizce silme.
10. Her async yolun cancellation, stale response ve loading cleanup davranisini dusun.
11. Raw stack trace'i mobil UI'ya cikarma.
12. Koordinat, token, sifre veya secret loglama.
13. Gereksiz yeni abstraction veya mikroservis ekleme.
14. Dar kapsamli, geri alinabilir degisiklik yap ve risk kadar test ekle.
15. Fiziksel cihaz gerektiren sonucu otomasyonla kanitlanmis gibi raporlama.
16. Commit/push/tag yalniz kullanici acikca istediginde yap.

## 24. Definition of Done

Bir degisiklik ancak su kosullarla tamamlanmis sayilir:

- Urun anayasasina uyumlu.
- Domain kurali sunucuda enforce ediliyor.
- API ve event contract etkileri incelendi.
- Build ve ilgili otomatik testler gecti.
- Loading, timeout, retry, abort ve stale response yollari ele alindi.
- Idempotency ve duplicate davranisi gerekiyorsa test edildi.
- Guvenlik ve mahremiyet etkisi degerlendirildi.
- Loglar tanilayici fakat hassas veri icermiyor.
- README/CLAUDE/ADR gibi yasayan dokumanlar davranis degistiyse guncellendi.
- Native davranis degistiyse fiziksel iOS/Android adimlari raporlandi.
- Kalan riskler acikca yazildi; `PASS` kanitsiz kullanilmadi.

Core loop release Definition of Done ek olarak sunlari ister:

- EventStore kaydi
- RabbitMQ publish kaniti
- Worker consume ve idempotency kaniti
- Mongo post projection
- Place'e bagliysa PlaceSignal projection
- Gateway bounds cevabi
- Iki cihazda pin ve detail
- Restart/pan/network recovery
- Duplicate pin olmamasi
- Tekrarlanabilir smoke komutu

## 25. Claude Icin Calisma Protokolu

Yeni bir gorev geldiginde su sirayi izle:

1. Gorevin Product Constitution ile uyumunu bir cumleyle belirle.
2. `git status --short` ile kullanicinin mevcut degisikliklerini gor.
3. Ilgili kod ve testleri oku; isimden mimari varsayma.
4. Sorunu yeniden uret veya mevcut log/endpoint kanitini topla.
5. Root cause'u katman olarak belirle: mobil, Gateway, servis, event bus, projection, veri veya provider.
6. En dar ve domainle uyumlu duzeltmeyi uygula.
7. Hedefli testten genis teste dogru dogrula.
8. Gerekiyorsa fiziksel cihaz retest adimlarini ver.
9. Son raporda sonucu, root cause'u, dosyalari, validation'i ve kalan riskleri ayir.

Sorun cozerken su anti-patternlerden kacin:

- Kanit olmadan tum timeoutlari buyutmek
- Her render'da request baslatmak
- Eski response'un yeni state'i ezmesine izin vermek
- Bos provider sonucuyla mevcut lokal veriyi silmek
- Mobilde backend stack trace gostermek
- Place secimini proximity kaniti sanmak
- Projection gecikmesini senkron write'a cevirerek gizlemek
- Testi gecirmek icin gercek domain kuralini zayiflatmak
- Yeni mikroservisle yerel bir kod problemini dagitmak

## 26. Kaynak Dosyalar

Bir goreve baslarken en yararli giris noktalari:

- Urun anayasasi: `docs/Product_Constitution_Blinkr_Urun_Anayasasi.docx`
- Son kapsamli uygulama kaniti: `docs/BLK-PRODUCT-08.md`
- CQRS/ES notlari: `docs/architecture-cqrs-es.md`
- Mobil calistirma: `src/Clients/Blinkr.Expo/README.md`
- Script rehberi: `scripts/README.md`
- Compose altyapisi: `docker-compose.yml`
- Gateway route'lari: `src/Gateway/ApiGateway/appsettings.json`
- Blog startup: `src/Services/BlogService/BlogService.Api/Program.cs`
- Place startup: `src/Services/PlaceService/PlaceService.Api/Program.cs`
- Post aggregate: `src/Services/BlogService/BlogService.Domain/Entities/PostAggregate.cs`
- Proximity policy: `src/Services/BlogService/BlogService.Application/Services/PlaceProximityPolicy.cs`
- Event publisher: `src/Services/BlogService/BlogService.Api/Publishers/EventStoreToRabbitMqPublisher.cs`
- Projection inbox: `src/Services/WorkerService/Blinkr.Projections.Worker/Infra/ProjectionInbox.cs`
- Place controller: `src/Services/PlaceService/PlaceService.Api/Controllers/PlacesController.cs`
- Place state: `src/Services/PlaceService/PlaceService.Api/Application/CurrentPlaceStateCalculator.cs`
- Unified map: `src/Services/BlogService/BlogService.Api/Controllers/MapController.cs`
- Mobil root: `src/Clients/Blinkr.Expo/App.tsx`
- Mobil map: `src/Clients/Blinkr.Expo/src/components/MapScreen.tsx`
- Composer: `src/Clients/Blinkr.Expo/src/components/SignalComposer.tsx`
- API client: `src/Clients/Blinkr.Expo/src/api.ts`
- Nearby ownership: `src/Clients/Blinkr.Expo/src/nearbyRequestOwnership.ts`
- Nearby tiers: `src/Clients/Blinkr.Expo/src/nearbyPlaceTiers.ts`
- Canonical startup: `scripts/start-blinkr-dev.ps1`
- Canonical status: `scripts/status-blinkr-dev.ps1`

## 27. Son Referans

Her tartismada su cumleyi karar filtresi olarak kullan:

> Blinkr insanlarin uygulamada daha fazla zaman gecirmesi icin degil, gercek dunyada daha iyi yer kararlari vermesi icin vardir.

Bir degisiklik bu amaci guclendiriyor, bilgiyi daha taze ve guvenilir yapiyor, mahremiyeti koruyor ve cekirdek donguyu daha dayanikli hale getiriyorsa Blinkr'in dogru yonundedir.

## 28. Devam Paketi (plan-devam, 2026-09-23)

> Bu paketteki `docs/plan/` referansları `docs/sinyal-mvp-plan/docs/plan/` klasörünü kasteder. Paket `docs/plan-devam/` altındadır; tek takip dosyası `docs/plan-devam/PROGRESS_DEVAM.md`.
> mimari tanımları hâlâ oradadır. Bu paket **sıradaki işleri** ve **sırayı** tanımlar.

### Şu an neredeyiz
Faz 0–9 işlevsel olarak tamamlandı, Faz 10'un yarısı bitti (P10.1, P10.3, P10.4, P10.8, P10.9).
Ancak kullanıcı uygulamayı elle test etti ve **plandaki bazı görsel/UX hedeflerinin koda yansımadığını**
tespit etti. Ayrıntı: `docs/plan-devam/00_BURADAN_DEVAM.md`.

### Yeni yürütme sırası
```
Faz A  Doğrulama ve temizlik      (test verisi, seed, gerçek hatalar)   ← ŞİMDİ BURADAN BAŞLA
Faz B  Palet ve tema (D-006)      (uygulanmamış; şimdi uygulanacak)
Faz C  Sinyal Kartı + harita      (Faz 3'ün eksik kalan görsel kısmı)
Faz D  Kamera-öncelikli oluşturma (Faz 5'in eksik kalan kısmı)
Faz E  Sohbet yenileme            (Faz 8'in eksik kalan kısmı)
Faz F  Faz 10 kalanları           (P10.10, P10.7, P10.6)
Faz G  Faz 11 + 12                (i18n, a11y, performans, analitik, QA, yayın)
```

### Bu paketin dosyaları
| Dosya | İçerik |
|---|---|
| `docs/plan-devam/00_BURADAN_DEVAM.md` | Durum tespiti, neden bu sıra, çalışma kuralları |
| `docs/plan-devam/01_FAZ_A_DOGRULAMA_TEMIZLIK.md` | A1–A9 |
| `docs/plan-devam/02_FAZ_B_PALET_VE_TEMA.md` | B1–B11, kesin token değerleri |
| `docs/plan-devam/03_FAZ_C_SINYAL_KARTI_VE_HARITA.md` | C1–C13 |
| `docs/plan-devam/04_FAZ_D_OLUSTURMA_AKISI.md` | D1–D11 |
| `docs/plan-devam/05_FAZ_E_SOHBET.md` | E1–E9 |
| `docs/plan-devam/06_FAZ_F_FAZ10_KALANLARI.md` | F1–F7 |
| `docs/plan-devam/07_FAZ_G_KAPANIS_I18N_QA_YAYIN.md` | G1–G14 |
| `docs/plan-devam/PROGRESS_DEVAM.md` | Tek takip dosyası (bunu güncelle) |

### Değişmeyen kurallar (mevcut CLAUDE.md'den)
- Yerel IP kuralı: `src/Clients/Blinkr.Expo/src/api.ts` içindeki yerel IP commit'lenmez.
- `git add -A` sonrası kullanıcının özel dosyalarını `git reset` ile dışarıda bırak.
- Commit sonu `Co-Authored-By`, her commit sonrası push.
- Yeni her kullanıcı metni i18n (tr + en); renk/ölçü yalnızca `theme.ts` token'ları.
- Secret / ücretli servis / veri silen migration dışında soru sorma; her sapma DECISIONS.md'ye.
- Her faz sonunda: kabul betikleri + `typecheck` + testler + iOS/Android export, sonra
  `PROGRESS_DEVAM.md` güncelle ve commit at.

### Ek kural (bu paketle gelir)
**"Tamam" demek ekranda görünmek demektir.** Bir görevi kapatmadan önce ilgili ekranın simülatörde
gerçekten değiştiğini doğrula. Kabul kriteri "kod yazıldı" değil, "ekranda şu görünüyor" biçiminde
yazılmıştır; doğrulayamadığın maddeyi `[~]` bırak ve nedenini yaz.

