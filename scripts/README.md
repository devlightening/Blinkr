# Blinkr Scripts

## Local Development Stack

Start the backend stack from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-blinkr-dev.ps1
```

Check status:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\status-blinkr-dev.ps1
```

Stop application processes started by the dev script:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-blinkr-dev.ps1
```

Stop application processes and Docker infrastructure:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-blinkr-dev.ps1 -Infrastructure
```

Expo physical device testing:

```cmd
cd src\Clients\Blinkr.Expo
set EXPO_PUBLIC_BLINKR_API_URL=http://<LAN-IP>:5080
npx expo start --lan
```

The canonical backend startup path is `start-blinkr-dev.ps1`. Older mobile-backend scripts delegate to it.

## Local OSM Place Import

Blinkr beta uses a deterministic local POI catalog for the nearby place picker. Public Overpass availability is not required for the normal mobile composer path.

1. Download a regional OpenStreetMap extract, for example Turkey or Ankara, as `.osm.pbf` from a trusted OSM extract provider such as Geofabrik.
2. Keep the extract outside git, for example `C:\osm\turkey-latest.osm.pbf`.
3. Start MongoDB.
4. Import places:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-place-catalog.ps1 -PbfPath C:\osm\turkey-latest.osm.pbf
```

You can also pass a verified regional extract URL:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-place-catalog.ps1 -DownloadUrl https://download.geofabrik.de/europe/turkey-latest.osm.pbf
```

5. Confirm nearby places through Gateway after services are running:

```powershell
Invoke-WebRequest -UseBasicParsing "http://localhost:5080/api/places/nearby?lat=39.9334&lon=32.8597&radiusMeters=900&limit=20"
```

Or print a compact local catalog table:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-local-place-catalog.ps1 -Latitude 39.9334 -Longitude 32.8597 -RadiusMeters 1000
```

The importer is idempotent. Re-importing the same extract updates existing `ExternalProvider=osm` / `ExternalId=node|way|relation/id` records instead of duplicating places.

## Synthetic Test Data (Osmaniye)

`seed-osmaniye.cjs` creates test data **only through the public Gateway API**, so every post flows through
EventStoreDB -> RabbitMQ -> projection worker -> Mongo (it never writes to Mongo directly):

```powershell
node .\scripts\seed-osmaniye.cjs --ahmet-total 20030 --concurrency 6
```

- 8 synthetic users `sentetik_01..08` (password `Sentetik!2026`).
- Posts on real Osmaniye catalog places, observed at the place (server marks them `VERIFIED_LIVE`), some with generated photos.
- Free-coordinate signals across the city.
- Bulk posts for the existing user `ahmet@gmail.com` until he has `--ahmet-total` posts. These expire after 30 minutes so the live map is not flooded; the profile list keeps them. Post text ends in a running number `(#00042)` so ordering can be checked in the app.

The map only shows posts from the last 3 hours (freshness over volume), so synthetic map data ages out. Create a fresh
set any time with `node .scriptsseed-osmaniye.cjs --refresh-map --skip-bulk` (about 3 minutes, leaves ahmet's posts alone).

It is resumable and writes `artifacts/synthetic/osmaniye-manifest.json` (git-ignored) with every created id.
The projection lags the API by a few minutes for large runs (about 25 posts/s); the profile total catches up on its own.

BlogService limits every device/IP to 100 requests per minute. For a large run start BlogService with a higher
limit, then restart it normally afterwards (the default stays 100):

```powershell
$env:RateLimiting__GlobalPermitLimit = "30000"   # only for the BlogService process you start for the run
```

Remove exactly what was created (deletes as each post's owner, so it is an event like any other):

```powershell
node .\scripts\cleanup-synthetic.cjs --dry-run
node .\scripts\cleanup-synthetic.cjs --concurrency 6      # same rate-limit note applies
```

`test-author-posts-privacy.ps1` checks that listing posts by author works for the author and never reveals which
anonymous posts belong to whom.

`seed-chat.cjs` gives ahmet 20 synthetic Osmaniye contacts (`<name>@blinkr.local`, password `Sentetik!2026`, the same convention as `seed-osmaniye.cjs`) with place-decision style conversations through the public chat API; 8 of them end with unread messages (13 in total) so the Sohbet badge can be tested. It is idempotent (`--force` re-sends), lists everything in `artifacts/synthetic/chat-manifest.json`, and `--print-cleanup` prints the conversation ids because the chat API has no delete endpoint.

`test-snap-smoke.ps1` (BLK-SNAP-01, 34 checks) covers view-once snaps end to end: only participants can send, the recipient opens a snap exactly once and can fetch its media only inside the viewing window, the sender and outsiders are refused, EXIF is stripped from photos, expired snaps cannot be opened and stop counting as unread, a waiting snap survives opening the conversation. It rewrites message timestamps in Mongo (`blinkr_mongodb` container) to test the window and expiry without waiting.

`test-place-search.ps1` (BLK-SEARCH-01) checks the map search: wide radius, nearest first, everyday category words, Turkish dotted I, clamping and bad input.

BLK-SEARCH-01 also proves search v2 against the real catalogue: a cafe about 1 km from the Adana test origin is found by its name (`soulmate`, `soul mate`, mixed case, without Turkish letters, one-letter typos such as `soulmte`), it ranks first inside 1.5 km, `expand=true` reaches other cities, and without `expand` the result stays local.

`test-friends.ps1` (BLK-FRIENDS-01, 33 checks) covers friends and the public profile through the Gateway: request / idempotent re-request / accept / decline / cancel / remove, only the addressee can answer, asking back someone who asked you means yes, the 7-day cooldown after a decline, the `relation` on search and profile lookups, `/api/users/me` counts, the bio (trim, 160-character limit, clear), and privacy (a public profile has no e-mail, friend list or friend count, and nobody sees another person's friendships). It creates three throw-away users per run.

`test-safety.ps1` (BLK-SAFETY-01, 33 checks) covers block and report through the Gateway: blocking ends the friendship, hides both people from each other in search and profiles (404 for the blocked person, "blocked" for the blocker), stops friend requests, and stops chat in both directions (existing conversation, new conversation, snaps) with a refusal that never says who blocked whom; unblocking restores chat but not the friendship; chat with everybody else is untouched; reports are accepted once per reporter and target, validated (reason, type, malformed signal id, 300-character note) and never let you report yourself. It creates three throw-away users per run and needs IdentityService and NotificationsService both running (chat asks Identity about blocks).

`test-place-batch.ps1` (BLK-BATCH-01) checks `GET /api/places/batch`: real catalogue places come back in one call with their state, junk ids and repeats are ignored, no ids is an empty list, and 40 unknown ids are answered calmly.

`test-avatar.ps1` (BLK-AVATAR-01) checks the avatar catalogue: a catalogue key is accepted and returned by login, user lookup and search, invalid keys (`999`, `abc`, `2533`, markup) are a 400 `INVALID_AVATAR` and change nothing, and `null` restores the default. It creates one throw-away user per run.

`test-auth-registration.ps1` (BLK-AUTH-02) checks that registration keeps usernames and e-mails unique regardless of
case, rejects bad input with stable `{ error, message }` bodies (409 `USERNAME_TAKEN` / `EMAIL_TAKEN`, 400
`INVALID_USERNAME` / `INVALID_EMAIL` / `INVALID_PASSWORD`) and that login ignores the case of the e-mail. It creates
one throw-away `reg_user_*@blinkr.local` account per run.
