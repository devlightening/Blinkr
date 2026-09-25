# SECURITY

> Kullanıcı kararı (2026-09-24): MVP önce çalışsın, sertleştirme sonra. Bu dosya **bugün var olanı** ve
> **yayından önce yapılacakları** ayırır. V2 kodu mevcut korumaları kaldırmaz.

## Bugün var olan (korunur)
- JWT HS256 (iss `Blinkr.Identity`, aud `blinkr.api`), 60 sn saat kayması; tüm servislerde aynı doğrulama.
- Refresh token (hash'li saklama), 401'de tek refresh, başarısızsa oturum kapanır; SecureStore.
- Sunucu-tarafı yakınlık/güven (istemci iddiası yetki değil).
- Engel (iki yönlü, sohbet/arama/profil/takip/mention), rapor, ağırlıklı otomatik gizleme, yaptırımlar, denetim izi.
- İçerik süzgeci (`ContentTextFilter`): tehdit/nefret 422; TC kimlik/plaka maskeleme.
- Snap/hikaye medyası statik sunulmaz; EXIF (konum) silinir; bayt imzası doğrulanır.
- Log gizliliği: koordinat/token/şifre loglanmaz (`test-log-privacy.ps1`).
- Yaş: 13 altı kayıt yok, 18 altı gizli hesap + yalnız arkadaş mesajı.
- V2 hub: `[Authorize]`, grup katılımı sunucuda görünürlük kontrolüyle.

## Ertelenen (yayın öncesi zorunlu)
| # | Konu | Not |
|---|---|---|
| S1 | TLS her yerde (Gateway HTTPS, HSTS), `ws://` → `wss://` | Ters vekil/ingress ile |
| S2 | CORS allowlist | Yalnız web istemcisi gelirse |
| S3 | Rate limiting — **büyük kısmı yapıldı (2026-09-25, D-030):** giriş/kayıt IP başına (kayan pencere), hesap başına 10 hatalı girişte 15 dk kilit, gönderi/yorum/tepki kişi başına (Redis kova), sohbet/snap kişi başına 60/dk; Blog genel sınırı artık kişi başına (önceden Gateway IP'si yüzünden herkes tek kovayı paylaşıyordu). Kalan: hub bağlantısı, çok örnekli Identity/Notifications için Redis sayaç | Gateway + servis; Redis sayaç |
| S4 | Secret store (JWT anahtarı, DB parolaları) — geliştirme anahtarı fallback'i prod'da zaten kapalı (`BlinkrJwtOptions` Development dışında anahtarsız ya da dev anahtarıyla açılmaz); kalan: gerçek secret store | Key Vault / Doppler |
| S5 | Kökteki `.env` git izlemesinden çıkarılsın, parolalar değişsin | Geçmiş temizliği kullanıcı kararı |
| S6a | **Düzeltildi (D-031):** refresh token erişim token'ı olarak kabul ediliyordu (4 serviste); BLK-TOKENS-01 ile kalıcı test | |
| S6 | Refresh token rotasyonu + cihaz oturum listesi — **2026-09-25:** rotasyon vardı; eklenen: yeniden kullanım tespiti (döndürülmüş token 60 sn sonra tekrar gelirse kişinin tüm oturumları kapanır), `GET /api/users/me/sessions`, `POST /api/users/me/sessions/revoke-others`, Ayarlar > Hesap > Oturumlar (BLK-SESSIONS-01). Cihaz adı saklanmıyor (şema değişikliği gerekir) | |
| S7 | NuGet/npm güvenlik uyarıları — **2026-09-25:** NuGet 0 (MonitoringService'teki geçişli KubernetesClient 15.0.1, GHSA-w7r3-mgwf-4mqq, 17.0.14'e sabitlendi). npm: 10 orta seviye, hepsi Expo derleme araçlarında (`uuid` ← `xcode`, @expo/cli/config); uygulama çalışma zamanına girmez, npm'in önerdiği "düzeltme" Expo 46'ya inmek: Expo güncellemesine kadar kabul | |
| S8 | Medya: S3 + imzalı URL, kötü amaçlı yazılım/NSFW taraması | Ücretli sağlayıcı |
| S9 | EventStore tombstone + scavenge (hesap silmede eski olaylar) | Operasyon |
| S10 | Push (APNs/FCM) anahtarları | Secret |
| S11 | Pen-test, bağımlılık SBOM | |

## Geliştirici kuralları (şimdi de geçerli)
Secret koda/dokümana yazılmaz; yeni uçta `[AllowAnonymous]` bilinçli; kullanıcıya stack trace gösterilmez;
yetki kontrolü istemcide değil sunucuda.
