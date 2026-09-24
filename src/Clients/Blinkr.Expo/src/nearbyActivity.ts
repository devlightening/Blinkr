import { distanceMeters } from './nearbyRequestOwnership';
import { meaningfulTitle, signalLabels } from './presentation';
import { freshnessTier, isLive } from './freshness';
import { isFresh } from './productPresentation';
import type { BlinkrPlace, CoordinateSignal, SignalType, UnifiedMapResponse } from './types';
import { tx } from './i18n/tx';

/** How far around the device the "Yakında" tab looks. Matches the Discovery radius of the product rules. */
export const ACTIVITY_RADIUS_METERS = 1500;
/** The list is a decision aid, not a feed: it never grows past this many rows. */
export const ACTIVITY_LIMIT = 30;

export type ActivityFilter = 'all' | 'live' | 'crowd' | 'queue' | 'other';

export type ActivityItem = {
  key: string;
  kind: 'place' | 'signal';
  title: string;
  distanceMeters: number;
  signalType: SignalType | null;
  signalValue: string | null;
  /** When the observation was made; drives the age label. */
  observedAtUtc: string | null;
  /** Only Place state can be verified at the place (server-owned trust); coordinate signals never are. */
  verifiedLive: boolean;
  /** Verified and under 15 minutes old (`freshness.ts`): the only rows called "Canlı". */
  live: boolean;
  activeSignalCount: number;
  place?: BlinkrPlace;
  signal?: CoordinateSignal;
};

type Origin = { latitude: number; longitude: number };

/** 0 = observed in the last 15 minutes, 1 = older but still inside its lifetime (the shared rule, `freshness.ts`). */
const recencyBucket = (observedAtUtc: string | null, now: number) => (freshnessTier(observedAtUtc, null, now) === 'live' ? 0 : 1);

/**
 * Turns one map response into the ranked list of what is happening around the device right now.
 *
 * - Only fresh, unexpired information is listed: a Place needs an active state (FRESH or RECENT), a
 *   coordinate signal must pass `isFresh`. Catalog Places without activity never appear.
 * - Freshness first, then distance: a 10-minute-old report 900 m away outranks a 2-hour-old one next door,
 *   but inside the same freshness bucket the closest comes first.
 * - Distances are geodesic and measured from the device origin, never taken from the server row.
 */
export const buildNearbyActivity = (
  response: UnifiedMapResponse,
  origin: Origin,
  now = Date.now(),
  radiusMeters = ACTIVITY_RADIUS_METERS,
): ActivityItem[] => {
  const items: ActivityItem[] = [];

  for (const place of response.places ?? []) {
    const state = place.currentState;
    if (!state || !state.signalType) continue;
    if (state.freshness !== 'FRESH' && state.freshness !== 'RECENT') continue;
    if (state.expiresAtUtc && Date.parse(state.expiresAtUtc) <= now) continue;
    if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) continue;
    const distance = distanceMeters(origin, place);
    if (distance > radiusMeters) continue;
    items.push({
      key: `place:${place.id}`,
      kind: 'place',
      title: place.name,
      distanceMeters: distance,
      signalType: state.signalType,
      signalValue: state.signalValue ?? null,
      observedAtUtc: state.observedAtUtc ?? place.lastActivityUtc ?? null,
      verifiedLive: true,
      live: isLive(state.observedAtUtc ?? place.lastActivityUtc, state.expiresAtUtc, true, now),
      activeSignalCount: state.activeSignalCount ?? 1,
      place,
    });
  }

  for (const signal of response.signals ?? []) {
    if (!isFresh(signal.createdAtUtc, signal.expiresAt, now)) continue;
    if (!Number.isFinite(signal.latitude) || !Number.isFinite(signal.longitude)) continue;
    const distance = distanceMeters(origin, signal);
    if (distance > radiusMeters) continue;
    items.push({
      key: `signal:${signal.postId}`,
      kind: 'signal',
      // A title that just repeats the type ("Gözlem") would sit directly above the same word in the
      // summary line below it; fall back to where it is instead (sinyal-mvp-plan AUDIT #4).
      title: meaningfulTitle(signal.title, signal.signalType ? signalLabels[signal.signalType] : null) ?? signal.locationName ?? tx('common:approxArea', 'Yaklaşık alan'),
      distanceMeters: distance,
      signalType: signal.signalType ?? null,
      signalValue: signal.signalValue ?? null,
      observedAtUtc: signal.createdAtUtc ?? null,
      verifiedLive: false,
      live: false,
      activeSignalCount: 1,
      signal,
    });
  }

  return items
    .sort((a, b) => recencyBucket(a.observedAtUtc, now) - recencyBucket(b.observedAtUtc, now)
      || a.distanceMeters - b.distanceMeters
      || a.key.localeCompare(b.key))
    .slice(0, ACTIVITY_LIMIT);
};

export const filterActivity = (items: ActivityItem[], filter: ActivityFilter) => {
  switch (filter) {
    case 'live': return items.filter((item) => item.live);
    case 'crowd': return items.filter((item) => item.signalType === 'Crowd');
    case 'queue': return items.filter((item) => item.signalType === 'Queue');
    case 'other': return items.filter((item) => item.signalType !== 'Crowd' && item.signalType !== 'Queue');
    default: return items;
  }
};

/** A box around the origin that contains the whole search circle (used as the map/bounds request). */
export const boundsAround = (origin: Origin, radiusMeters = ACTIVITY_RADIUS_METERS) => {
  const latDelta = radiusMeters / 111_320;
  const lngDelta = radiusMeters / (111_320 * Math.max(0.2, Math.cos((origin.latitude * Math.PI) / 180)));
  return {
    minLat: origin.latitude - latDelta,
    maxLat: origin.latitude + latDelta,
    minLng: origin.longitude - lngDelta,
    maxLng: origin.longitude + lngDelta,
  };
};
