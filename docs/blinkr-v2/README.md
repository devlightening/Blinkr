# Blinkr V2 — Snapchat + Instagram = Blinkr

> Bu paket, Blinkr'in MVP'sini **sıfırdan değil, mevcut sistemin üzerine** küresel ölçekte kullanılabilir bir
> "harita + hikaye + sosyal" ürününe taşımak için tek kaynaktır. Güvenlik sertleştirmesi bilinçli olarak
> ertelendi (bkz. `SECURITY.md`); hedef, **önce çalışan ve kullanılmak istenen bir MVP**.

## 1. Ürün tek cümlede
Blinkr, "şu an nerede ne oluyor?" sorusunu **harita** (Snapchat Map), **hikayeler ve akış** (Instagram) ve
**sohbet/snap** (Snapchat) ile cevaplayan, konum-öncelikli bir sosyal uygulamadır.

| Snapchat'ten | Instagram'dan | Blinkr'e özgü |
|---|---|---|
| Harita açılış ekranı, pin → kart | Hikaye halkaları, 24 saatlik hikayeler | Sinyal türleri (Kalabalık, Sıra, Fırsat…) |
| Kamera-öncelikli (+) | Keşfet akışı, profil ızgarası | Sunucu-tarafı yakınlık güveni (Konumda rozeti) |
| Snap (bir kez izlenir), sohbet | Yorum, tepki, @mention, #hashtag | Tazelik: sinyaller süreyle solar |

## 2. Karar verilmiş temel seçimler
| Konu | Karar |
|---|---|
| Mimari | Mevcut .NET 10 mikroservisleri + EventStoreDB + MongoDB + PostgreSQL + RabbitMQ + YARP (D-001). **Yeniden yazılmaz.** |
| Mobil | Expo SDK 57 / React Native 0.86, reanimated 4, gesture-handler, expo-video, react-native-maps |
| Alt bar | **Harita · Keşfet · (+) · Mesaj · Profil**. Harita açılış ekranı; hikaye halkaları Keşfet'in üstünde |
| Tema | **Koyu varsayılan + gradyan vurgu** (#FFC83D → #FF6B6B → #B06BFF), zemin #0E0F12, kart #17191D; açık tema ayarlardan |
| Gerçek zamanlılık | SignalR hub (NotificationsService), bağlantı yoksa mevcut REST yoklamasına düşer |
| Güvenlik | MVP sonrası (TLS, CORS, rate limit, secret store) — `SECURITY.md` |

## 3. Paket içeriği
| Dosya | Ne anlatır |
|---|---|
| [CLAUDE_V2.md](CLAUDE_V2.md) | Ajanın bu paketle çalışma kuralları |
| [PROGRESS_V2.md](PROGRESS_V2.md) | Tek takip dosyası |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Servisler, SOLID katmanları, olay akışı, gerçek zamanlılık |
| [TECH-STACK.md](TECH-STACK.md) | Kullanılan ve eklenecek teknolojiler, gerekçeleri |
| [UI-UX-GUIDELINES.md](UI-UX-GUIDELINES.md) | Tasarım sistemi: renk, gradyan, tipografi, hareket, erişilebilirlik |
| [UI-COMPONENTS.md](UI-COMPONENTS.md) | Bileşen şartnameleri (props, durumlar, ölçüler) |
| [API-SPEC.md](API-SPEC.md) | Tüm uçlar: mevcut + V2 |
| [FEATURES/](FEATURES/) | 01 Kimlik · 02 Akış · 03 Hikayeler · 04 Harita · 05 Gönderi/Yorum · 06 Bildirim · 07 Gerçek zaman · 08 Video oynatıcı |
| [DATABASE/](DATABASE/) | Şema, migration, indeksler |
| [SECURITY.md](SECURITY.md) | Mevcut korumalar + ertelenenler |
| [PERFORMANCE.md](PERFORMANCE.md) | Bütçeler ve teknikler |
| [TESTING.md](TESTING.md) | Test stratejisi |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Yerel kurulum, derleme, yayın kontrol listesi |

## 4. Uygulama sırası
```
V2-1  Koyu tema + gradyan + alt bar + ekran geçişleri
V2-2  Post görüntüleyici: kart pop-up → tam sayfa, video oynatıcı, derin bağlantı
V2-3  Instagram birebir hikayeler (küp geçiş, beğeni, emoji yanıt)
V2-4  Emoji tepkileri, yorum beğenisi, @mention, #hashtag
V2-5  Gerçek zamanlılık (SignalR)
V2-6  Keşfet ve profil cilası (IG kart, ızgara)
V2-7  Paylaşım menüsü + Etkinlik (bildirim) ekranı
V2-8  Dokümanlar + kabul betikleri
```
Her faz sonunda: `typecheck`, `test:theme`, `test:nearby`, `test:product`, `test:i18n`, `test:ui`,
iOS/Android export, ilgili PowerShell kabul betikleri → `PROGRESS_V2.md` güncellenir → commit + push.

## 5. Hızlı başlangıç (geliştirici)
```powershell
# Backend (Docker altyapısı + 5 servis + Gateway)
powershell -ExecutionPolicy Bypass -File .\scripts\start-blinkr-dev.ps1
# Mobil
cd .\src\Clients\Blinkr.Expo; npm install; npm run start:lan
# Tarayıcıda bileşen önizleme
node scripts/ui-shot.cjs signal-card 390 844 "theme=dark"
```
Ayrıntı: [DEPLOYMENT.md](DEPLOYMENT.md).
