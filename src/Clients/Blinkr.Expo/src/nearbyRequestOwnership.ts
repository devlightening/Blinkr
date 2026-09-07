export type NearbySource = 'DEVICE' | 'MAP_CENTER';
export type NearbyReason = 'COMPOSER_OPEN' | 'MANUAL_REFRESH' | 'SOURCE_CHANGE' | 'MOVED';

export type NearbyOrigin = {
  accuracyMeters?: number | null;
  latitude: number;
  longitude: number;
  source: NearbySource;
  timestamp?: number | null;
};

export const DEFAULT_NEARBY_ORIGIN_EQUIVALENCE_METERS = 45;

export const distanceMeters = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const isEquivalentNearbyOrigin = (
  a: NearbyOrigin,
  b: NearbyOrigin,
  thresholdMeters = DEFAULT_NEARBY_ORIGIN_EQUIVALENCE_METERS,
) => a.source === b.source && distanceMeters(a, b) < thresholdMeters;

export type NearbyDecision =
  | { requestId: number; shouldAbortActive: boolean; status: 'start' }
  | { requestId: number; shouldAbortActive: false; status: 'reuse-inflight' | 'skip-same-applied' };

type ActiveRequest = {
  origin: NearbyOrigin;
  requestId: number;
};

export class NearbyRequestOwnership {
  private active: ActiveRequest | null = null;
  private appliedOrigin: NearbyOrigin | null = null;
  private nextRequestId = 1;

  begin(origin: NearbyOrigin, reason: NearbyReason): NearbyDecision {
    const active = this.active;
    const canReuseActive =
      active &&
      reason !== 'MANUAL_REFRESH' &&
      isEquivalentNearbyOrigin(active.origin, origin);

    if (canReuseActive) {
      return { requestId: active.requestId, shouldAbortActive: false, status: 'reuse-inflight' };
    }

    const canSkipApplied =
      !active &&
      this.appliedOrigin &&
      reason !== 'COMPOSER_OPEN' &&
      reason !== 'MANUAL_REFRESH' &&
      isEquivalentNearbyOrigin(this.appliedOrigin, origin);

    if (canSkipApplied) {
      return { requestId: this.nextRequestId - 1, shouldAbortActive: false, status: 'skip-same-applied' };
    }

    const decision = {
      requestId: this.nextRequestId,
      shouldAbortActive: Boolean(active),
      status: 'start' as const,
    };
    this.nextRequestId += 1;
    this.active = { origin, requestId: decision.requestId };
    return decision;
  }

  isActive(requestId: number) {
    return this.active?.requestId === requestId;
  }

  apply(requestId: number) {
    if (!this.active || this.active.requestId !== requestId) return false;
    this.appliedOrigin = this.active.origin;
    this.active = null;
    return true;
  }

  fail(requestId: number) {
    if (this.active?.requestId === requestId) this.active = null;
  }

  reset() {
    this.active = null;
  }
}
