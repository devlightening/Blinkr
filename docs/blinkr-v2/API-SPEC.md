# API-SPEC

Taban: `http://<gateway>:5080`. Tüm istekler `Authorization: Bearer <access>` (aksi belirtilmedikçe).
Hata gövdesi: `{ "code": "UPPER_SNAKE", "message": "..." }`. Tarihler ISO-8601 UTC. Sayfalama `page` (1'den) + `pageSize`.
**V2** etiketli uçlar yeni; diğerleri çalışıyor.

## 1. Kimlik (IdentityService)
| Yöntem | Yol | Gövde / sorgu | Yanıt | Hatalar |
|---|---|---|---|---|
| POST | `/api/auth/register` (anon) | `{ userName, email, password, birthYear }` | `{ token, refreshToken, userId, userName, avatarKey }` | 400 `AGE_TOO_YOUNG`, `BIRTH_YEAR_REQUIRED` |
| POST | `/api/auth/login` (anon) | `{ userName, password }` | aynı | 401, 403 `ACCOUNT_SUSPENDED` |
| POST | `/api/auth/refresh` (anon) | `{ refreshToken }` | aynı | 401 |
| GET | `/api/users/me` | — | profil + sayaçlar | |
| GET | `/api/users/{id}` | — | `{ userId, userName, avatarKey, bio, joinedAtUtc, followerCount, followingCount, follow, isPrivate, canSeeContent }` | 404 |
| GET | `/api/users/search?q=` | — | `[{ userId, userName, avatarKey, relation }]` | |
| PUT | `/api/users/me/profile` | `{ bio }` | profil | 400 `BIO_TOO_LONG` |
| PUT | `/api/users/me/avatar` | `{ avatarKey }` | profil | 400 `INVALID_AVATAR` |
| PUT | `/api/users/me/privacy` | `{ isPrivate }` | | |
| POST/DELETE | `/api/users/me/deletion` | `{ password }` | `{ deletionScheduledForUtc }` | 400 `WRONG_PASSWORD` |
| POST/GET | `/api/users/me/data-requests` | — | `{ latest }` | |
| GET/PUT/DELETE | `/api/users/me/saved-places[/{placeId}]` | `{ name, category, latitude, longitude }` | liste | 429 `SAVED_LIMIT` |
| POST | `/api/follows/{userId}` / DELETE | — | `{ follow: "following" \| "requested" }` | 403 `FOLLOW_NOT_ALLOWED` |
| GET | `/api/users/{id}/followers\|following` | page | liste | 403 `PRIVATE_ACCOUNT` |
| GET/POST | `/api/follows/requests[/{userId}/accept\|decline]` | | | |
| * | `/api/friends/**` | bkz. kök CLAUDE.md §13 | | |
| GET/POST/DELETE | `/api/blocks[/{userId}]`, `/api/blocks/status/{userId}` | `{ userId }` | `{ blocked }` | |
| POST | `/api/reports` | `{ targetType, targetId, reason, note? }` | 200 | 429 `TOO_MANY_REPORTS` |

## 2. Gönderi / sinyal (BlogService)
| Yöntem | Yol | Not |
|---|---|---|
| POST | `/api/posts` | Sinyal oluştur (aşağıda örnek) |
| GET/PUT/DELETE | `/api/posts/{id}` | `isLikedByCurrentUser`, **V2** `reactionCounts`, `myReaction`, `hashtags`, `mentions` |
| POST | `/api/posts/{id}/likes` | ❤️ aç/kapa (geriye uyum) → `{ liked }` |
| POST | `/api/posts/{id}/reactions` **V2** | `{ reaction: "🔥" \| null }` → `{ reaction, counts }`; 400 `INVALID_REACTION`, `CANNOT_LIKE_OWN` |
| GET | `/api/posts/{id}/comments?page&pageSize&sort=newest\|oldest` | yorum + yanıtlar; **V2** her yorumda `likeCount`, `likedByMe`, `mentions` |
| POST | `/api/posts/{id}/comments` | `{ commentText, parentCommentId?, mentionedUserIds? (V2, ≤10) }`; 400 `COMMENT_EMPTY`/`COMMENT_TOO_LONG` |
| DELETE | `/api/posts/{id}/comments/{commentId}` | 403 `COMMENT_FORBIDDEN` |
| POST | `/api/posts/{id}/comments/{commentId}/like` **V2** | aç/kapa → `{ liked, likeCount }` |
| POST | `/api/posts/views` | `{ postIds: [] }` görülme |
| POST | `/api/posts/place-presence` | yakınlık ön kontrolü |
| GET | `/api/posts-read/bounds`, `/nearby`, `/author/{id}` | okuma modeli |
| GET | `/api/discover/nearby`, `/api/discover/following` | Keşfet |
| GET | `/api/discover/hashtag/{tag}?page` **V2** | etiket akışı, yeni → eski, anonim hariç |
| GET | `/api/discover/hashtags/search?q=` **V2** | `[{ tag, postCount }]` (öneri) |
| GET | `/api/map/bounds`, `/api/map/nearby` | Birleşik harita |
| POST/PUT/GET | `/api/v1/media/presign`, `/uploads/{id}/content`, `/uploads/{id}`, `/public/{id}` | Medya |

Örnek — sinyal oluşturma:
```http
POST /api/posts
{ "title": "", "content": "Bahçede boş masa var #akşamkahvesi @mert",
  "latitude": 37.0746, "longitude": 36.2464, "accuracyMeters": 12,
  "observationLatitude": 37.0746, "observationLongitude": 36.2464, "observationAccuracyMeters": 12,
  "placeId": "p_123", "locationName": "Soulmate Kafe", "signalType": "Crowd", "signalValue": "Calm",
  "audienceType": "Public", "identityDisclosure": "LimitedProfile", "locationPrecision": "PlaceCenter",
  "mediaIds": ["m_1"], "mentionedUserIds": ["6f1c…"] }
→ 201 { "postId": "…", "publicationTrust": "VERIFIED_LIVE" }
```
Örnek — tepki:
```http
POST /api/posts/9b1…/reactions   { "reaction": "🔥" }
→ 200 { "reaction": "🔥", "counts": { "❤️": 12, "🔥": 4 } }
```

## 3. Yer (PlaceService)
`GET /api/places/{id}`, `/{id}/signals`, `/nearby`, `/search?q&lat&lon&radiusMeters&expand`, `/bounds`, `/batch?ids=`, `POST /api/places` (yetkili).

## 4. Bildirim, sohbet, snap, hikaye (NotificationsService)
| Yöntem | Yol | Not |
|---|---|---|
| GET | `/api/notifications?page` | **V2** `type`: `like\|reaction\|comment\|reply\|mention\|follow\|follow_request\|story_like\|story_reply`, `actor`, `postId?`, `thumbnailUrl?` |
| GET | `/api/notifications/unread-count` | |
| POST | `/api/notifications/read` | `{ ids? }` (boş = hepsi) |
| POST | `/api/subscriptions`, `/api/subscriptions/location` | cihaz/konum aboneliği |
| GET/POST | `/api/chat/conversations` | |
| GET/POST | `/api/chat/conversations/{id}/messages` | `{ text?, clientId?, signal?, replyToId? }` |
| POST | `/api/chat/conversations/{id}/read`, `/typing` | |
| POST | `/api/chat/conversations/{id}/snaps?durationSeconds&caption` | ham medya |
| POST | `/api/chat/conversations/{id}/messages/{mid}/open` | snap aç; 410 `SNAP_OPENED`/`SNAP_EXPIRED` |
| PUT/DELETE | `.../messages/{mid}/reaction`, `.../messages/{mid}` | tepki, geri al |
| POST | `/api/stories?durationSeconds&caption` | ham medya, 24 sa |
| GET | `/api/stories/tray`, `/api/stories/users/{id}`, `/{id}/content`, `/{id}/viewers` | **V2** viewers: `likedByViewer` |
| POST | `/api/stories/{id}/seen` | |
| POST/DELETE | `/api/stories/{id}/like` **V2** | `{ liked }`; yazara bildirim |
| POST | `/api/stories/{id}/reply` **V2** | `{ text?, emoji? }` → DM (`kind: "story_reply"`, hikaye önizlemesi) |
| DELETE | `/api/stories/{id}` | |

## 5. Gerçek zaman hub'ı **V2**
`wss://<gateway>/hubs/realtime?access_token=<jwt>` (SignalR JSON protokolü).

| Sunucu → istemci | Yük |
|---|---|
| `message.created` | `{ conversationId, message }` |
| `message.read` | `{ conversationId, readerId, readAtUtc }` |
| `typing` | `{ conversationId, userId }` (6 sn geçerli) |
| `comment.added` | `{ postId, comment }` (yalnız `JoinPost` yapanlara) |
| `comment.deleted` | `{ postId, commentId }` |
| `reaction.changed` | `{ postId, counts }` |
| `notification.created` | `{ notification, unreadCount }` |
| `story.liked` | `{ storyId, userId }` (yazara) |

| İstemci → sunucu | Not |
|---|---|
| `JoinPost(postId)` / `LeavePost(postId)` | Görünürlük sunucuda kontrol edilir |
| `Typing(conversationId)` | REST `/typing` ile eşdeğer |

## 6. Hata kodları sözlüğü (seçme)
`NOT_FOUND`, `FORBIDDEN`, `SELF`, `CANNOT_LIKE_OWN`, `INVALID_REACTION`, `COMMENT_EMPTY`, `COMMENT_TOO_LONG`,
`CONTENT_BLOCKED` (422), `POSTING_RESTRICTED` (403), `PRIVATE_ACCOUNT`, `CHAT_FORBIDDEN`, `CHAT_UNAVAILABLE` (503),
`STORY_FORBIDDEN`, `TOO_MANY_STORIES`, `SNAP_OPENED`/`SNAP_EXPIRED` (410), `TOO_MANY_MENTIONS`.
