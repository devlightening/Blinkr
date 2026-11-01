# 09 — API Spesifikasyonu

Taban: `https://api.<domain>/v1` · JSON · `Authorization: Bearer <access>` · `Accept-Language: tr|en`
Tipler `shared/types/api.ts` içinde tanımlanır; mobil ve backend aynı dosyayı kullanır.

## 1. Genel kurallar
- **Sayfalama:** Cursor tabanlı. İstek `?cursor=<opak>&limit=20` → yanıt `{ items: T[], nextCursor: string | null }`.
- **Hata biçimi:** `{ "error": { "code": "RATE_LIMITED", "message": "<yerelleştirilmiş>", "details": {} } }`
  Kodlar: `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `VALIDATION` 422, `RATE_LIMITED` 429,
  `CONFLICT` 409 (ör. kullanıcı adı alınmış), `TOO_FAR` 403 (doğrulama mesafesi), `CONTENT_BLOCKED` 422
  (moderasyon), `INTERNAL` 500.
- **Idempotency:** Oluşturma isteklerinde `Idempotency-Key` başlığı (sinyal, yorum, mesaj). Aynı anahtar
  24 saat içinde aynı yanıtı döner.
- **Zaman:** ISO-8601 UTC. İstemci yerel saate çevirir.
- **Konum:** `{ lat: number, lng: number }`. Gerçek konum yalnızca istek gövdesinde gider; yanıtlarda
  yalnızca `displayLocation` döner.

## 2. Paylaşılan tipler
```ts
export type SignalType = 'crowd'|'wait'|'status'|'traffic'|'event'|'weather'|'parking'|'observation';
export type Visibility = 'public'|'followers'|'close_friends'|'private';
export type ReactionKey = 'heart'|'fire'|'wow'|'laugh'|'thanks';
export type LatLng = { lat: number; lng: number };

export interface MediaDTO {
  id: string; kind: 'image'|'video';
  width: number; height: number; durationMs?: number; blurhash?: string;
  urls: { thumb: string; medium: string; full: string; video?: string; poster?: string };
}

export interface UserSummary {
  id: string; username: string; displayName: string;
  avatarUrl: string | null; avatarPreset: string | null;
  isPrivate: boolean; trustLevel: 'new'|'scout'|'guide'|'master'|'ambassador';
  hasActiveStory: boolean; storySeen: boolean;
}

export interface Relationship {
  following: 'none'|'pending'|'accepted';
  followedBy: boolean; isFriend: boolean; isBlocked: boolean; isMuted: boolean;
}

export interface UserProfile extends UserSummary {
  bio: string | null; city: string | null; website: string | null;
  counts: { signals: number; followers: number; following: number };
  trustScore: number; level: number; xp: number; nextLevelXp: number; streakDays: number;
  badges: { key: string; earnedAt: string }[];
  mutualFollowers: { users: UserSummary[]; total: number };
  relationship: Relationship | null;     // kendi profilinde null
  canViewContent: boolean;               // gizli hesap kontrolü
  showMapTab: boolean;
  // email ASLA burada yok; yalnızca GET /me içinde
}

export interface PlaceSummary {
  id: string; name: string; category: string; isSensitive: boolean;
  location: LatLng; distanceM?: number; district?: string; city?: string;
}

export interface PlaceLiveStatus {
  type: SignalType; level: number | null;
  confidence: 'low'|'medium'|'high'; freshness: 'live'|'recent'|'stale';
  activeSignals: number; verifications: number;
  lastSignalAt: string; lastVerifiedAt: string | null;
}

