## CQRS + Event Sourcing Architecture (Blinkr)

### Overview
- **Write model**: Event Sourcing with EventStoreDB. Aggregates emit domain events; no relational write store.
- **Read model**: MongoDB denormalized projections; Redis for hot paths.
- **Messaging**: RabbitMQ for integration events from Write → Read.

### Write Model
- **Aggregates**: `PostAggregate` (title/content/visibility), like/comment as domain behaviors (optionally nested entities).
- **Domain Events**: `PostCreated`, `PostTitleUpdated`, `PostContentUpdated`, `PostVisibilityChanged`, `PostCommentAdded`, `PostLiked`, `PostUnliked`, `PostMediaAdded`, `PostMediaRemoved`.
- **Commands**: `CreatePost`, `UpdatePost`, `ChangeVisibility`, `AddComment`, `LikePost` (MediatR handlers).
- **Flow**: Load aggregate from EventStoreDB → execute business rules → `ApplyNewEvent` → append with expected version (optimistic concurrency).
- **Idempotency**: aggregate-level guards (e.g., prevent duplicate like) and command de-duplication where applicable.
- **Versioning**: forward-compatible event schemas; avoid breaking changes; include `version` in metadata.

### Integration and Outbox
- **Outbox**: Record integration events atomically with domain append.
  - Option A: Dedicated Postgres `outbox_messages` table (simple publisher).
  - Option B: Use EventStoreDB stream metadata + background projector to an outbox queue.
- **Publisher**: Background service reads Outbox FIFO → publishes to RabbitMQ → marks processed; retries with backoff; DLQ on max attempts.
- **Event Contract**: JSON with `EventId`, `OccurredOn`, `AggregateId`, `Version`, payload.

### Read Model
- **MongoDB**: Denormalized `posts` documents containing core fields and counters (`likeCount`, `commentCount`). Optionally a `comments` collection.
- **Indexes**: `{ createdAtUtc: -1 }`, `{ authorId: 1 }`, `{ visibility: 1 }`. Later: `location` 2dsphere for map features.
- **Consumers**: RabbitMQ consumers per event type; apply idempotent upserts.
- **Idempotency**: `processed_events` (unique index on `EventId`).
- **Redis**: Cache hot queries (e.g., public feed pages). TTL 60–120s; invalidate relevant keys on updates.

### Security
- **Auth**: JWT issued by `IdentityService`; verify on all write commands.
- **Authorization**: Policies to enforce post ownership/admin for updates/deletes.
- **Rate limiting**: Redis-based for comment/like endpoints.

### DI and Configuration
- **Write service**: EventStoreDB client, repository, Outbox repository, Publisher hosted service.
- **Read service**: Mongo client/DB, Redis multiplexer, RabbitMQ consumers (MassTransit or raw client).
- **Settings**: `appsettings.{Environment}.json` with connection strings; secrets from environment/.env in development.
- **Health**: `/health` endpoint checks EventStoreDB, RabbitMQ, MongoDB, Redis.

### Testing
- **Unit**: Aggregate behaviors (events emitted, invariants enforced).
- **Component**: append → outbox → publish → consume → Mongo projection.
- **Idempotency**: duplicate events do not change read state.
- **Concurrency**: parallel commands trigger expected version conflicts and are handled.
- **Cache**: cache hit/miss and invalidation behavior.

### Operations
- **Logging**: CorrelationId, EventId, AggregateId (Serilog → Seq).
- **Metrics**: published events, consumer lag, projection latency, cache hit/miss.
- **Alerts**: DLQ size, consumer crashes, Mongo write failures, append errors.
- **Backups**: snapshot MongoDB volumes (prod).

### Sprinting (High-level)
- S1: Aggregates/Events, EventStore append/read, Optimistic concurrency, Outbox + Publisher.
- S2: Mongo schema + indexes, Consumers + idempotency, Read API.
- S3: Redis caching + invalidation, rate limiting.
- S4: DLQ/Retry, Health/Metrics/Dashboards, load tests.
- S5: Map queries with 2dsphere and proximity endpoints.

