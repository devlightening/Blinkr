/**
 * Geometry of the map markers, kept apart from the drawing so it can be tested.
 *
 * Signal bubble: a round speech bubble with a small tail, for signals that are not tied to a Place, drawn in a 56-unit
 * design space with a 6-unit margin for the glow and anchored by its tip. Place pins (LivePin) are a ring with an
 * optional tag below it, anchored at the ring's centre.
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

export const SIGNAL_BUBBLE: MarkerGeometry = { width: 68, height: 74, tipX: 28, tipY: 62, headX: 28, headY: 28, headRadius: 24, pad: 6 };

export const SIGNAL_BUBBLE_PATH = 'M28 62 L18.4 50 A24 24 0 1 1 37.6 50 Z';

/** react-native-maps anchor (0..1 of the marker view) that puts the tip exactly on the coordinate. */
export const anchorOf = (geometry: MarkerGeometry) => ({
  x: (geometry.tipX + geometry.pad) / geometry.width,
  y: (geometry.tipY + geometry.pad) / geometry.height,
});

/** LivePin layout (pt): padding around the ring, the tag below it, ring sizes. */
export const LIVE_PIN = { pad: 6, tagGap: 4, tagHeight: 20, quiet: 32, normal: 44, selected: 52 } as const;

/** Ring diameter: the selected pin grows; a catalogue place with nothing to say stays small. */
export const livePinSize = (quiet: boolean, selected: boolean) => (selected ? LIVE_PIN.selected : quiet ? LIVE_PIN.quiet : LIVE_PIN.normal);

/** Marker anchor at the ring's centre, wherever the optional tag below makes the view end. */
export const livePinAnchor = (quiet: boolean, selected: boolean, showTag: boolean) => {
  const size = livePinSize(quiet, selected);
  const height = LIVE_PIN.pad * 2 + size + (showTag ? LIVE_PIN.tagGap + LIVE_PIN.tagHeight : 0);
  return { x: 0.5, y: (LIVE_PIN.pad + size / 2) / height };
};

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

export const clusterLabel = (count: number) => (count > 99 ? '99+' : String(count));
