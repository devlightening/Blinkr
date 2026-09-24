# ARCHITECTURE

## 1. Genel görünüm
```text
Expo iOS / Android  ──HTTP+JWT──►  API Gateway (YARP) :5080  ◄──WebSocket (SignalR, V2)──┐
                                         │                                                │
   ┌─────────────────┬───────────────────┼──────────────────┬─────────────────────────────┤
   ▼                 ▼                   ▼                  ▼                             │
IdentityService   BlogService         PlaceService     NotificationsService ──────────────┘
 :5188             :5215               :5225            :5290  (+ /hubs/realtime)
 PostgreSQL        EventStoreDB (yazma) Mongo BlinkrPlaces Mongo (bildirim, sohbet, snap, hikaye)
 (kullanıcı,       Mongo read model     (katalog, PlaceSignal,
  takip, engel,    Redis (önbellek)      coverage)
  rapor, kayıtlı)       │
                        ▼ checkpoint'li publisher
                    RabbitMQ ──► Projection Worker :8082 ──► Mongo posts
                        └──────► PlaceService consumer, Notifications consumer
```

| Servis | Sorumluluk (bounded context) | Depo |
|---|---|---|
| IdentityService | Kayıt/giriş/JWT, profil, avatar, arkadaşlık, takip, engel, rapor, moderasyon, kayıtlı yerler, hesap silme | PostgreSQL (EF Core) |
| BlogService | Sinyal/gönderi komutları (ES), medya, yorum, beğeni/tepki, keşfet, harita birleştirme | EventStoreDB + Mongo + Redis |
| PlaceService | Yer kataloğu, yakın/arama/bounds, canlı yer durumu | Mongo |
| NotificationsService | Bildirim, sohbet, snap, hikaye, **gerçek zaman hub'ı (V2)** | Mongo + özel disk |
| Projection Worker | RabbitMQ → Mongo idempotent projeksiyon | Mongo |
| Gateway | Tek giriş noktası, route, WebSocket geçişi | — |

## 2. SOLID katman kalıbı (her servis)
```
X.Api             Controller (ince), filtreler, DI kaydı, hosted service'ler, hub'lar
X.Application     Komut/sorgu + handler (MediatR), doğrulama (FluentValidation), DTO, arayüzler (port)
X.Domain          Aggregate, value object, domain olayı, iş kuralı — altyapıya bağımlı değil
X.Infrastructure  Repository, EventStore/Mongo/EF, HTTP istemcileri (adapter)
```
- **S**: Controller yalnız HTTP ↔ komut çevirir. Örn. `PostsController.Like` → `TogglePostReactionCommand`.
- **O**: Yeni tepki türü eklemek `ReactionCatalog` listesine eleman eklemektir; handler değişmez.
- **L**: `IBlockGuard`'ın gerçek (`IdentityBlockGuard`) ve test (`AllowAllBlockGuard`) uygulamaları aynı sözleşmeye uyar.
- **I**: Küçük arayüzler: `IRealtimePublisher` (yalnız yayın), `IFollowGraph` (yalnız görünürlük sorgusu).
- **D**: Application katmanı `IRealtimePublisher`'a bağımlı; SignalR uygulaması Api katmanında kayıtlı.

Örnek (V2-4 tepki komutu):
```csharp
// BlogService.Application/Commands/TogglePostReactionCommand.cs
public sealed record TogglePostReactionCommand(Guid PostId, Guid UserId, string Reaction) : IRequest<ReactionResultDto>;

public sealed class TogglePostReactionHandler(IPostRepository posts) : IRequestHandler<TogglePostReactionCommand, ReactionResultDto>
{
    public async Task<ReactionResultDto> Handle(TogglePostReactionCommand cmd, CancellationToken ct)
    {
        if (!ReactionCatalog.IsValid(cmd.Reaction)) throw new DomainValidationException("INVALID_REACTION");
        var post = await posts.LoadAsync(cmd.PostId, ct) ?? throw new NotFoundException("NOT_FOUND");
        var result = post.ToggleReaction(cmd.UserId, cmd.Reaction);   // domain kuralı: kendine tepki yok, kişi başı bir
        await posts.SaveAsync(post, ct);                               // EventStore'a PostLiked/PostUnliked
        return new ReactionResultDto(result.Reaction, result.Active);
    }
}
```

