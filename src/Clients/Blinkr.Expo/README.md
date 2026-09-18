# Blinkr Mobile

Blinkr'ın React Native + Expo istemcisi tam ekran harita üzerine kuruludur. Yer seçimi, güncel sinyal ve medya paylaşımı aynı çekirdek döngüyü kullanır:

`A giriş yapar -> konumlu sinyal yayınlar -> EventStore -> RabbitMQ -> Worker -> MongoDB -> Gateway -> B haritada pini ve detayı görür`

## Gerekenler

- Docker Desktop açık ve Linux containers modunda
- .NET 8 SDK
- Node.js 22.13 veya daha yeni
- Projenin Expo SDK 54 sürümüyle uyumlu Expo Go veya development build
- Bilgisayar ve telefon aynı Wi-Fi ağında

İlk kurulumda mobil klasöründe bir kez çalıştır:

```powershell
cd C:\Users\hy971\source\repos\Blinkr\Blinkr\src\Clients\Blinkr.Expo
npm install
```

## Her Çalıştırmada

İki terminal yeterli. Visual Studio'dan bütün solution'ı başlatma.

### Terminal 1: Backend

Repository kökünde:

```powershell
cd C:\Users\hy971\source\repos\Blinkr\Blinkr
powershell -ExecutionPolicy Bypass -File .\scripts\start-blinkr-dev.ps1
```

Bu komut şunları ayağa kaldırır:

- Docker: PostgreSQL, Redis, EventStoreDB, RabbitMQ, MongoDB ve projection worker
- .NET: Identity `:5188`, Blog `:5215`, Place `:5225`, Notifications `:5290`, Gateway `:5080`

İlk çalıştırma birkaç dakika sürebilir. Sonunda tüm sağlık kontrolleri yeşil ve `Gateway LAN` adresi görünmelidir.

Durumu sonradan kontrol etmek için:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\status-blinkr-dev.ps1
```

### Terminal 2: Expo

Backend hazır olduktan sonra:

```powershell
cd C:\Users\hy971\source\repos\Blinkr\Blinkr\src\Clients\Blinkr.Expo
npm run start:lan
```

Komut bilgisayarın Wi-Fi IPv4 adresini bulur ve istemciyi yalnızca Gateway'e bağlar:

```text
EXPO_PUBLIC_BLINKR_API_URL=http://<bilgisayar-ip>:5080
```

Metro, Docker servisleriyle çakışmaması için `8083` portunda açılır. Terminalde oluşan QR kodu telefondaki Expo Go ile tara. Android'de Expo Go içindeki `Scan QR code`, iOS'ta Kamera uygulaması kullanılabilir.

IP yanlış seçilirse açıkça ver:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-real-device.ps1 -LanIp 192.168.1.105
```

Windows ilk bağlantıda izin sorarsa Node.js ve .NET için **Private networks** erişimine izin ver. Kurumsal VPN, WARP veya AP isolation telefonun bilgisayara erişmesini engelleyebilir.

## Fiziksel Cihaz Testi

1. İlk telefonda `Yeni hesap` ile kayıt ol ve konum iznini ver.
2. Ortadaki `+` düğmesine dokun. Yakındaki bir yeri seç veya `Bu konumda paylaş` ile koordinat paylaşımını seç. `Yer ara` gerçek yer kataloğunda isim/kategori arar.
3. Yer, sinyal türü/durumu, isteğe bağlı metin/medya ve son kontrol adımlarını tamamlayıp yayınla. Önce metinsiz bir durum, ardından fotoğraf ve açıklama içeren bir paylaşım dene.
4. İkinci telefonda farklı bir e-posta ile kayıt ol.
5. Aynı bölgeyi aç; gerekirse `Bu alanı tara` düğmesine dokun.
6. Pin türünün, yaklaşık alanın, kaynak bilgisinin ve kalan yayın süresinin doğru geldiğini kontrol et. Public ekranda kesin cihaz koordinatı görünmemelidir.
7. İkinci telefonda Wi-Fi'yi kısa süre kapat/aç, haritayı başka yere taşıyıp geri dön ve uygulamayı yeniden aç. Sinyal tekrar yüklenmelidir.

