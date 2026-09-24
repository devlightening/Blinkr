# DATABASE — migration kuralları

## 1. PostgreSQL (EF Core)
```powershell
cd src\Services\IdentityService
dotnet ef migrations add V2_<Ad> -p IdentityService.Infrastructure -s IdentityService.Api
dotnet ef database update -p IdentityService.Infrastructure -s IdentityService.Api   # geliştirmede; servis açılışta da uygular
```
Kurallar: sütun eklerken nullable ya da varsayılanlı; sütun silme iki adımda (önce kod kullanmayı bırakır, bir
sürüm sonra migration); **veri silen migration kullanıcı onayı ister**. V2 Identity şeması değişmiyor.

## 2. MongoDB (şemasız, kodla yönetilir)
- Yeni alan: C# belgesinde varsayılan değerle eklenir (`public Dictionary<string,int> ReactionCounts { get; set; } = new();`).
  Eski belgeler okunurken varsayılan alır; `[BsonIgnoreExtraElements]` tüm belgelerde açık.
- Geri doldurma (backfill) gerekiyorsa `BackgroundService`, parti parti (1000), idempotent, istisna yutmaz ama
  host'u da düşürmez (mevcut `PlaceSearchBackfillService` kalıbı).
  - V2 `HashtagBackfillService`: `Hashtags` alanı olmayan gönderiler için metinden çıkarım.
  - V2 `ReactionCounts`: `LikeCount > 0 && ReactionCounts boş` → `{"❤️": LikeCount}`.
- İndeksler açılışta `CreateIndexesAsync` ile (idempotent) — bkz. `indexes.md`.

## 3. EventStore (olay sürümleme)
- Olaylar **değiştirilmez**; yalnız yeni isteğe bağlı alan eklenir. Deserialize sırasında eksik alan = null/varsayılan.
- Anlam değişirse yeni olay türü (`PostCommentLiked`), eski olay sonsuza dek okunabilir kalır.
- Integration event'ler (`Shared.Events`) de aynı kural; tüketiciler bilinmeyen alanı yok sayar.
- Projeksiyon yeniden kurma: worker checkpoint'i sıfırlanıp akış yeniden oynatılabilir (read model silinmeden
  önce yedek; bu işlem kullanıcı onayı ister).

## 4. V2 değişiklik listesi
| Depo | Değişiklik | Geri doldurma |
|---|---|---|
| EventStore | PostLiked.Reaction?, PostCreated/CommentAdded.MentionedUserIds?, PostCommentLiked/Unliked | yok |
| Mongo posts | ReactionCounts, Reactions, Hashtags, Mentions, Comments[].LikeCount/LikedBy/Mentions | Hashtag + ReactionCounts |
| Mongo notifications | GroupKey, Actors, ActorCount, UpdatedAtUtc | yok (eskiler tekil kalır) |
| Mongo stories | Likes | yok |
| Mongo chat_messages | Kind `story_reply`, Story | yok |
