# 03 — Hikayeler (Instagram birebir)

## Kapsam
24 saat yaşayan foto (3/5/10 sn) ve video (kendi süresi, ≤ 60 sn) hikayeler; yalnız yazar ve onaylı takipçiler
görür; konum taşımaz. Mevcut: `/api/stories` (oluştur, tepsi, kullanıcının hikayeleri, içerik, görüldü,
görüntüleyenler, sil), `StoryTray`, `StoryViewer`. V2: Instagram davranış eşliği + beğeni + emoji yanıt.

## Tepsi
- Keşfet'in en üstünde. Sıra: "Hikayen" → görülmemiş (en yeni önce) → görülmüş.
- Halka: görülmemiş `gradients.story`, görülmüş `storySeen`, hikayen yoksa avatar + küçük gradyan "+" rozeti.
- Dokun → görüntüleyici o kişiden başlar. "Hikayen"e uzun basma → yeni hikaye (kamera).

## Görüntüleyici davranışları
| Hareket | Instagram davranışı | Blinkr uygulaması |
|---|---|---|
| Sağ ⅔'e dokun | sonraki segment; son segmentse sonraki kişi | aynı |
| Sol ⅓'e dokun | önceki segment; ilk segmentse önceki kişi | aynı |
| Basılı tut | duraklat, krom gizlenir | aynı (150 ms sonra krom solar) |
| Yatay kaydır | küp geçişle kişi değiştir | `rotateY` ±90°, `perspective: 800`, parmağı izler, %35 veya 600 pt/s ile geçer |
| Aşağı kaydır | kapat (küçülerek) | ölçek 1 → 0.85 + opaklık, 150 pt eşik |
| Yukarı kaydır (kendi) | görüntüleyenler | sheet: ad, zaman, ♥ işareti |
| Mesaj alanı odak | duraklat, hızlı emojiler görünür | 6 emoji + ♥ |
| Ses | video sesli başlar (sessiz modda sessiz) | `expo-video` `muted` sistem sessiz anahtarını izler |

İlerleme: foto için `durationSeconds`, video için `player.duration`; ara yüklemede (buffer) ilerleme durur.
Ön yükleme: sonraki segmentin medyası ve sonraki kişinin ilk segmenti arka planda indirilir (`Image.prefetch`,
video için `VideoPlayer` önceden oluşturma).

Küp geçiş (reanimated, özet):
```ts
const pageStyle = (index: number) => useAnimatedStyle(() => {
  const offset = index - position.value;                 // position: kesirli kişi indeksi, parmağı izler
  const rotateY = interpolate(offset, [-1, 0, 1], [-90, 0, 90], Extrapolation.CLAMP);
  const translateX = offset * width;
  return {
    transform: [{ perspective: 800 }, { translateX }, { rotateY: `${rotateY}deg` },
                { translateX: offset > 0 ? -width / 2 : width / 2 }, { translateX: offset > 0 ? width / 2 : -width / 2 }],
    backfaceVisibility: 'hidden',
  };
}, [position]);
```
Hareketi Azalt: küp yerine düz yatay kayma.

## Sunucu (V2)
```csharp
// StoryModels.cs
public class StoryDocument { /* … */ public List<StoryLike> Likes { get; set; } = new(); }
public class StoryLike { public Guid UserId { get; set; } public DateTime LikedAtUtc { get; set; } }
public record StoryViewerDto(Guid UserId, string UserName, DateTime SeenAtUtc, bool Liked);

// StoriesController.cs
[HttpPost("{id}/like")]   public Task<IActionResult> Like(string id, CancellationToken ct);    // idempotent, $addToSet
[HttpDelete("{id}/like")] public Task<IActionResult> Unlike(string id, CancellationToken ct);  // $pull
[HttpPost("{id}/reply")]  public Task<IActionResult> Reply(string id, StoryReplyRequest body, CancellationToken ct);
```
- Yetki: `CanView(story, viewer)` (yazar ya da onaylı takipçi, engel yok) — mevcut kontrol yeniden kullanılır.
- Beğeni yazara bildirim üretir (`story_like`), kendi hikayesi 400 `SELF`.
- Yanıt: yazarla konuşmayı bul/oluştur, `kind: "story_reply"` mesajı (hikaye id + küçük önizleme anahtarı), engel → 403.
- Beğeni/yanıt 24 saat sonra hikaye silinse de DM'de "Hikaye artık yok" olarak kalır.

## Oluşturma
(+) → kamera → çek/galeriden seç → düzenleyici (lens, yazı, çıkartma) → "Hikayen" hedefi → yükle (arka plan
giden kutusu, mevcut `shareOutbox`). Günlük sınır mevcut (429 `TOO_MANY_STORIES`).

## Kabul
- [ ] Sahneler: `story-tray` (3 halka durumu), `story-viewer` (segment, krom, yanıt alanı), `story-cube` (yarı geçiş).
- [ ] `scripts/test-story-likes.ps1`: beğen/geri al idempotent, yabancı 403, görüntüleyenlerde `liked`, yanıt DM oluşturur.
- [~] Cihaz: küp geçiş 60 fps, basılı tut, ses.
