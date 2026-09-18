# BLK-PRODUCT-08: Implementation and Validation

Status: PARTIAL - PHYSICAL_RETEST_REQUIRED. Last automated verification: 2026-09-13.
This report is implementation evidence, not a change to the Product Constitution.

## Publication Model

- Server-owned effective presence distance <=200m: VERIFIED_LIVE.
- Effective distance >200m and <=600m: NEARBY_PLACE_POST, allowed as recent Place content, excluded from trusted live aggregation.
- Extended discovery/selection to 1500m does not authorize publication.
- Client-supplied trust/distance flags never authorize publication. Preview and publication independently use the centralized policy.
- Coordinate posts remain separate; no fake Place is created.
- Accuracy allowance is capped at 50m; reported accuracy above 150m is rejected.
- Valid Polygon/MultiPolygon geometry is evaluated before point fallback. Polygon holes do not count as presence.
- Events without recorded publication trust fail closed for trusted live aggregation.
- Projection queries retain verified and nearby observations separately so a burst of nearby content cannot evict trusted observations at the query limit.

## Catalog and Mobile

Existing OSM IDs were preserved. On 2026-09-08, the existing local PBF was used in geometry-only mode: 13,249 existing records updated, zero Places imported, zero failed writes. Catalog counts at that time: 34,719 total / 34,703 OSM Places. No PBF was downloaded.

Local name/category search is distance-first and preserves separate same-name branches. The map requests active Places only, not the entire imported catalog. Coordinate signals are clustered and expire locally; failed refreshes preserve existing markers.

Mobile now uses a four-step composer, compact nearby selection, dedicated local search, server-derived trust labels, semantic Place/Signal markers, shared in-tree sheets, and revised Place/coordinate details. The focused map/compose/profile navigation is preserved. Original vector brand assets generate app/adaptive icons. Raw infrastructure errors are mapped to user-facing messages.

## Reproduce

From repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-blinkr-dev.ps1
powershell -ExecutionPolicy Bypass -File scripts/test-product-08.ps1
```

The acceptance runner requires a healthy Gateway and downstream services. It creates test accounts and short-lived posts against existing real Places. It does not insert fixture Places. For a heavier aggregation regression:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/test-place-posting-real-catalog.ps1 -Stress
```

## Results

Verified on 2026-09-13:

- All canonical stack services and Gateway downstream routes healthy. The auth route check expects 405 for GET; the separate auth smoke performs real registration/login.
- Blog API build: success, zero errors, four existing AutoMapper/OpenTelemetry vulnerability warnings. Place API build: success, zero errors/warnings.
- Twelve policy/aggregation checks passed, including 100m, 350m, 900m, bounded accuracy, polygon interior/hole/fallback, nearby exclusion and legacy fail-closed behavior.
- Real-catalog checks through Gateway passed: large polygon boundary >500m from centroid and distinct same-name BIM branches.
- Real publication chain passed: nearby trust survives projection, does not alter live state, and activates exactly one Place marker; verified publication determines live state; spoofed client trust cannot authorize a 900m write.
- Existing smoke scripts passed: test-nearby-distance-contract, test-nearby-place-ux-core, test-location-map-core, test-place-live-signal, test-content-media-smoke, test-auth-gateway-smoke.
- Expo typecheck, nearby ownership/tier/cluster tests, product presentation tests passed.
- Browser component tests passed: nearby selection/collapse, signal value, nearby and coordinate publication, disabled submitting button, friendly network error, close/reopen, same-name branch search, save toggle and responsive detail at widths 320/430/820.
- iOS and Android Expo exports passed. These are JavaScript/Hermes exports, not signed native builds.
- The 21-nearby-post aggregation stress check passed on 2026-09-08; it was not repeated in the final 2026-09-13 runner.

Final real-catalog run identifiers:

| Evidence | ID |
| --- | --- |
| Real polygon | ab7f076b-e13a-4a92-91bb-c9d8892152d6 |
| Real point Place | 4a0641bd-bdcc-4de4-a6e0-e65e5c032966 |
| Nearby publication | ec1b4c8e-e152-4474-8cda-7448ff2099b8 |
| Verified publication | 672920a0-f060-4c72-af30-bf822483b952 |
| Coordinate regression publication | 15de622c-1825-4a89-bc74-d21ba0b0f5c5 |
| Media regression publication | e274459f-d4ea-4b0a-a678-0fc2bd17cdac |

