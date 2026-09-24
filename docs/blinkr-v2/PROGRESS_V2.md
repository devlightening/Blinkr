# PROGRESS_V2

| Alan | Değer |
|---|---|
| Dal | `feat/blinkr-theme-redesign` |
| Aktif faz | V2-3 |
| Son güncelleme | 2026-09-24 |

İşaretler: `[x]` bitti ve ekranda doğrulandı · `[~]` kısmen / cihaz bekliyor · `[ ]` yapılmadı · `[-]` bilinçli ertelendi

## V2-1 Koyu tema + gradyan + alt bar
- [x] 1.1 Koyu varsayılan (kullanıcı seçimi > koyu), zemin #0E0F12, kart #17191D
- [x] 1.2 `gradients.brand` / `gradients.story` token'ları + `expo-linear-gradient`
- [x] 1.3 `ui/GradientRing`; gradyan düğme = `BlinkrButton variant="create"` (ayrı bileşen gereksizdi)
- [x] 1.4 Alt bar: Harita · Keşfet · (+) · Mesaj · Profil (avatar), gradyan (+)
- [x] 1.5 Sekme geçiş animasyonu (180 ms solma, Hareketi Azalt'a uyar)
- [x] 1.6 `test:theme` gradyan kontrastı

## V2-2 Post görüntüleyici
- [x] 2.1 Kart → tam sayfa (yukarı sürükle / Genişlet), iki durak
- [x] 2.2 Tam sayfa: kart + açıklama + tüm yorumlar + sabit giriş (`SignalThreadPanel fill`, ayrı `PostFullView` gerekmedi, D-025)
- [-] 2.3 `useComments` hook'u — gerek kalmadı, aynı panel yeniden kullanıldı (D-025)
- [~] 2.4 `VideoPlayer` (kod + saf testler; video oynatma/sürükleme cihazda doğrulanacak): oynat/duraklat, ilerleme sürükleme, hız 0.5–2x, sessiz, tam ekran
- [x] 2.5 Derin bağlantı `blinkr://posts/{id}` (bildirimlerle aynı biçim)

## V2-3 Hikayeler
- [x] 3.1 Tepsi: gradyan halka (görülmemiş), gri (görülmüş), "Hikayen +"
- [ ] 3.2 Görüntüleyici: küp geçiş, aşağı kaydır-kapat, ön yükleme
- [ ] 3.3 Beğeni (♥) + emoji hızlı yanıt (DM olarak)
- [ ] 3.4 Sunucu: `POST/DELETE /api/stories/{id}/like`, görüntüleyenlerde kalp
- [ ] 3.5 Kabul: `test-story-likes.ps1`

## V2-4 Tepkiler, mention, hashtag
- [ ] 4.1 Emoji tepkileri (olay zinciri)
- [ ] 4.2 Yorum beğenisi
- [ ] 4.3 @mention otomatik tamamlama + bildirim
- [ ] 4.4 #hashtag çıkarımı + `GET /api/discover/hashtag/{tag}`
- [ ] 4.5 `RichText` bileşeni
- [ ] 4.6 Kabul: `test-reactions.ps1`, `test-mentions-hashtags.ps1`

## V2-5 Gerçek zamanlılık
- [ ] 5.1 `/hubs/realtime` + Gateway WebSocket route
- [ ] 5.2 Sohbet olayları (mesaj, yazıyor, okundu)
- [ ] 5.3 Canlı yorum + bildirim
- [ ] 5.4 İstemci `realtime.ts` + yoklamaya geri düşüş
- [ ] 5.5 Kabul: `test-realtime.ps1`

## V2-6 Keşfet ve profil
- [ ] 6.1 IG kart düzeni, çoklu medya karuseli, çift dokunma kalp
- [ ] 6.2 Profil 3 sütun ızgara, video işareti
- [ ] 6.3 Hashtag araması

## V2-7 Paylaşım ve Etkinlik
- [ ] 7.1 Paylaşım menüsü (sohbet, sistem, bağlantı kopyala)
- [ ] 7.2 Etkinlik ekranı (gruplu bildirimler)

## V2-8 Kapanış
- [ ] 8.1 CLAUDE.md / API-SPEC güncel
- [ ] 8.2 ZIP yeniden üretildi

## Oturum günlüğü
_(her fazın sonunda: yapılanlar, doğrulama, kalanlar)_
