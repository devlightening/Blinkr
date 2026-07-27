# Blinkr Mobile

Blinkr'ın React Native + Expo istemcisi tam ekran harita üzerine kuruludur. Bu sürüm yalnızca doğrulanmış çekirdek döngüyü kapsar:

`A giriş yapar -> konumlu sinyal yayınlar -> EventStore -> RabbitMQ -> Worker -> MongoDB -> Gateway -> B haritada pini ve detayı görür`

## Gerekenler

- Docker Desktop açık ve Linux containers modunda
- .NET 8 SDK
- Node.js 22.13 veya daha yeni
- Telefonda güncel Expo Go
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
powershell -ExecutionPolicy Bypass -File .\scripts\start-blinkr-mobile-backend.ps1
```

Bu komut şunları ayağa kaldırır:

- Docker: PostgreSQL, Redis, EventStoreDB, RabbitMQ, MongoDB ve projection worker
- .NET: Identity API `:5188`, Blog API `:5215`, Gateway `:5080`

İlk çalıştırma image build ve migration nedeniyle birkaç dakika sürebilir. Sonunda üç HTTP sağlık kontrolü yeşil ve `Gateway LAN URL` görünmelidir.

Durumu sonradan kontrol etmek için:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-blinkr-mobile-backend.ps1
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
2. Ortadaki `+` düğmesine dokun ve `Yakınımdaki alan` veya yakınlaştırılmış `Harita merkezi` seçimini doğrula.
3. `Hızlı sinyal` ile bir tür ve durum seçip metinsiz yayınla. Ardından `Detaylı paylaşım` ile başlık ve açıklama içeren ikinci bir sinyal gönder.
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

Bu sürüm gerçek bir Place kataloğu sağlamaz. Composer cihazın yaklaşık alanını veya harita merkezini seçer; `PlaceId` gerçek Place capability'si eklenene kadar boş bırakılır.

## Kapatma

Expo terminalinde `Ctrl+C` kullan. Ardından repository kökünde:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-blinkr-mobile-backend.ps1
```

Bu komut bu başlangıç betiğinin açtığı .NET süreçlerini ve mobil çekirdek için kullanılan Docker servislerini durdurur; volume verilerini silmez.

## Sorun Giderme

`Network request failed`: Telefonda tarayıcıdan `http://<bilgisayar-ip>:5080/health` adresini aç. Açılmıyorsa aynı Wi-Fi, VPN ve Windows Firewall ayarlarını kontrol et.

`Invalid credentials`: Giriş ekranı e-posta ile oturum açar. Yeni cihaz için önce `Yeni hesap` sekmesini kullan.

Harita açılıyor ama pin yok: Haritayı sinyalin oluşturulduğu alana getir ve `Bu alanı tara` düğmesine dokun. Projection worker durumunu health scriptiyle kontrol et.

Konum gelmiyor: Telefon ayarlarında Expo Go için hassas konum iznini aç ve uygulamayı yeniden yükle.
