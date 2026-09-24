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

## Sıradaki
V2-4 (emoji tepkileri, yorum beğenisi, mention, hashtag), sonra V2-5 (SignalR), V2-6 (Keşfet/profil cilası), V2-7 (paylaşım menüsü + Etkinlik ekranı), V2-8 (kapanış + ZIP yeniden).

## Cihazda doğrulanacaklar
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
