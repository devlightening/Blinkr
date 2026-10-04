/**
 * Geometry of the map markers, kept apart from the drawing so it can be tested. Place pins and signal pins (LivePin,
 * SignalPin) are a ring with a worded tag below it, anchored at the ring's centre.
 */

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

export const clusterLabel = (count: number) => (count > 99 ? '99+' : String(count));
