# DATABASE — indeksler

## Mevcut (özet)
| Koleksiyon | İndeks | Amaç |
|---|---|---|
| posts | `Location` 2dsphere | bounds/nearby |
| posts | `{ AuthorId: 1, CreatedAtUtc: -1 }` | profil ızgarası |
| posts | `{ ExpiresAtUtc: 1 }` | canlı filtre |
| places | `Location` 2dsphere, `SearchTokens`, `{ ExternalProvider, ExternalId }` uniq | katalog |
| place_signals | `{ PlaceId: 1, ObservedAtUtc: -1 }` | canlı durum |
| processed_messages | `{ MessageId, Consumer }` uniq | idempotency |
| chat_messages | `{ ConversationId: 1, CreatedAtUtc: -1 }`, `{ ConversationId, ClientId }` uniq-sparse | sohbet |
| conversations | `ParticipantIds` | liste |
| stories | `{ AuthorId: 1, ExpiresAtUtc: 1 }` | tepsi |
| notifications | `{ UserId: 1, CreatedAtUtc: -1 }` | liste |
| Postgres | `Users.UserName` uniq, `Users.Email` uniq, `Follows (FolloweeId)`, `UserBlocks (BlockedId)` | |

## V2'de eklenen
```csharp
// posts
new CreateIndexModel<PostDocument>(Builders<PostDocument>.IndexKeys.Ascending(p => p.Hashtags).Descending(p => p.CreatedAtUtc),
    new CreateIndexOptions { Name = "hashtags_created" });
// notifications: gruplama upsert'i
new CreateIndexModel<Notification>(Builders<Notification>.IndexKeys.Ascending(n => n.UserId).Ascending(n => n.GroupKey).Descending(n => n.UpdatedAtUtc),
    new CreateIndexOptions { Name = "user_group_updated" });
// stories: süresi dolanlar 48 saat sonra otomatik silinir (dosya temizliği ayrı servis)
new CreateIndexModel<StoryDocument>(Builders<StoryDocument>.IndexKeys.Ascending(s => s.ExpiresAtUtc),
    new CreateIndexOptions { Name = "expires_ttl", ExpireAfter = TimeSpan.FromHours(48) });
```
Kurallar: her yeni sorgu şekli için `explain()` ile IXSCAN doğrulanır; COLLSCAN yapan sorgu PR'a girmez.
Hashtag sorgusu anonim gönderiyi hariç tutar (`IdentityDisclosure != AnonymousMap`) — seçicilik yüksek olduğundan
ayrı indeks gerekmez.
