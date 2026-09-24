# 07 — Gerçek zamanlılık (SignalR)

## Neden şimdi
Sohbet ~4 sn yoklama, yorumlar yenilemeyle geliyor. Instagram/Snapchat hissi için mesaj, yazıyor, yorum ve
bildirim anında gelmeli. SignalR .NET'e yerli, otomatik yeniden bağlanma ve gruplar hazır.

## Sunucu
```csharp
// NotificationsService.Application/Realtime/IRealtimePublisher.cs
public interface IRealtimePublisher
{
    Task ToUserAsync(Guid userId, string evt, object payload, CancellationToken ct = default);
    Task ToGroupAsync(string group, string evt, object payload, CancellationToken ct = default);
}

// NotificationsService.Api/Realtime/RealtimeHub.cs
[Authorize]
public sealed class RealtimeHub(IPostVisibility visibility) : Hub
{
    public override async Task OnConnectedAsync()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{Context.UserIdentifier}");
        await base.OnConnectedAsync();
    }
    public async Task JoinPost(string postId)
    {
        if (await visibility.CanReadAsync(postId, Context.GetHttpContext()!, Context.ConnectionAborted))
            await Groups.AddToGroupAsync(Context.ConnectionId, $"post:{postId}");
    }
    public Task LeavePost(string postId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, $"post:{postId}");
}

// NotificationsService.Api/Realtime/SignalRRealtimePublisher.cs
public sealed class SignalRRealtimePublisher(IHubContext<RealtimeHub> hub) : IRealtimePublisher
{
    public Task ToUserAsync(Guid userId, string evt, object payload, CancellationToken ct = default)
        => hub.Clients.Group($"user:{userId}").SendAsync(evt, payload, ct);
    public Task ToGroupAsync(string group, string evt, object payload, CancellationToken ct = default)
        => hub.Clients.Group(group).SendAsync(evt, payload, ct);
}
```
Program.cs:
```csharp
builder.Services.AddSignalR();
builder.Services.AddSingleton<IUserIdProvider, SubClaimUserIdProvider>();   // canonical user id claim
builder.Services.AddSingleton<IRealtimePublisher, SignalRRealtimePublisher>();
// JwtBearer: hub için query'den token
options.Events = new JwtBearerEvents { OnMessageReceived = ctx => {
    var token = ctx.Request.Query["access_token"];
    if (!string.IsNullOrEmpty(token) && ctx.HttpContext.Request.Path.StartsWithSegments("/hubs")) ctx.Token = token;
    return Task.CompletedTask; } };
app.MapHub<RealtimeHub>("/hubs/realtime");
```
Gateway route: `"realtime": { "ClusterId": "notifications", "Match": { "Path": "/hubs/{**catch-all}" } }`.

Yayın noktaları: sohbet mesaj/okundu/yazıyor servisleri (iki katılımcıya), `PostCommentAdded` consumer
(`post:{id}` grubu + gönderi sahibine bildirim), bildirim oluşturucu (`notification.created`).

Ölçek: tek instance için bellek içi; çok instance'ta `AddStackExchangeRedis` backplane (PERFORMANCE.md).

## İstemci
```ts
// src/realtime.ts
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
let connection: ReturnType<typeof build> | null = null;
const build = () => new HubConnectionBuilder()
  .withUrl(`${API_URL}/hubs/realtime`, { accessTokenFactory: () => getAccessToken() ?? '' })
  .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
  .configureLogging(LogLevel.None)
  .build();

export async function startRealtime() { connection ??= build(); if (connection.state === HubConnectionState.Disconnected) await connection.start().catch(() => undefined); }
export const isRealtimeLive = () => connection?.state === HubConnectionState.Connected;
export function on<T>(evt: string, handler: (p: T) => void) { connection?.on(evt, handler); return () => connection?.off(evt, handler); }
```
- Oturum açılınca başlar, çıkışta durur; `AppState` arka plana geçince 30 sn sonra kapanır, öne gelince açılır.
- **Geri düşüş:** `ConversationScreen` yoklaması yalnız `!isRealtimeLive()` iken çalışır (4 sn); bağlıyken 30 sn
  "güvenlik yoklaması" (kaçan olay onarımı). Aynı mesaj iki yoldan gelirse `id`/`clientId` ile tekilleştirilir.
- 401'de token yenilenir, bağlantı yeniden kurulur.

## Kabul
- [x] `scripts/test-realtime.ps1` (Node SignalR istemcisiyle): A mesaj atar → B < 1 sn alır; yorum → `post:{id}` — BLK-REALTIME-01 PASS
      grubuna düşer; yetkisiz `JoinPost` sessizce reddedilir; token yoksa bağlantı 401.
- [x] Mevcut `test-chat-thread.ps1` PASS (REST yolu bozulmadı). — PASS
- [~] Cihaz: uçak modu → geri gelince yeniden bağlanma.
