# DEPLOYMENT

## 1. Yerel geliştirme
Gereksinimler: Windows + PowerShell, Docker Desktop, .NET 10 SDK, Node 22.13+, Expo Go / dev build, aynı Wi-Fi.
```powershell
# kökte .env (bkz. .env.example); secret'lar koda yazılmaz
powershell -ExecutionPolicy Bypass -File .\scripts\start-blinkr-dev.ps1      # Docker + Identity/Blog/Place/Notifications/Gateway, READY kontrolü
powershell -ExecutionPolicy Bypass -File .\scripts\status-blinkr-dev.ps1
cd .\src\Clients\Blinkr.Expo; npm install; npm run start:lan                 # LAN IP'yi bulur, API = http://<LAN-IP>:5080
powershell -ExecutionPolicy Bypass -File .\scripts\stop-blinkr-dev.ps1 [-Infrastructure]
```
Yer kataloğu: `scripts/bootstrap-place-catalog.ps1 -PbfPath C:\osm\turkey-latest.osm.pbf`.
Demo verisi: `node scripts/seed-demo.cjs` (`--reset` yalnız kendi sinyallerini siler).

## 2. Mobil derleme (EAS)
```powershell
npm i -g eas-cli; eas login
eas build --profile development --platform all     # dev client (native modüller: expo-video, linear-gradient)
eas build --profile production --platform ios|android
eas submit --platform ios|android
```
`app.json`: `scheme: "blinkr"`, izin metinleri tr/en, `userInterfaceStyle: "automatic"` (tema uygulama içinde).
OTA: `eas update --branch production` (yalnız JS değişikliklerinde).

## 3. Sunucu (MVP barındırma önerisi)
| Bileşen | MVP | Ölçek |
|---|---|---|
| Servisler | Tek VM'de Docker Compose (her servis bir container) | Kubernetes / Azure Container Apps |
| Gateway | YARP container + Caddy (otomatik TLS) önünde | Ingress + WAF |
| PostgreSQL | yönetilen (Azure/Neon) | HA replika |
| MongoDB | Atlas M10 | replica set / shard |
| EventStoreDB | tek node + günlük yedek | 3 node küme |
| RabbitMQ | CloudAMQP | küme |
| Redis | yönetilen | + SignalR backplane |
| Medya | disk hacmi | S3 + CloudFront |

## 4. Yayın kontrol listesi
Ayrıntılı: `docs/operations/release-checklist.md`. Özet:
- [ ] Tüm testler + regresyon seti yeşil; iOS/Android export; fiziksel iki cihaz testi.
- [ ] `SECURITY.md` ertelenen listesi (S1–S5 zorunlu) kapandı.
- [ ] Destek e-postası (`legalContent.ts` `{{DESTEK_EPOSTA}}`), yasal metinler hukuki incelemeden geçti.
- [ ] Mağaza gizlilik cevapları (`docs/operations/store-privacy-answers.md`), ekran görüntüleri (demo seed, koyu tema).
- [ ] Sentry DSN / analitik anahtarı (isteğe bağlı), push anahtarları.
- [ ] Yedek + geri yükleme tatbikatı; izleme panosu + alarm (publisher hatası, kuyruk birikimi, 5xx oranı).
- [ ] OSM atfı (ODbL) ayarlarda görünüyor.