export interface SignalDTO {
  id: string;
  author: UserSummary | null;            // anonimse null (sahibine dolu)
  isAnonymous: boolean; isMine: boolean;
  type: SignalType; level: number | null; statusValue: string | null;
  caption: string | null; mentions: UserSummary[];
  place: PlaceSummary | null;
  displayLocation: LatLng; distanceM?: number;
  locationVerified: boolean; source: 'camera'|'gallery'|'text'; isDelayed: boolean;
  media: MediaDTO[];
  visibility: Visibility; inStory: boolean;
  status: 'pending_media'|'active'|'expired'|'hidden';
  capturedAt: string; createdAt: string; expiresAt: string;
  lifeProgress: number;                  // 0..1, FreshnessRing için (sunucu hesaplar)
  counts: { reactions: number; thanks: number; comments: number; verifyYes: number; verifyChanged: number; views: number };
  topReactions: ReactionKey[];           // en çok 3
  myReaction: ReactionKey | null; myVerification: 'still_true'|'changed'|null; isSaved: boolean;
  lastVerifiedAt: string | null;
  canVerify: boolean;                    // sunucu, istekteki konuma göre (?lat&lng) hesaplar
  commentsEnabled: boolean;
  previewComment: CommentDTO | null;
  replacesSignalId: string | null;
}

export interface CommentDTO {
  id: string; signalId: string; parentId: string | null;
  author: UserSummary; isSignalAuthor: boolean;
  text: string; mentions: UserSummary[];
  likes: number; likedByMe: boolean; repliesCount: number;
  createdAt: string; isMine: boolean;
}

export interface MapClusterDTO { cellId: string; center: LatLng; count: number; dominantType: SignalType }
export interface MapSignalsResponse { signals: SignalDTO[]; clusters: MapClusterDTO[]; serverTime: string }

export interface ConversationDTO {
  id: string; isGroup: boolean; members: UserSummary[];
  lastMessage: MessageDTO | null; unreadCount: number; isRequest: boolean; muted: boolean;
}
export interface MessageDTO {
  id: string; conversationId: string; sender: UserSummary;
  type: 'text'|'snap'|'media'|'signal_share'|'story_reply'|'system';
  text: string | null; media: MediaDTO | null; signal: SignalDTO | null;
  replyTo: { id: string; text: string | null; senderName: string } | null;
  snap: { state: 'unopened'|'opened'; kind: 'image'|'video' } | null;
  reactions: { emoji: string; userId: string }[];
  createdAt: string; clientId: string | null; unsent: boolean;
}

export interface NotificationDTO {
  id: string; type: string; actors: UserSummary[]; actorCount: number;
  target: { type: string; id: string; thumbUrl?: string } | null;
  text: string;                           // sunucu yerelleştirir
  deepLink: string; read: boolean; createdAt: string;
}
```

## 3. Auth
| Metot | Yol | Gövde | Yanıt |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password }` | `{ accessToken, refreshToken, user: Me, needsOnboarding }` |
| POST | `/auth/login` | `{ email, password }` | aynı |
| POST | `/auth/apple` | `{ identityToken, fullName? }` | aynı |
| POST | `/auth/google` | `{ idToken }` | aynı |
| POST | `/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/auth/logout` | `{ refreshToken }` | 204 |
| POST | `/auth/password/forgot` · `/reset` | `{ email }` · `{ token, password }` | 204 |

## 4. Ben / kullanıcılar
| Metot | Yol | Not |
|---|---|---|
| GET | `/me` | `Me = UserProfile & { email, locale, settings, unread: { notifications, chats } }` |
| PATCH | `/me` | displayName, bio, city, website, avatarMediaId, avatarPreset, locale, isPrivate, dmPolicy, showActivity, showMapTab, defaultVisibility |
| GET | `/me/username-available?u=` | `{ available, suggestions[] }` |
| PATCH | `/me/username` | 14 gün kuralı |
| POST | `/me/onboarding` | `{ username, displayName, birthYear, avatarPreset? }` |
| DELETE | `/me` | Silme talebi (30 gün), tüm oturumlar kapanır |
| POST | `/me/restore` | Silme talebini geri al (30 gün içinde giriş yapınca) |
| GET | `/users/:username` | `UserProfile` |
| GET | `/users/:id/signals?cursor&tab=grid` | `Page<SignalDTO>` (görünürlük kurallı) |
| GET | `/users/:id/signals/map?bbox` | profil harita sekmesi |
| GET | `/users/:id/followers?cursor&q` · `/following` | `Page<UserSummary & { relationship }>` |
| GET | `/search?q&type=users|places|top&lat&lng` | karışık sonuç |
| GET | `/suggestions/users?lat&lng` | önerilen kişiler |

