# Blinkr Proje Rehberi ve Mimari Calisma Sozlesmesi

Bu belge, Blinkr deposunda calisacak Claude veya baska bir yazilim ajaninin urunu, domaini, mevcut mimariyi, kritik veri akislarini, degismez urun kurallarini ve siradaki muhendislik hedeflerini tek okumada anlayabilmesi icin hazirlanmistir.

Bu belgeyi bir pazarlama metni olarak degil, proje devir dokumani ve calisma sozlesmesi olarak kullan. Bir degisiklik yapmadan once ilgili kodu ve testleri yine oku; bu belge yon verir ancak calisan kodun yerine gecmez. Kod ile bu belge celisirse once celiskiyi kanitla, sonra Product Constitution'a uygun olan cozumle ikisini birlikte guncelle.

## 1. En Kisa Tanim

Blinkr, insanlarin gercek dunyada bir yer hakkinda daha hizli, daha dogru ve daha guvenli karar vermesini saglayan harita merkezli bir mobil urundur.

Blinkr'in temel sorusu sudur:

> Su anda bu yerde ne oluyor ve bu bilgi karar vermem icin yeterince taze ve guvenilir mi?

Urunun merkezi nesnesi kullanici profili veya genel sosyal medya gonderisi degil, `Place` yani gercek dunyadaki yerdir. Kullanici bir yerin kalabalikligini, sirasini, gecici durumunu, firsatini, etkinligini veya genel gozlemini kisa omurlu bir `Signal` olarak paylasir. Diger kullanicilar bu sinyali haritada gorur ve bir yere gitme, bekleme, alternatif arama veya vazgecme kararini daha iyi verir.

Blinkr'in basarisi ekranda gecirilen sureyle degil, yer kararinin kalitesi ve kullaniciya kazandirdigi zamanla olculmelidir.

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
- `Decision utility over engagement`: Ozellikler kullaniciyi daha uzun tutmak icin degil, karari kolaylastirmak icin vardir.

### 2.2 Bilincli olarak yapilmayanlar

Blinkr su anda genel bir sosyal medya urunune donusturulmemelidir:

- Sonsuz ve eglence merkezli genel feed
- Kullanici tutma amacli story veya kisa video akisi
- Urun amacindan kopuk DM/mesajlasma
- Surekli kisi takibi veya canli konum izleme
- Genis ve gosterisli profil ekonomisi
- Reklami dogrulanmis yer sinyali gibi gosteren yuzeyler
- Mahremiyet veya guvenligi engagement icin zayiflatan mekanikler

Medya, yorum, begeni veya bildirim ancak yer karari dongusunu destekledigi olcude anlamlidir. Bunlar urunun merkezi degildir.

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

Kod: `src/Services/NotificationsService`

Bu context MVP harita dongusunun birincil bloklayicisi degildir. Cekirdek event ve map akisi bozukken notification genisletilmemelidir.

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

Confidence ve freshness, event sayisi ile birlikte zaman agirligi kullanilarak hesaplanir. Bu mekanizma ileride degisebilir ancak daha az guvenilir yayinlarin canli state'i zehirlememesi degismez kuraldir.

### 10.3 Privacy

- Public haritada kesin cihaz koordinatini gereksiz yere gostermeme.
- Place postunda kamusal konum olarak Place merkezi/geometrisi kullanma.
- Coordinate signal'da `ApproximateArea` semantigini koruma.
- `AnonymousMap` seciminde author adini public projection/detail'e sizdirmama.
- Loglarda raw koordinatlari, JWT'yi, refresh token'i veya kullanici sifresini yazmama.
- Konum iznini urunun zorunlu olmayan alanlarinda gereksiz istememe.

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

- `AuthScreen`: register/login
- `MapScreen`: ana urun kabugu, map state, layers, marker'lar, nearby ve composer orchestration
- `SignalComposer`: dort adimli yayin akisi
- `PlacePicker`: nearby ve extended Place secimi
- `PostDetailSheet`: Place veya coordinate signal detayi
- `Sheet`: uygulama ici ortak bottom sheet yapisi
- `BlinkrMapMarker`, `PlaceSymbol`, `SignalSymbol`: semantik marker sunumu

### 12.2 Composer adimlari

1. Yer: cihaz yakini, arama, harita merkezi veya secili Place
2. Sinyal: tur ve opsiyonel yapilandirilmis deger
3. Icerik: baslik, aciklama, medya, kimlik gorunurlugu
4. Kontrol ve yayin

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

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/users/...`

### Posts and signals

- `POST /api/posts`
- `GET /api/posts/{id}`
- `PUT /api/posts/{id}`
- `DELETE /api/posts/{id}`
- `POST /api/posts/{id}/comments`
- `POST /api/posts/{id}/likes`
- `GET /api/posts-read/bounds`
- `GET /api/posts-read/nearby`
- `POST /api/posts/place-presence`

### Map

- `GET /api/map/bounds`
- `GET /api/map/nearby`

### Places

- `GET /api/places/{id}`
- `GET /api/places/{id}/signals`
- `GET /api/places/nearby`
- `GET /api/places/search`
- `GET /api/places/bounds`
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
npm run test:nearby
npm run test:product
npm run test:ui
```

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
- Abuse reporting/moderation, rate limit ve safety operasyonlari tamamlanmalidir.
- Saved Place su anda cihaz-yerel olabilir; senkron hesap ozelligi ayri urun karari gerektirir.
- OSM complex relation geometrilerinin tam destegi sinirlidir; nokta fallback devam eder.
- GPS server tarafli hesaplanir ancak donanim attestation olmadigi icin mutlak spoof-proof degildir.

## 21. Oncelikli Yol Haritasi

Yeni sosyal capability eklemeden su sirayi koru.

### P0 Cekirdek dogrulama

- Turkiye geneli Place katalogunu tamamla ve bolgesel coverage smoke testlerini yesile cevir.
- `Yerler` katmaninda katalog Place'lerini kontrollu ve performansli goster.
- Iki cihazda A yayinlar -> B gorur zincirini kayit altina al.
- iOS touch lifecycle, loading settle ve stale request regresyonlarini fiziksel cihazda kapat.
- Core loop yesil olmadan yeni business/DM/story capability acma.

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
