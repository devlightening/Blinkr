# PROGRESS_V2

| Alan | Değer |
|---|---|
| Dal | `feat/blinkr-theme-redesign` |
| Aktif faz | V2-6 |
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
- [~] 3.2 Görüntüleyici: küp geçiş (yana kaydırma, Hareketi Azalt'ta düz kayma), aşağı kaydır-kapat (küçülerek, arkası görünür), sonraki kişinin ön yüklenmesi — tarayıcıda doğrulandı, native dokunuş/akıcılık cihazda bekliyor
- [x] 3.3 Beğeni (♥, iyimser, hata olursa geri alır) + 6 emoji hızlı yanıt (hikaye yanıtı DM'i olarak)
- [x] 3.4 Sunucu: `POST/DELETE /api/stories/{id}/like`, görüntüleyenlerde kalp (beğenenler üstte), yazara bir kez `StoryLiked` bildirimi
- [x] 3.5 Kabul: `test-story-likes.ps1` (BLK-STORY-LIKES-01 PASS) + `test-stories.ps1` regresyon PASS

## V2-4 Tepkiler, mention, hashtag
- [x] 4.1 Emoji tepkileri (olay zinciri): `PostLikedEvent.Reaction/Replaces`, `POST /api/posts/{id}/reactions`, worker zaman damgalı projeksiyon, uzun bas = 6 emoji (D-027)
- [x] 4.2 Yorum beğenisi: `PostCommentLiked/UnlikedEvent`, `POST .../comments/{cid}/like`, yorumda kalp + sayı (kendi yorumun da)
- [x] 4.3 @mention: sunucu metinden çözer (Identity `POST /api/users/resolve`, engelli/silinmiş düşer, >10 = 400), `Mentioned` bildirimi (anonimde isimsiz), yorum ve composer'da "@" önerisi
- [x] 4.4 #hashtag: worker `posts.Hashtags` (katlanmış), `GET /api/discover/hashtag/{tag}` (7 gün, anonim yok) + `hashtags/search`, Keşfet içinde etiket akışı
- [x] 4.5 `ui/RichText` (+ `richText.ts`, sunucuyla aynı kural; yalnız çözülmüş @ad bağlantı)
- [x] 4.6 Kabul: `test-reactions.ps1` (BLK-REACTIONS-01) ve `test-mentions-hashtags.ps1` (BLK-MENTIONS-01) PASS

## V2-5 Gerçek zamanlılık
- [x] 5.1 `/hubs/realtime` (NotificationsService, JWT `?access_token=` yalnız `/hubs` için) + Gateway `realtime-route`
- [x] 5.2 Sohbet olayları: `message.created/updated/read`, `typing` (yalnız karşı tarafa), tek `RealtimeChatFilter` ile
- [x] 5.3 Canlı yorum/tepki (`post:{id}` odası, `JoinPost` BlogService görünürlük kontrolüyle) + `notification.created` (depo dekoratörü)
- [~] 5.4 İstemci `realtime.ts` + `useRealtime` + yoklamaya geri düşüş (bağlıyken 30 sn güvenlik yoklaması) — tarayıcı/Node ile doğrulandı; cihazda uçak modu → yeniden bağlanma bekliyor
- [x] 5.5 Kabul: `test-realtime.ps1` (BLK-REALTIME-01) PASS; `test-chat-thread/plus/smoke`, `test-log-privacy` regresyon PASS

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

### 2026-09-25 — V2-5 Gerçek zamanlılık
- Yapılan: SignalR hub (NotificationsService `/hubs/realtime`, Gateway üzerinden), olaylar yalnız kimlik taşır ve uygulama REST'ten yeniler (D-028); sohbet, yazıyor, okundu, yorum, tepki, bildirim canlı; istemci `realtime.ts`/`useRealtime.ts`/`realtimePolicy.ts`, bağlıyken yoklama 30 sn'ye iner, kopunca eski hıza döner; arka planda 30 sn sonra kapanır.
- Doğrulama: `test-realtime.ps1` PASS (mesaj < 1 sn), sohbet regresyonları, `test-log-privacy` (token URL'de ama loglarda yok), `test-auth-gateway-smoke`, `test-product-08` PASS; mobil `typecheck`, `test:nearby` (yeni `realtime-policy.test.ts`), `test:theme`, `test:product`, `test:i18n`, `test:ui`, iOS/Android export.
- Cihazda: gerçek cihazda WebSocket bağlantısı, uçak modu → geri gelince yeniden bağlanma, arka plandan dönüş.

### 2026-09-24 — V2-4 Tepkiler, mention, hashtag
- Yapılan: emoji tepkileri, yorum beğenisi, @mention (sunucu çözümü + bildirim + öneri), #hashtag (çıkarım, akış, arama), `RichText`, `ReactionButton`, `MentionSuggestions`; hesap silme yorum beğenilerini de kaldırıyor (D-027).
- Doğrulama: `test-reactions.ps1`, `test-mentions-hashtags.ps1` PASS; regresyon `test-post-engagement`, `test-safety`, `test-place-live-signal`, `test-stories`, `test-story-likes`, `test-auth-gateway-smoke`, `test-reliable-event-delivery`, `test-account-lifecycle`, `test-product-08` PASS; mobil `typecheck`, `test:nearby` (yeni `rich-text.test.ts`), `test:theme`, `test:product`, `test:i18n`, `test:ui` (tepki seçici, yorum beğenisi, @ önerisi, etiket akışı), iOS/Android export.
- Cihazda: uzun basma ile seçici açılması (iOS/Android), iç içe `Text onPress` bağlantılarının dokunmayı kartın geri kalanına geçirmemesi.

### 2026-09-24 — V2-3 Hikayeler
- Yapılan: hikaye beğenisi uçları + bildirim (D-026), görüntüleyicide kalp, 6 hızlı emoji, küp geçiş, aşağı kaydırıp kapatma, sonraki kişinin ön yüklenmesi; görüntüleyenlerde kalp; `StoryLiked` bildirimi kişiyi açar.
- Doğrulama: `test-story-likes.ps1` PASS, `test-stories.ps1` PASS, `typecheck`, `test:nearby` (yeni: beğeni, sıralama, kaydırma, emoji), `test:theme`, `test:product`, `test:i18n`, `test:ui` (beğeni, emoji DM, kalpli görüntüleyenler, sola kaydırınca sonraki kişi, aşağı kaydırınca kapanma), iOS/Android export.
- Cihazda: küp geçişin ve aşağı çekmenin akıcılığı, iOS'ta kaydırmanın dokunuşla çakışmaması.