## 3. Mobil mimari
```
App.tsx                      sekme kabuğu (map | discover | chat | profile), MapScreen hep monte
src/theme.ts, themeBoot.ts   token'lar + açılışta tema seçimi
src/i18n/                    tx(), tr/en
src/api.ts                   tek HTTP istemcisi (JWT, refresh, hata eşleme)
src/realtime.ts   (V2)       SignalR bağlantısı, olay aboneliği, yoklamaya geri düşüş
src/components/<alan>/       map, signal, feed, stories, chat, snap, camera, friends, account, ui
src/<kural>.ts               saf mantık (test edilir): signalCard, chatThread, stories, discoverFeed…
```
Kurallar: saf mantık bileşenden ayrılır ve `scripts/*.test.ts` ile test edilir; bileşen durum + sunum;
ağ çağrısı `api.ts` üzerinden; yeniden kullanılabilir hook'lar `src/hooks/` (V2: `useComments`, `useRealtime`).

## 4. Olay akışı (yazma → okuma)
```
Mobil POST /api/posts/{id}/reactions
  → Gateway → BlogService PostsController
  → MediatR handler → PostAggregate.ToggleReaction → PostLiked{Reaction} (EventStore)
  → EventStoreToRabbitMqPublisher (checkpoint) → Shared.Events.PostLikedIntegrationEvent
  → Worker PostLikedConsumer: posts.ReactionCounts[r]++ (idempotent inbox)
  → Notifications consumer: "X gönderine ❤️ bıraktı" + realtime "notification.created"
```
Olay değiştirilirken kural: **yalnız ekle, silme/yeniden adlandırma yok**; yeni alan nullable ve varsayılanlı
(`Reaction ?? "❤️"`), böylece eski olaylar yeniden oynatılabilir. Bkz. `DATABASE/migrations.md`.

## 5. Gerçek zamanlılık (V2-5)
```
NotificationsService.Api/Realtime/RealtimeHub.cs     [Authorize] Hub, bağlantıda "user:{id}" grubuna eklenir
NotificationsService.Application/IRealtimePublisher   ToUser(userId, evt, payload), ToGroup(group, evt, payload)
Consumers (RabbitMQ)                                  PostCommentAdded → group "post:{id}"; bildirim → "user:{id}"
Chat servisleri                                       mesaj/yazıyor/okundu → iki katılımcının "user:{id}" grubu
Gateway                                               /hubs/{**catch-all} → notifications (WebSocket açık)
```
Tek yetki kaynağı: hub yalnız JWT'deki kullanıcıya yayın yapar; istemci bir gruba katılmak için
`JoinPost(postId)` çağırır, sunucu gönderinin okunabilir olduğunu (engel/gizli hesap) kontrol eder.

## 6. Veri sahipliği
| Veri | Sahip | Not |
|---|---|---|
| Kullanıcı, takip, engel | Identity (Postgres) | Diğer servisler HTTP ile, kullanıcının kendi token'ıyla sorar |
| Gönderi/yorum/tepki | Blog (EventStore authoritative) | Mongo yalnız okuma |
| Yer | Place (Mongo) | |
| Sohbet, snap, hikaye, bildirim | Notifications (Mongo + disk) | |
| Medya | Blog (yerel disk → S3 sonra) | |

## 7. Ölçeklenme yolu (MVP sonrası)
SignalR için Redis backplane; Mongo replica set; RabbitMQ kümesi; medya S3 + CDN; worker yatay ölçek
(consumer başına prefetch); Gateway birden çok instance. Ayrıntı `PERFORMANCE.md`, `DEPLOYMENT.md`.
