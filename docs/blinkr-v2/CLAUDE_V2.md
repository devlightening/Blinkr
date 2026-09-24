# CLAUDE_V2 — bu paketle çalışma kuralları

Kök `CLAUDE.md` geçerlidir; bu dosya V2 için eklenenleri ve öncelikleri söyler.

## Öncelik
1. **Çalışan MVP.** Güvenlik sertleştirmesi (TLS, CORS, rate limit, secret store) V2 kapsamı dışında; yeni kod
   yine de mevcut korumaları (JWT doğrulama, engel kontrolü, sunucu-tarafı yakınlık) **bozmaz**.
2. **Mimari korunur.** Yeni yazma yolu EventStore'u atlamaz; olay değişirse üretici → publisher → worker →
   read model → DTO → mobil tip zinciri birlikte güncellenir (bkz. `ARCHITECTURE.md` §4).
3. **SOLID.** Controller ince (doğrulama + MediatR/servis çağrısı), iş kuralı Application/Domain'de, dış
   bağımlılık arayüz arkasında (`IBlockGuard`, `IFollowGraph`, `IRealtimePublisher`…). Yeni sınıf tek sorumluluk.
4. **Ekranda görünmek = bitti.** Her görev tarayıcı sahnesiyle (`scripts/ui-scenes.tsx`) ekran görüntüsü alınarak
   doğrulanır; cihaz gerektiren kısım `[~]` bırakılır.

## Değişmeyen depo kuralları
- `src/Clients/Blinkr.Expo/src/api.ts` içindeki yerel IP commit'lenmez (commit öncesi `.106`, sonra `.35`).
- `git add -A` sonrası: `git reset -q -- BLINKR_UYGULAMA_PLANI.md docs/BLINKR_MASTER_VIZYON_URUN_VE_BETA.md docs/blinkr_tema_kod/ docs/new/ docs/blinkr-devam-plani/`
- Commit sonu `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, her commit sonrası push.
- Kullanıcı metni yalnız `tx('ns:anahtar', 'Türkçe')` + `locales/en`; `npm run test:i18n` 0 bulgu.
- Renk/ölçü/yarıçap/gölge yalnız `src/theme.ts` token'ları; UI dosyasında ham hex yok.
- Koordinat, token, şifre loglanmaz.
- Test verisini toplu silme kullanıcı onayı ister; etrafından dolaşılmaz.

## Faz bitiş kontrol listesi
```
[ ] kod + i18n (tr/en)
[ ] npm run typecheck / test:theme / test:nearby / test:product / test:i18n / test:ui
[ ] npx expo export --platform ios && --platform android
[ ] dotnet build Blinkr.sln (backend değiştiyse) + ilgili scripts/test-*.ps1
[ ] ekran görüntüsü (koyu + açık)
[ ] PROGRESS_V2.md + DECISIONS.md (sapma varsa) + CLAUDE.md (davranış değiştiyse)
[ ] commit + push
```