## 5. Sosyal
| Metot | Yol | Not |
|---|---|---|
| POST / DELETE | `/users/:id/follow` | `{ status: 'accepted'|'pending'|'none' }` |
| DELETE | `/users/:id/follower` | takipçiyi çıkar |
| GET | `/me/follow-requests?cursor` | |
| POST | `/follow-requests/:userId/accept` · `/decline` | |
| POST / DELETE | `/users/:id/block` | |
| POST / DELETE | `/users/:id/mute` | `{ signals: bool, stories: bool }` |
| GET | `/me/blocked` · `/me/muted` | |

## 6. Sinyaller, harita, akış
| Metot | Yol | Not |
|---|---|---|
| POST | `/signals` | Bkz. aşağı gövde |
| GET | `/signals/:id?lat&lng` | `SignalDTO` (`canVerify` için konum opsiyonel) |
| PATCH | `/signals/:id` | caption, visibility, commentsEnabled, inStory=false |
| DELETE | `/signals/:id` | soft delete |
| GET | `/map/signals?minLat&minLng&maxLat&maxLng&zoom&types=crowd,wait&live=1&following=1` | `MapSignalsResponse` |
| GET | `/map/places?bbox…` | canlı durumu olan yerler: `(PlaceSummary & { live: PlaceLiveStatus[] })[]` |
| GET | `/feed/nearby?lat&lng&radiusKm&types&cursor` | `Page<SignalDTO>` + ilk sayfada `placeStatuses[]` |
| GET | `/feed/following?cursor` | `Page<SignalDTO>` |
| POST | `/signals/:id/verify` | `{ verdict: 'still_true'|'changed', newLevel?, location: LatLng, accuracyM }` → güncel sayaçlar. `changed` ise istemci ayrıca yeni sinyal oluşturabilir (`replacesSignalId`) |
| DELETE | `/signals/:id/verify` | doğrulamayı geri al |
| PUT / DELETE | `/signals/:id/reaction` | `{ reaction: ReactionKey }` |
| GET | `/signals/:id/reactions?cursor` | tepki verenler |
| POST | `/signals/views` | `{ signalIds: string[] }` toplu |
| PUT / DELETE | `/signals/:id/save` | `{ collectionId? }` |
| POST | `/signals/:id/share-to-chat` | `{ userIds: string[], text? }` |

**POST /signals gövdesi:**
```json
{
  "type": "wait", "level": 1, "statusValue": null,
  "caption": "Acile gelmeyin, çok kalabalık.",
  "placeId": "…",                      // opsiyonel
  "location": { "lat": 37.07, "lng": 36.24 }, "accuracyM": 18,
  "capturedAt": "2026-09-22T11:21:00Z",
  "mediaIds": ["…"], "source": "camera",
  "visibility": "public", "isAnonymous": false,
  "inStory": true, "sendToUserIds": ["…"],   // snap olarak da gönder
  "stickers": { "filter": "retro", "items": [{ "kind": "type", "value": "crowd", "x": 0.3, "y": 0.7, "scale": 1, "rotation": 0 }] },
  "replacesSignalId": null, "questionId": null
}
```
Yanıt `201 SignalDTO`. Sunucu: TTL, `display_location`, `location_verified`, `is_delayed`, geohash hesaplar;
moderasyon kuyruğuna atar; realtime `map:signal:new` yayınlar.

## 7. Yorumlar
| Metot | Yol | Not |
|---|---|---|
| GET | `/signals/:id/comments?sort=top|new&cursor` | üst seviye yorumlar |
| GET | `/comments/:id/replies?cursor` | |
| POST | `/signals/:id/comments` | `{ text, parentId? }` → `CommentDTO` (mentions sunucuda çözülür) |
| DELETE | `/comments/:id` | yazar veya sinyal sahibi |
| PUT / DELETE | `/comments/:id/like` | |

