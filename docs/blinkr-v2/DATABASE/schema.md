# DATABASE — şema

Üç depo, her biri tek bir bounded context'e ait. Servisler başka servisin deposuna **doğrudan erişmez**.

## 1. PostgreSQL — IdentityService (EF Core)
| Tablo | Ana alanlar | Not |
|---|---|---|
| `Users` | Id (uuid), UserName (uniq), Email (uniq), PasswordHash, AvatarKey, Bio (≤160), BirthYear, IsPrivate, PostingRestrictedUntil, SuspendedUntil, DeletionScheduledForUtc, CreatedAtUtc, Roles | |
| `RefreshTokens` | Id, UserId, TokenHash, ExpiresAtUtc, RevokedAtUtc | |
| `Friendships` | UserAId < UserBId, RequestedById, Status (Pending/Accepted/Declined), UpdatedAtUtc | çift başına tek satır |
| `Follows` | FollowerId, FolloweeId, Status (Following/Requested), CreatedAtUtc | PK (FollowerId, FolloweeId) |
| `UserBlocks` | BlockerId, BlockedId, CreatedAtUtc | iki yönlü etki |
| `Reports` | Id, ReporterId, TargetType, TargetId, Reason, Note, Weight, Status | |
| `ModerationActions` | Id, AdminId, TargetUserId, Action, Reason, CreatedAtUtc | denetim izi |
| `SavedPlaces` | UserId, PlaceId, Name, Category, Lat, Lon, SavedAtUtc | ≤ 100 |
| `DataRequests` | Id, UserId, RequestedAtUtc, Status | 30 günde bir |

## 2. EventStoreDB — BlogService (yazma modeli)
Akış: `post-{postId}`. Olaylar (yalnız ekleme yapılır, eski alan silinmez):
```
PostCreated { PostId, AuthorId, AuthorName, Title, Content, Lat, Lon, PlaceId?, PublicationTrust, SignalType, SignalValue,
              AudienceType, IdentityDisclosure, LocationPrecision, ExpiresAtUtc, Media[], FromGallery, MentionedUserIds? (V2) }
PostContentUpdated { PostId, Title, Content }
PostDeleted { PostId }
PostLiked { PostId, UserId, Reaction? (V2, null = ❤️) }      PostUnliked { PostId, UserId }
PostCommentAdded { PostId, CommentId, ParentCommentId?, UserId, UserName, Text, MentionedUserIds? (V2) }
PostCommentRemoved { PostId, CommentId }
PostCommentLiked / PostCommentUnliked { PostId, CommentId, UserId }   (V2)
PostLocationAdded / Updated / Removed
```

## 3. MongoDB
### BlinkrReadModel (Blog + worker)
| Koleksiyon | Belge (özet) |
|---|---|
| `posts` | `_id` PostId, AuthorId, AuthorName (anonimde boş), Content, Location (GeoJSON Point), PlaceId, SignalType/Value, PublicationTrust, ExpiresAtUtc, Media[], LikeCount, **ReactionCounts (V2)**, **Reactions: [{UserId, R}] (V2)**, Comments: [{Id, ParentId, UserId, UserName, Text, CreatedAtUtc, **LikeCount, LikedBy[] (V2)**, **Mentions[] (V2)**}], **Hashtags[] (V2)**, **Mentions[] (V2)**, ViewCount, Sensitive, CreatedAtUtc |
| `posts_moderated` | gizlenen gönderiler (aynı şema) |
| `post_views` | PostId, UserId, LastSeenAtUtc |
| `media_uploads` | MediaId, OwnerId, ContentType, Size, Width, Height, Duration, ThumbnailKey, Status |
| `processed_messages`, `__processed` | idempotent inbox (MessageId, Consumer) |
| `es_checkpoints`, `publisher_status`, `publisher_failures` | publisher durumu |

### BlinkrPlaces (PlaceService)
`places` (katalog, GeoJSON, SearchTokens, ExternalProvider/Id), `place_signals`, `place_signals_moderated`, `place_discovery_coverage`.

### BlinkrNotifications (NotificationsService)
| Koleksiyon | Belge (özet) |
|---|---|
| `notifications` | Id, UserId, Type, **GroupKey, Actors[], ActorCount (V2)**, PostId?, CommentId?, StoryId?, Text, IsRead, CreatedAtUtc, UpdatedAtUtc |
| `conversations` | Id, ParticipantIds[2], LastMessage*, UnreadBy{} |
| `chat_messages` | Id, ConversationId, SenderId, Kind (text/snap/signal/unsent/**story_reply V2**), Text, ClientId, ReplyToId, Snap{…}, Signal{…}, **Story{StoryId, PreviewKey} (V2)**, Reactions{}, CreatedAtUtc, ReadAtUtc |
| `stories` | Id, AuthorId, AuthorName, MediaKey, ContentType, MediaType, Caption, DurationSeconds, CreatedAtUtc, ExpiresAtUtc, Views[{UserId, UserName, SeenAtUtc}], **Likes[{UserId, LikedAtUtc}] (V2)** |
| `device_tokens`, `user_locations` | push/konum aboneliği |

## 4. Dosya depoları
- Blog medya: `App_Data/media` (yerel) → S3 (sonra, `IMediaStorage`).
- Snap/hikaye: NotificationsService `App_Data/snaps` (statik sunulmaz, yetkili uçtan akış).