An initial Windows PowerShell test attempt failed because locationName serialized as a JSON object rather than a string. The test payload now explicitly uses a string and UTF-8 bytes; the complete runner subsequently passed. Error response details are retained in test diagnostics.

UI screenshots are regenerated under src/Clients/Blinkr.Expo/.tmp/product-ui. The harness renders production composer/detail components with API/native-port test adapters. It does NOT prove native map rendering, camera/video playback, GPS or iOS touch stability.

## Physical iPhone Acceptance

Run npm run start:lan from src/Clients/Blinkr.Expo with both phones on the computer's LAN. At final verification Gateway was http://192.168.1.38:5080. The IP is not permanent; the launcher detects it. Metro was not left running: the background launch attempt was blocked by the execution environment.

1. A: Open composer with DEVICE location. Real nearby Places should appear once and settle. Search a category and same-name chain; confirm the intended branch stays selected.
2. B: Select a point Place about 350m away. Publish as nearby content. On phone B, open its Place detail: content appears, but trusted crowd/queue state is not changed by that post.
3. C: Move sufficiently close and obtain a fresh accurate fix. Publish a structured observation. Confirm the server-derived verified label and trusted state on phone B.
4. D: Stand inside a catalog park with persisted polygon geometry, well away from its centroid. Presence should succeed. Do not simulate this by choosing the map center.
5. E: Publish a coordinate signal with photo/video. Verify a separate signal pin, approximate location, full content and playback on phone B.
6. F: Repeatedly open/close Place and Signal details, composer and profile; pan/zoom/scan between interactions. No invisible overlay should intercept touches after close.
7. Restart the app, move the map away/back and briefly disconnect Wi-Fi. Existing markers/results should remain during failed refresh; loading must settle, retry must recover without request storms.
8. Test keyboard, large text, VoiceOver, camera denial and app background/foreground. Capture both phones' screenshots/video plus PostIds. Record physical results separately from API smoke results.

## Files Changed

- BlogService: PlaceProximityPolicy, IPlaceLookupService, CreatePostCommandHandler, new PlacePresenceController, MapController, aggregate/event and both event publishers; Application adds the existing centrally versioned NetTopologySuite dependency.
- Shared.Events: optional PublicationTrust on the post-created integration contract.
- PlaceService: state calculator, DTOs, PlacesController, Place/PlaceSignal documents, repository and post-created consumer.
- OsmPlaceImporter: valid ring geometry persistence and existing-record geometry-only update mode.
- Expo: App, api/types/theme, AuthScreen, MapScreen, SignalComposer, PostDetailSheet; new Sheet, PlacePicker, BlinkrMapMarker, BlinkrMark, PlaceSymbol, SignalSymbol, presentation/productPresentation/mapClusters modules.
- Expo assets/config: original SVG brand variants, icon PNGs, app.json, package files, build-brand script and README.
- Tests: tests/PlacePosting; new real-catalog/product runner; existing live-signal and media smoke scripts now use real Places; Expo cluster/product/UI tests and test adapters.
- This implementation report.

## Remaining Limits

- Physical two-device and native iOS touch/GPS/media acceptance remains unverified. No release tag, commit or push was made.
- Complex OSM relations whose boundaries require assembling split ways retain point fallback; not every catalog Place has polygon geometry.
- GPS is device-reported, not an attested anti-spoofing system. The server owns distance/trust calculation, not proof that hardware coordinates cannot be forged.
- Map-point selection uses the current map center, not a separate draggable map-picker flow. Marker selection has scale/outline; dedicated sheet/pulse animations are not implemented.
- Saved Places are device-local, with no synchronized saved-list screen. Sharing uses the public Place location, not a Blinkr deep link.
- Existing NuGet and npm audit advisories remain; dependency security cleanup and signed native release validation are not complete. Expo Go compatibility must match this project's SDK 54.

Suggested commit: feat(product): rebuild Blinkr place trust, mobile composer and live map experience
