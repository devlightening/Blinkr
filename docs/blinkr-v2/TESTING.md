# TESTING

## Piramit
| Katman | Araç | Ne test edilir | Komut |
|---|---|---|---|
| Saf mantık (mobil) | tsc + node assert (`scripts/*.test.ts`) | sıralama, ayrıştırma (`richText`), sohbet düzeni, hikaye durumu, tepki sayımı | `npm run test:nearby` |
| Tema | `theme-contrast.test.ts` | AA kontrast iki temada, gradyan üstü metin, ölçek kuralları | `npm run test:theme` |
| i18n | `i18n-scan.cjs` + anahtar eşitliği | kodda metin kalmaz, tr/en eşit | `npm run test:i18n` |
| Bileşen (tarayıcı) | react-native-web + Playwright (`scripts/ui-test.cjs`) | sahneler render, etkileşim, ekran görüntüsü | `npm run test:ui` |
| Tip | tsc | tüm istemci | `npm run typecheck` |
| Native derleme | expo export | iOS/Android paket derlenir | `npx expo export --platform ios` |
| Backend birim | xUnit (varsa) | aggregate kuralları | `dotnet test` |
| Kabul (uçtan uca API) | PowerShell `scripts/test-*.ps1` | gerçek servisler + Gateway | aşağıda |
| E2E (cihaz) | Maestro `e2e/maestro` | kritik akışlar | `maestro test e2e/maestro` |
| Fiziksel | iki cihaz (kök CLAUDE.md §19.3) | GPS, dokunma, kamera | elle |

## V2 yeni testler
- Saf: `rich-text.test.ts` (mention/hashtag regex, Türkçe harf, e-posta mention sayılmaz), `reactions.test.ts`
  (değiştir/kaldır/sayım), `story-navigation.test.ts` (dokunma bölgesi → segment/kişi geçişi), `post-sheet.test.ts`
  (durak seçimi: konum + hız → kart/tam/kapat).
- Tarayıcı sahneleri: `bottom-bar-dark`, `signal-card-full`, `video-player`, `story-tray`, `story-viewer`,
  `story-cube`, `reaction-picker`, `mention-suggest`, `activity`, `feed-ig`.
- Kabul: `test-reactions.ps1`, `test-mentions-hashtags.ps1`, `test-story-likes.ps1`, `test-realtime.ps1`
  (Node `@microsoft/signalr` ile küçük istemci `scripts/realtime-probe.cjs`).

## Regresyon seti (her faz)
`test-product-08.ps1`, `test-signal-card.ps1`, `test-chat-thread.ps1`, `test-location-map-core.ps1`,
`test-reliable-event-delivery.ps1`, `test-safety.ps1`, `test-friends.ps1`, `test-auth-gateway-smoke.ps1`.

## Kurallar
- Gateway kapalıyken entegrasyon testi PASS raporlanmaz.
- Fixture testi gerçek katalog kabulünün yerine geçmez.
- Cihaz gerektiren kabul `[~]` kalır, otomasyonla kanıtlanmış gibi yazılmaz.