Backend kanıtını toplamak için repository kökünde:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\collect-blk-acceptance-01b-evidence.ps1 -PostId <post-id>
```

Rapor `artifacts\blk-acceptance-01b` altında oluşur. `PostId` değerini Blog API logundan veya smoke komutu çıktısından al; iki cihazdaki harita ve açık pin detayının ekran görüntülerini aynı klasöre ekle.

Structured signal sözleşmesini ve gerçek altyapı zincirini tekrar çalıştırmak için repository kökünde:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-structured-signal.ps1
```

Bu test hızlı kategorik paylaşımı, anonimleştirmeyi, yaklaşık koordinatı, private sinyalin public bounds dışında kalmasını ve projection idempotency'sini doğrular.

Yer listesi içe aktarılmış gerçek OSM kataloğunu kullanır. Yakındaki ilk beş yer 600 metre içinde, ek yerler 1500 metreye kadar gösterilir. Aynı isimli şubeler farklı kimliklerle korunur.

Sunucu, cihaz doğruluğuna uyguladığı en fazla 50 metrelik tolerans ve varsa yer geometrisi üzerinden yayın seviyesini belirler: etkin mesafe 200 metreye kadar `VERIFIED_LIVE`, 600 metreye kadar `NEARBY_PLACE_POST`. Yakındaki yer paylaşımı canlı doluluk/sıra durumunu etkilemez. Daha uzak yer seçilebilir ancak o yere yayın engellenir; seçim sessizce koordinat paylaşımına çevrilmez. 150 metreden kötü cihaz doğruluğu kabul edilmez.

## Tekrarlanabilir Kontroller

Backend çalışırken repository kökünde:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-product-08.ps1
```

Bu komut gerçek katalog ve Gateway testlerini, mevcut çekirdek smoke testlerini, Expo typecheck ve mobil testlerini çalıştırır. Test hesapları ve kısa ömürlü paylaşımlar oluşturur; sahte yer eklemez. Mobil klasörde kontroller ayrı çalıştırılabilir:

```powershell
npm run typecheck
npm run test:nearby
npm run test:product
npm run test:ui
npm run brand:build
```

Arayüz testi gerçek bileşenleri tarayıcıda, API ve native servis adaptörleri yerine test adaptörleriyle çalıştırır. Ekran görüntüleri `.tmp/product-ui` altındadır. Native harita, kamera/video, klavye ve iOS dokunma davranışı için fiziksel cihaz testi gerekir. Kaydedilen yerler yalnızca bu cihazda saklanır. Yeni uygulama simgesi Expo Go'nun simgesini değiştirmez; native build gerekir.

## Kapatma

Expo terminalinde `Ctrl+C` kullan. Ardından repository kökünde:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-blinkr-dev.ps1
```

Bu komut başlangıç betiğinin yönettiği uygulama süreçlerini durdurur. Docker altyapısını da durdurmak için `-Infrastructure` ekle; volume verilerini silmez.

## Sorun Giderme

`Network request failed`: Telefonda tarayıcıdan `http://<bilgisayar-ip>:5080/health` adresini aç. Açılmıyorsa aynı Wi-Fi, VPN ve Windows Firewall ayarlarını kontrol et.

`Invalid credentials`: Giriş ekranı e-posta ile oturum açar. Yeni cihaz için önce `Yeni hesap` sekmesini kullan.

Harita açılıyor ama pin yok: Haritayı sinyalin oluşturulduğu alana getir ve `Bu alanı tara` düğmesine dokun. Projection worker durumunu health scriptiyle kontrol et.

Konum gelmiyor: Telefon ayarlarında Expo Go için hassas konum iznini aç ve uygulamayı yeniden yükle.
