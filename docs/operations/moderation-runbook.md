# Moderasyon ve destek işletim rehberi

> plan-devam F7 / 11_SAFETY §7: "Raporlara 24 saat içinde müdahale taahhüdü (süreç dokümante)". Bu belge o süreçtir.
> Yayından önce sorumlu kişi(ler) ve destek adresi doldurulmalıdır (D-021: `{{DESTEK_EPOSTA}}`).

## Taahhüt

- Her kullanıcı raporu **24 saat içinde** incelenir ve karara bağlanır.
- Ağırlıklı raporu 3'e ulaşan sinyal zaten otomatik gizlenir (BLK-MODERATION-01); 24 saat içinde bir moderatör ya
  geri açar (`restore`) ya da kalıcı kaldırır (`remove`).
- Kendine zarar verme bildirimi (`self_harm`) en üst önceliktir: uygulama kişiye 112'yi zaten gösterir; moderatör aynı
  gün içinde bakar.

## Günlük akış (en az günde iki kez: 09:00 ve 21:00)

1. Kuyruğu aç: `.\scripts\moderation.ps1 queue -Email <moderatör>` (Admin rolü: `.\scripts\make-admin.ps1`).
2. En eski rapordan başla. Her hedef için karar ver:
   - Sinyal: `dismiss` (sorun yok) · `hide` · `restore` · `remove`
   - Kişi: `dismiss` · `warn` · `restrict_24h` · `suspend_7d` · `ban`
   - `.\scripts\moderation.ps1 resolve -Email <moderatör> -TargetType signal|user -TargetId <id> -Action <karar> -Note "<kısa gerekçe>"`
3. Her karar `ModerationActions` denetim izine yazılır (`.\scripts\moderation.ps1 actions`). Gerekçe notu zorunlu kabul edilir.
4. Kişiye yaptırım bildirimi uygulamada otomatik gider (bildirim tüketicisi).

## İtiraz

- İtirazlar destek adresine gelir (`{{DESTEK_EPOSTA}}`, yasal metinlerde ve kurallarda yazılı).
- İtiraz 72 saat içinde, ilk kararı vermeyen bir moderatörce incelenir; karar değişirse `restore` veya daha hafif
  yaptırım uygulanır ve denetim izine not düşülür.

## Veri talepleri ve hesap silme

- "Verilerimi iste" talepleri Identity `DataRequests` tablosuna düşer (durum `received`). 30 gün içinde kişinin
  e-postasına verilerinin kopyası gönderilir; gönderince durum `sent` yapılır. (MVP'de otomatik dışa aktarma yok.)
- Hesap silme otomatiktir: 30 günlük bekleme sonunda `AccountPurgeService` `UserDeleted` olayını yayınlar; Blog,
  Notifications ve (PostDeleted üzerinden) Place/projeksiyon verisi silinir. Kalan tek iz: EventStore olay geçmişi
  (bkz. D-021) — kalıcı silme için akış tombstone + scavenge işlemi planlanmalıdır.

## Acil durum

- Yakın tehlike, çocuk istismarı veya ciddi tehdit içeren içerik: içeriği hemen `remove`, hesabı `ban`, ve yasal
  yükümlülüklere göre yetkili makamlara bildir. Kanıtı denetim izindeki kimliklerle sakla; içeriği yeniden paylaşma.
