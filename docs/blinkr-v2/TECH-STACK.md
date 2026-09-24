# TECH-STACK

## Backend (mevcut, korunuyor)
| Katman | Teknoloji | Neden |
|---|---|---|
| Dil/çatı | .NET 10, ASP.NET Core | Mevcut kod, tip güvenliği, performans |
| Gateway | YARP | Tek giriş, WebSocket geçişi hazır |
| Yazma modeli | EventStoreDB | Gönderi geçmişi authoritative, yeniden oynatılabilir |
| Okuma modeli | MongoDB 7 (2dsphere) | Coğrafi sorgular, esnek belge |
| İlişkisel | PostgreSQL 16 + EF Core | Kullanıcı/takip/engel tutarlılığı |
| Mesajlaşma | RabbitMQ + MassTransit | Servisler arası olay dağıtımı, retry, hata kuyruğu |
| Önbellek | Redis | Harita/okuma önbelleği, (V2 sonrası) SignalR backplane |
| CQRS | MediatR, FluentValidation | Komut/sorgu ayrımı, doğrulama |

## Backend (V2'de eklenen)
| Paket | Nerede | Amaç |
|---|---|---|
| `Microsoft.AspNetCore.SignalR` (framework içinde) | NotificationsService.Api | Gerçek zaman hub'ı |
| — | Gateway `appsettings.json` | `/hubs/{**catch-all}` route (YARP WebSocket'i otomatik geçirir) |

## Mobil (mevcut)
Expo SDK 57, React Native 0.86, React 19.2, reanimated 4.5 + worklets, gesture-handler 2.32,
react-native-maps 1.27 + supercluster, expo-video, expo-camera, expo-image-picker, expo-blur,
expo-haptics, expo-secure-store, i18next + react-i18next, lucide-react-native, react-native-svg,
Outfit fontu.

## Mobil (V2'de eklenen)
| Paket | Amaç | Not |
|---|---|---|
| `expo-linear-gradient` | Marka gradyanı: (+) düğmesi, hikaye halkası, birincil düğmeler | `npx expo install expo-linear-gradient` |
| `@microsoft/signalr` | Gerçek zaman istemcisi | Saf JS, native modül yok |
| `expo-sharing` / RN `Share` | Sistem paylaşımı | RN `Share` yeterli, yeni paket gerekmeyebilir |

## Prompt'taki önerilerin eşlenmesi
| Önerilen | Blinkr'de karşılığı | Neden değiştirilmedi |
|---|---|---|
| Node/Express | .NET mikroservisleri | Çalışan, test edilmiş kod; yeniden yazma maliyeti |
| PostgreSQL tek DB | Postgres + Mongo + EventStore | Her bounded context kendi deposunun sahibi |
| Leaflet | react-native-maps (Apple/Google) | Native performans, mobil uygulama |
| S3 | yerel disk (MVP) → S3 | `IMediaStorage` arayüzü arkasında; değişim tek sınıf |
| Socket.io | SignalR | .NET ile yerli, otomatik yeniden bağlanma, grup |
| Redux | yerel durum + hook'lar | Ekran sayısı ve veri akışı bunu gerektirmiyor |

## Sürüm politikası
Expo paketleri yalnız `npx expo install` ile (SDK uyumu). NuGet/npm güvenlik uyarıları `SECURITY.md`
ertelenen listesinde.
