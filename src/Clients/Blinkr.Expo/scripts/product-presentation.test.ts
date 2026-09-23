import { canPublishAt, friendlyError, freshnessOpacity, freshnessProgress, isFresh, isFreshnessPulseDue, recheckSignal, signalOptions, signalValueLabel, trustLabel } from '../src/productPresentation';
import { formatCategory, meaningfulTitle, signalLabels } from '../src/presentation';
import { SIGNAL_CATALOG, SIGNAL_TTL_MINUTES, formatLifetime } from '../src/signalCatalog';
import type { ComposerArea, SignalType } from '../src/types';
function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const area: ComposerArea = { name: 'Area', source: 'device', accuracyMeters: 22, region: { latitude: 40, longitude: 32, latitudeDelta: .01, longitudeDelta: .01 } };
const place = { id: 'branch-a', name: 'BIM', latitude: 40, longitude: 32, distanceMeters: 352 };
check(canPublishAt(area), 'coordinate fallback must remain available');
check(canPublishAt({ ...area, place, proximity: { allowed: true, trustLevel: 'NEARBY_PLACE_POST', thresholdMeters: 600 } }), '352m nearby selection can publish');
check(!canPublishAt({ ...area, place, proximity: { allowed: false, trustLevel: 'OUT_OF_RANGE', thresholdMeters: 600 } }), 'server denied presence cannot publish');
check(!canPublishAt({ ...area, place }), 'unresolved server presence cannot publish');
check(trustLabel('VERIFIED_LIVE') === 'Konum doğrulandı', 'verified label');
check(trustLabel('NEARBY_PLACE_POST') === 'Yakındaki yer paylaşımı', 'nearby label');
check(formatCategory('MOSQUE') === 'Cami' && formatCategory('PARK') === 'Park', 'category labels');
check(signalValueLabel('Crowd', 'BUSY') === 'Kalabalık', 'legacy uppercase signal label');
check(friendlyError(new Error('HTTP 502 Network request timed out')).indexOf('502') < 0, 'no raw network error');
const now = Date.now();
check(isFresh(new Date(now - 60000).toISOString(), null, now), 'fresh marker remains');
check(!isFresh(new Date(now - 4 * 3600000).toISOString(), null, now), 'expired marker removed');
check(!isFresh(new Date(now - 60000).toISOString(), new Date(now - 1000).toISOString(), now), 'explicit expiry removed');
check(freshnessOpacity(new Date(now - 2 * 3600000).toISOString(), now) < 1, 'older marker fades');
// "Hâlâ böyle mi?" only for a fresh, structured live state with a value the composer knows.
const live = { signalType: 'Crowd' as const, signalValue: 'BUSY', freshness: 'FRESH', expiresAtUtc: new Date(now + 3600000).toISOString() };
check(JSON.stringify(recheckSignal(live, now)) === JSON.stringify({ type: 'Crowd', value: 'Busy' }), 'legacy uppercase value is offered in its canonical spelling');
check(recheckSignal({ ...live, freshness: 'RECENT' }, now) !== null, 'RECENT state can be rechecked');
check(recheckSignal({ ...live, freshness: 'STALE' }, now) === null, 'stale state is not offered');
check(recheckSignal({ ...live, freshness: 'NONE' }, now) === null, 'no live state is not offered');
check(recheckSignal({ ...live, expiresAtUtc: new Date(now - 1000).toISOString() }, now) === null, 'expired state is not offered');
check(recheckSignal({ ...live, signalType: 'GeneralObservation' }, now) === null, 'free-text observations have nothing to confirm');
check(recheckSignal({ ...live, signalValue: 'SOMETHING_ELSE' }, now) === null, 'unknown values are not guessed');
check(recheckSignal({ ...live, signalValue: null }, now) === null && recheckSignal(null, now) === null && recheckSignal(undefined, now) === null, 'missing state or value');
// A title that just restates the type badge ("Gözlem" next to "Gözlem") is dropped, not shown twice.
check(meaningfulTitle('Gözlem', 'Gözlem') === null, 'exact match dropped');
check(meaningfulTitle('  gözlem  ', 'Gözlem') === null, 'case/whitespace-insensitive match dropped');
check(meaningfulTitle('Bekleme süresi 10 dakika', 'Gözlem') === 'Bekleme süresi 10 dakika', 'a real title is kept');
check(meaningfulTitle('', 'Gözlem') === null && meaningfulTitle(null, 'Gözlem') === null && meaningfulTitle(undefined, 'Gözlem') === null, 'blank title is null, not a placeholder string');
check(meaningfulTitle('Bir şey', null) === 'Bir şey', 'no type label to compare against still keeps a real title');
// FreshnessRing's progress: 1 at the moment of posting, 0 once expired, and honest (1, not a guess) without a TTL.
check(freshnessProgress(new Date(now - 30 * 60000).toISOString(), new Date(now + 30 * 60000).toISOString(), now) === 0.5, 'halfway through the window is 0.5');
check(freshnessProgress(new Date(now).toISOString(), new Date(now + 60 * 60000).toISOString(), now) === 1, 'just posted is 1');
check(freshnessProgress(new Date(now - 60 * 60000).toISOString(), new Date(now).toISOString(), now) === 0, 'right at expiry is 0');
check(freshnessProgress(new Date(now - 2 * 60 * 60000).toISOString(), new Date(now - 60 * 60000).toISOString(), now) === 0, 'past expiry clamps to 0, not negative');
check(freshnessProgress(null, null, now) === 1 && freshnessProgress(new Date(now).toISOString(), null, now) === 1, 'no TTL to draw a fraction of: shown as full rather than guessed');
check(isFreshnessPulseDue(new Date(now - 5 * 60000).toISOString(), now) && !isFreshnessPulseDue(new Date(now - 20 * 60000).toISOString(), now) && !isFreshnessPulseDue(null, now), 'pulse only for genuinely young signals');
// signalCatalog.ts is the single source; signalLabels/signalOptions (presentation.ts/productPresentation.ts) must
// still answer exactly what they always did, for the many existing call sites that import them by those old names.
const allTypes: SignalType[] = ['GeneralObservation', 'Crowd', 'Queue', 'TemporaryStatus', 'Event', 'Offer', 'NewOpening'];
check(allTypes.every((type) => signalLabels[type] === SIGNAL_CATALOG[type].label), 'signalLabels matches the catalogue for every type');
check(allTypes.every((type) => JSON.stringify(signalOptions[type]) === JSON.stringify(SIGNAL_CATALOG[type].options)), 'signalOptions matches the catalogue for every type, undefined where the catalogue has none');
check(signalLabels.Crowd === 'Doluluk' && signalLabels.GeneralObservation === 'Gözlem', 'labels read as before');
console.log('product presentation tests passed');
{ // lifetime shown in the composer mirrors the server defaults (CreatePostCommandHandler.GetDefaultExpiry)
  check(SIGNAL_TTL_MINUTES.Crowd === 60 && SIGNAL_TTL_MINUTES.Queue === 60 && SIGNAL_TTL_MINUTES.TemporaryStatus === 180, 'short-lived');
  check(SIGNAL_TTL_MINUTES.Event === 1440 && SIGNAL_TTL_MINUTES.Offer === 1440 && SIGNAL_TTL_MINUTES.NewOpening === 10080 && SIGNAL_TTL_MINUTES.GeneralObservation === 1440, 'long-lived');
  check(formatLifetime(60) === '1 sa' && formatLifetime(180) === '3 sa' && formatLifetime(1440) === '1 gün' && formatLifetime(10080) === '7 gün', 'tr');
  check(formatLifetime(60, 'en') === '1 h' && formatLifetime(1440, 'en') === '1 day' && formatLifetime(10080, 'en') === '7 days' && formatLifetime(30) === '30 dk', 'en / minutes');
}