## 8. Yerler, hikayeler, kaydedilenler, medya
| Metot | Yol | Not |
|---|---|---|
| GET | `/places/nearby?lat&lng&radius=300` | oluşturma akışı için en yakın 5–10 yer |
| GET | `/places/:id` | `PlaceSummary & { live: PlaceLiveStatus[], isFollowing, isSaved, openQuestions[] }` |
| GET | `/places/:id/signals?status=active|expired&cursor` | |
| PUT / DELETE | `/places/:id/follow` | `{ mode: 'all'|'changes' }` |
| PUT / DELETE | `/places/:id/save` | |
| POST | `/places/:id/questions` | `{ text }` |
| GET | `/stories/tray` | `{ items: { user: UserSummary; latestAt; allSeen }[] }` |
| GET | `/stories/:userId` | `SignalDTO[]` (son 24 sa, inStory) |
| POST | `/stories/seen` | `{ signalIds }` |
| GET | `/stories/:signalId/viewers` | yalnızca sahibi |
| GET | `/me/saved?type=signal|place&collectionId&cursor` | |
| GET / POST / PATCH / DELETE | `/me/collections[/:id]` | |
| POST | `/me/saved/import` | `{ placeIds: string[] }` cihazdan göç |
| POST | `/media/upload-url` | `{ kind, mime, bytes, width, height, purpose }` → `{ mediaId, uploadUrl, headers }` |
| POST | `/media/:id/complete` | → `{ status }` |

## 9. Sohbet
| Metot | Yol | Not |
|---|---|---|
| GET | `/conversations?folder=inbox|requests&cursor` | `Page<ConversationDTO>` |
| POST | `/conversations` | `{ userIds: [id] }` → mevcut 1:1 varsa onu döner |
| GET | `/conversations/:id/messages?before&limit=40` | |
| POST | `/conversations/:id/messages` | `{ clientId, type, text?, mediaId?, signalId?, replyToId? }` |
| POST | `/conversations/:id/read` | `{ lastReadAt }` |
| POST | `/conversations/:id/accept` | mesaj isteğini kabul et |
| POST | `/messages/:id/open` | snap aç → `{ mediaUrl (60 sn imzalı), expiresInSec }` (yalnızca 1 kez) |
| POST | `/messages/:id/screenshot` | snap ekran görüntüsü bildirimi |
| DELETE | `/messages/:id` | herkesten geri al (yalnızca gönderen) |
| PUT / DELETE | `/messages/:id/reaction` | |

## 10. Bildirimler ve diğerleri
| Metot | Yol | Not |
|---|---|---|
| GET | `/notifications?cursor` | `Page<NotificationDTO>` |
| POST | `/notifications/read` | `{ ids?: string[], all?: true }` |
| GET / PATCH | `/me/notification-prefs` | |
| POST / DELETE | `/devices` | `{ pushToken, platform, locale }` |
| POST | `/reports` | `{ targetType, targetId, reason, note? }` |
| GET | `/me/badges` · `/badges` | |

## 11. Realtime olayları (Socket.IO)
Bağlantı: `wss://api.<domain>` · `auth: { token }` · sunucu otomatik `user:{id}` odasına alır.

| Yön | Olay | Yük |
|---|---|---|
| C→S | `map:subscribe` | `{ geohashes: string[] }` (maks 12) |
| S→C | `map:signal:new` | `SignalDTO` (görünürlük kontrolü yayın sırasında yapılır; public dışı sinyaller yalnızca `user:` odalarına) |
| S→C | `map:signal:update` | `{ id, counts, status, lifeProgress }` |
| S→C | `map:signal:remove` | `{ id }` |
| S→C | `place:status` | `{ placeId, live: PlaceLiveStatus[] }` |
| C→S | `signal:join` / `signal:leave` | `{ id }` |
| S→C | `signal:counts` | `{ id, counts }` |
| S→C | `signal:comment:new` | `CommentDTO` |
| C→S | `conv:join` / `conv:leave` | `{ id }` |
| S→C | `chat:message` | `MessageDTO` (`user:` odasına da, liste güncellemesi için) |
| C↔S | `chat:typing` | `{ conversationId, isTyping }` |
| S→C | `chat:read` | `{ conversationId, userId, lastReadAt }` |
| S→C | `chat:snap:opened` | `{ messageId, openedAt }` |
| S→C | `notification:new` | `NotificationDTO` + `{ unread }` |
| S→C | `presence` | `{ userId, online }` (yalnızca arkadaşlara, `show_activity` açıksa) |
