# Blinkr V2: devir notu (2026-09-24)

Plan paketi: `docs/blinkr-v2/`. Takip dosyası: `PROGRESS_V2.md`. ZIP: `artifacts/blinkr-v2-plan.zip` (gitignore'da, yerelde).
Dal: `feat/blinkr-theme-redesign`.

## Bitti ve push edildi
| Commit | İçerik |
|---|---|
| 594b61a | V2 plan paketi (23 md) |
| 204235a | V2-1: koyu varsayılan tema (#0E0F12 / #17191D), marka gradyanı `gradients.brand` (#FFC83D → #FF6B6B → #B06BFF), Instagram tarzı alt çubuk (etiketsiz, profil sekmesinde avatar, gradyan +), gradyan hikaye halkaları (`ui/GradientRing`), sekme geçişinde solma. Karar: D-024 |
| 7620bf0 | V2-2: Sinyal Kartı tam sayfaya büyüyor (yukarı çek, yorum düğmesi ya da "Tam sayfa aç"; aşağı çek ya da Geri ile karta dönüyor), tam sayfada `SignalThreadPanel fill`, tek `signal/VideoPlayer` (hız, sürükleme, ses; `videoControls.ts` testli), `blinkr://posts/{id}` bağlantısı (`deepLinks.ts`, `app.json` scheme). Karar: D-025 |

## V2-3 hikayeler: bitti (2026-09-24)
Hikaye beğenisi (sunucu + `StoryLiked` bildirimi), görüntüleyicide kalp, 6 hızlı emoji (DM), küp geçiş, aşağı kaydırıp kapatma, sonraki kişinin ön yüklenmesi, görüntüleyenlerde kalp. Karar: D-026. Kabul: `test-story-likes.ps1` ve `test-stories.ps1` PASS; tüm mobil testler ve iOS/Android export yeşil.

## V2-4 tepkiler, mention, hashtag: bitti (2026-09-24)
Emoji tepkileri (tek olay, zaman damgalı projeksiyon), yorum beğenisi, sunucu tarafı @mention + bildirim + öneri, #hashtag akışı ve arama, `RichText`. Karar: D-027. Kabul: `test-reactions.ps1`, `test-mentions-hashtags.ps1` PASS; regresyonlar ve tüm mobil testler yeşil. Worker Docker'da çalışır: kodu değişince `docker compose up -d --build projections-worker`.

## V2-5 gerçek zamanlılık: bitti (2026-09-25)
SignalR hub (`/hubs/realtime`), olaylar yalnız "değişti" der, uygulama REST'ten yeniler (D-028). Sohbet, yazıyor, okundu, yorum, tepki, bildirim canlı; hub yokken eski yoklama. Kabul: `test-realtime.ps1` PASS, regresyonlar yeşil.

## V2-6, V2-7, V2-8: bitti (2026-09-25)
| Commit | İçerik |
|---|---|
| c599502 | V2-6: Instagram düzeninde Keşfet kartı, yalnız görünen kartın videosu oynar, görülme sayımı, "#" etiket araması, profil ızgarasında video işareti |
| 6e05de2 | V2-7: paylaşım menüsü (bağlantı kopyala, diğer uygulamalar, sohbet), gruplu bildirimler (D-029), Etkinlik "Yeni" bölümü |
| (bu commit) | V2-8: API-SPEC/PROGRESS/HANDOFF kapanış, ZIP yeniden |

## Sıradaki
V2 planı tamam. Kalanlar yalnız cihaz doğrulamaları (aşağıda). Sonra: iki fiziksel cihazla çekirdek döngü kabulü (kök CLAUDE.md §19.3), Push bildirimi (APNs/FCM anahtarı gerekir: kullanıcı kararı), çok örnekli SignalR için Redis backplane.

## Backend notları
- Backend `start-blinkr-dev.ps1` ile; worker Docker'da (kodu değişince script imajı yeniden kurar).
- Kabul betiklerini arka arkaya çok kez koşmak kayıt/paylaşım hız sınırına (429) takılır; tek koşu PASS.
- Yerel LAN IP şu an `192.168.1.37` (`npm run start:lan` kendisi bulur).

## Cihazda doğrulanacaklar
- Gerçek zaman: cihazda WebSocket bağlantısı, uçak modu → geri gelince yeniden bağlanma, arka plandan dönüş
- Tepki: beğeniye uzun basınca seçici (iOS/Android), metindeki @ad/#etiket dokunuşunun kartı açmaması
- Hikaye: küp geçişin ve aşağı çekmenin akıcılığı, kaydırmanın dokunma bölgeleriyle çakışmaması
- Video oynatma: sürükleme, hız, ses
- Kartın tam sayfaya büyümesi (sürükleme akıcılığı, Android geri tuşu)
- `blinkr://posts/{id}` bağlantısının açılması
- Koyu tema ve alt çubuğun görünümü

## Kurallar (değişmedi)
- `api.ts` içindeki yerel IP commit'lenmez: commit öncesi `.106`, sonra `.35`.
- `git add -A` sonrası şu özel dosyalar `git reset` ile dışarıda bırakılır: `BLINKR_UYGULAMA_PLANI.md`, `docs/BLINKR_MASTER_VIZYON_URUN_VE_BETA.md`, `docs/blinkr_tema_kod/`, `docs/new/`, `docs/blinkr-devam-plani/`.
- Commit sonuna `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Metin yalnız `tx()` ile, tr+en.
- Renkler yalnız `theme.ts` token'larından.
