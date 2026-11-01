# E2E (plan-devam G13)

Maestro flows for the device-only parts of `docs/sinyal-mvp-plan/docs/plan/14_TESTING_QA_RELEASE.md` §3. They need a
simulator or phone with a dev build (`APP_ID` = its bundle id; Expo Go: `host.exp.exponent`) and the backend running:

    maestro test -e APP_ID=<id> -e EMAIL=<e> -e PASSWORD=<p> e2e/maestro/

They were written against the real accessibility labels and test ids but have **not been run** yet (no simulator in
the build environment); treat a first run as part of the release candidate check.

What already runs automatically, per scenario:

| # | Scenario | Automated today |
|---|---|---|
| 1 | Onboarding | test:ui (onboarding cards, birth year, EULA) |
| 2 | Map → card → confirm | test:ui card scene; `test-signal-card.ps1`; flow 02 |
| 3 | Share | test:ui composer + camera; `test-content-media-smoke.ps1`, `test-location-map-core.ps1`; flow 03 |
| 4 | Offline share | share-queue.test (retry/backoff rules); flow 04 (device) |
| 5 | Comment | `test-post-engagement.ps1`; test:ui thread panel |
| 6 | Follow | `test-follows.ps1`; test:ui profile |
| 7 | Private account | `test-follows.ps1` (requests) |
| 8 | Block | `test-safety.ps1`; flow 08 |
| 9 | Snap once | `test-snap-smoke.ps1`; test:ui snap viewer |
| 10 | Story | `test-stories.ps1`; test:ui story viewer |
| 11 | Place follow | not built (no place-follow feature in the MVP) |
| 12 | Account deletion | `test-account-lifecycle.ps1`; test:ui settings; flow 12 |
| 13 | Language | test:i18n (key parity + no hard-coded text); flow 13 |
