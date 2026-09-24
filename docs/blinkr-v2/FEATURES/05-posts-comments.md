# 05 — Gönderi, yorum, tepki, mention, hashtag, paylaşım

## 1. Yorumlar
Mevcut: ekle (≤ 500), tek seviye yanıt (`parentCommentId`), sil (yorum ya da gönderi sahibi; yanıtlar da gider),
sıralama newest/oldest, anonim gönderide yazarın yorumu "Paylaşan".

**İç içe yanıt kararı:** Instagram gibi **görsel olarak tek seviye**. Yanıta yanıt verilince `parentCommentId` kök
yoruma eşitlenir, metnin başına `@ad` eklenir ve o kişi mention olarak işaretlenir. Böylece sonsuz derinlik yok,
konuşma yine takip edilebilir.
```ts
// src/hooks/useComments.ts (V2)
export function useComments(postId: string) {
  const [state, setState] = useState<{ items: CommentNode[]; loading: boolean; error?: string }>({ items: [], loading: true });
  const add = async (text: string, replyTo?: CommentNode) => {
    const parentCommentId = replyTo ? (replyTo.parentCommentId ?? replyTo.id) : undefined;
    const optimistic = makeOptimistic(text, parentCommentId);
    setState((s) => ({ ...s, items: insertComment(s.items, optimistic) }));
    try { const saved = await api.addComment(postId, { commentText: text, parentCommentId, mentionedUserIds: pickMentions(text) });
          setState((s) => ({ ...s, items: replaceComment(s.items, optimistic.id, saved) })); }
    catch (e) { setState((s) => ({ ...s, items: removeComment(s.items, optimistic.id), error: toMessage(e) })); }
  };
  useRealtime(`post:${postId}`, { 'comment.added': (c) => setState((s) => ({ ...s, items: insertComment(s.items, c) })) });
  // load, loadMore, remove, like …
  return { ...state, add /* … */ };
}
```
Yanıtlar kök yorumun altında ilk 2'si görünür, "N yanıtı gör" ile açılır.

## 2. Yorum beğenisi (V2)
Olaylar `PostCommentLiked { PostId, CommentId, UserId }` / `PostCommentUnliked`. Aggregate: yorum başına
`HashSet<Guid> Likers`. Read model `comments[i].likeCount`, `likedBy` (yalnız `likedByMe` için sorguda kullanılır,
API'de liste dönmez). Kendi yorumu beğenilebilir (IG davranışı).

## 3. Emoji tepkileri (V2)
- Set (`ReactionCatalog`): ❤️ 🔥 😂 😮 😢 👏. Kişi başı tek tepki; aynı emoji tekrar → kaldır; farklı → değiştir.
- Olay geriye uyumlu: `PostLikedEvent` + `string? Reaction` (null = ❤️). Değiştirme = `PostUnliked` + `PostLiked(r)`.
- Read model: `ReactionCounts: Dictionary<string,int>`, `LikeCount` = toplam (eski istemciler çalışır).
- `/likes` ucu kalır (❤️ aç/kapa).

## 4. @mention ve #hashtag
Ayrıştırma (hem istemci hem sunucu aynı kural):
```
mention:  (?<![\w@])@([a-z0-9_.]{3,30})      → kullanıcı adı
hashtag:  (?<![\w#])#([\p{L}\p{N}_]{2,40})    → Türkçe harfler dahil; saklanırken PlaceSearchText.Fold ile küçük/aksansız
```
- İstemci `@` yazınca `/api/users/search?q=` (300 ms debounce, arkadaş/takip önce) öneri listesi gösterir; seçim
  `mentionedUserIds`'e eklenir. Sunucu yalnız metinde gerçekten geçen ve engelsiz kullanıcıları kabul eder, ≤ 10
  (fazlası 400 `TOO_MANY_MENTIONS`).
- Anonim (`AnonymousMap`) gönderide mention bildirimi yazarı açık etmez: "Biri seni bir sinyalde etiketledi".
- Hashtag'ler worker tarafından `posts.Hashtags` (dizi, indeksli) alanına yazılır. `GET /api/discover/hashtag/{tag}`.
- `RichText` bileşeni: mention → `UserProfileSheet`, hashtag → etiket akışı ekranı.

## 5. Paylaşım
| Seçenek | Davranış |
|---|---|
| Sohbette gönder | mevcut `kind: "signal"` mesajı, kişi seçici |
| Bağlantıyı kopyala | `blinkr://posts/{id}` (web alan adı gelince https) |
| Diğer uygulamalar | RN `Share.share({ message, url })` |
| Hikayene ekle (sonra) | gönderi kartı çıkartmasıyla hikaye |
Anonim gönderinin paylaşımı yazar bilgisi taşımaz.

## 6. Moderasyon ilişkisi
Yorum, açıklama, hikaye yazısı `ContentTextFilter`'dan geçer (mevcut); mention/hashtag metni de aynı süzgeçten.
Yorum ve kullanıcı bildirme mevcut `ReportPanel`.

## Kabul
- [ ] `scripts/test-reactions.ps1`: tepki ekle/değiştir/kaldır, sayılar, kendine tepki 400, eski `/likes` uyumlu.
- [ ] `scripts/test-mentions-hashtags.ps1`: mention bildirimi, engelli kişi mention edilemez, hashtag akışı.
- [ ] Sahneler: yorum listesi + yanıtlar, mention önerisi, tepki balonu.
