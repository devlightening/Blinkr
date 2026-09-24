# 06 — Bildirimler (Etkinlik)

## Türler
| type | Tetikleyen olay | Metin (tr) | Hedef |
|---|---|---|---|
| `reaction` | PostLiked | "**ayse** gönderine 🔥 bıraktı" | gönderi |
| `comment` | PostCommentAdded (kök) | "**mert** yorum yaptı: …" | gönderi, yorum |
| `reply` | PostCommentAdded (yanıt) | "**elif** yorumuna yanıt verdi: …" | gönderi, yorum |
| `mention` | PostCreated / PostCommentAdded | "**ayse** senden bahsetti: …" | gönderi |
| `comment_like` | PostCommentLiked | "**mert** yorumunu beğendi" | gönderi |
| `follow` / `follow_request` | Identity follow olayları | "**elif** seni takip etmeye başladı" | profil |
| `story_like` / `story_reply` | Stories | "**ayse** hikayeni beğendi" | hikaye / sohbet |

Kişi kendi eylemi için bildirim almaz; engelli kişiden bildirim üretilmez.

## Toplama (gürültü azaltma)
Aynı hedef + tür için 1 saat içinde gelenler tek satırda birleşir: "**ayse**, **mert** ve 3 kişi daha gönderine tepki
verdi". Uygulama: bildirim belgesinde `GroupKey = $"{type}:{targetId}"`, `Actors` (son 3), `ActorCount`,
`UpdatedAtUtc`; yeni olay aynı grup açıksa (`UpdatedAtUtc > now-1h`) günceller (upsert), yoksa yeni belge.

## Ekran
`activity/ActivityScreen` Keşfet başlığındaki kalp/zil ile açılır. Bölümler Yeni / Bugün / Bu hafta / Daha eski.
Satır: avatar (grupta üst üste 2), metin (ad kalın), göreli zaman, sağda 44 pt medya önizlemesi ya da
"Takip et / Geri takip et" düğmesi. Açılınca `POST /api/notifications/read`.
Rozet: alt bar Keşfet'te nokta; sayı `notification.created` ile canlı güncellenir.

## Push (ertelendi)
APNs/FCM anahtarları ücretli/secret → MVP sonrası. `POST /api/subscriptions` jeton kaydı zaten var.

## Kabul
- [ ] Sahne `activity` (gruplu satırlar, boş durum).
- [ ] `scripts/test-notifications.ps1` (varsa genişletilir): tepki → bildirim, gruplama, okundu.
