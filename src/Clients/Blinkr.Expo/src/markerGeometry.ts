/**
 * Geometry of the map markers, kept apart from the drawing so it can be tested.
 *
 * Place pin:  a teardrop with a sharp tip (a clear anchor point: the tip is the exact location).
 * Signal bubble: a round speech bubble with a small tail, for signals that are not tied to a Place.
 * Both are drawn in a 56-unit design space with a 6-unit margin for the glow, and anchored by their tip.
 */
export type MarkerGeometry = {
  /** Whole marker including the margin, in design units. */
  width: number;
  height: number;
  /** The exact location point in the design space (without margin). */
  tipX: number;
  tipY: number;
  /** Centre and radius of the round head that holds the glyph. */
  headX: number;
  headY: number;
  headRadius: number;
  pad: number;
};

export const PLACE_PIN: MarkerGeometry = { width: 68, height: 80, tipX: 28, tipY: 66, headX: 28, headY: 26, headRadius: 22, pad: 6 };
export const SIGNAL_BUBBLE: MarkerGeometry = { width: 68, height: 74, tipX: 28, tipY: 62, headX: 28, headY: 28, headRadius: 24, pad: 6 };

export const PLACE_PIN_PATH = 'M28 66 C28 66 6 44 6 26 A22 22 0 1 1 50 26 C50 44 28 66 28 66 Z';
export const SIGNAL_BUBBLE_PATH = 'M28 62 L18.4 50 A24 24 0 1 1 37.6 50 Z';

/** react-native-maps anchor (0..1 of the marker view) that puts the tip exactly on the coordinate. */
export const anchorOf = (geometry: MarkerGeometry) => ({
  x: (geometry.tipX + geometry.pad) / geometry.width,
  y: (geometry.tipY + geometry.pad) / geometry.height,
});

/** Markers without live activity are drawn smaller so a crowded viewport stays readable. */
export const COMPACT_SCALE = 0.78;
export const markerScale = (compact: boolean) => (compact ? COMPACT_SCALE : 1);

const THREE_HOURS = 3 * 60 * 60_000;

/**
 * Share of a signal's lifetime that is left (1 = just posted, 0 = expired). Signals without an explicit
 * expiry live three hours from creation, matching the map's freshness window.
 */
export const lifetimeFraction = (createdAt?: string | null, expiresAt?: string | null, now = Date.now()) => {
  const created = createdAt ? Date.parse(createdAt) : Number.NaN;
  if (!Number.isFinite(created)) return 0;
  const parsedExpiry = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const expires = Number.isFinite(parsedExpiry) ? parsedExpiry : created + THREE_HOURS;
  const total = expires - created;
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (expires - now) / total));
};

/** stroke-dasharray for a ring that shows `fraction` of a full circle of the given radius. */
export const ringDash = (fraction: number, radius: number) => {
  const circumference = 2 * Math.PI * radius;
  const shown = circumference * Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  return `${shown.toFixed(2)} ${circumference.toFixed(2)}`;
};

/** Heat halo behind a cluster: grows with the count but stays bounded (the marker view is a fixed size). */
export const clusterHaloRadius = (count: number) => 26 + Math.min(14, Math.round(Math.log2(Math.max(1, count)) * 3));

export const clusterLabel = (count: number) => (count > 99 ? '99+' : String(count));
