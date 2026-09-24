import { accuracyUncertain, placeSensitivity, type PlaceSensitivity } from './placeSafety';

/** The fields this rule needs; `ComposerArea` and `BlinkrPlace` both fit. */
type Area = { source: string; name: string; accuracyMeters: number; observationAccuracyMeters?: number | null };
type Place = { id: string; name: string; category?: string | null; distanceMeters?: number | null };

/** A place is only suggested when the person is clearly at it: this close, with a fix this good. */
export const SUGGEST_WITHIN_METERS = 100;

export type CameraPlace<P extends Place = Place> = {
  /** The place the share will start with, or null for "Yaklaşık alan". */
  place: P | null;
  /** What the chip on the camera says. */
  label: string;
  /** The fix is too loose to say "you are here" (> 100 m): the chip warns instead. */
  uncertain: boolean;
  /** Health, worship or education: the camera shows its one-time notice (plan-devam D11). */
  sensitivity: PlaceSensitivity | null;
};

/**
 * plan-devam D3: while the camera is open the device position is taken and the nearest place is shown on top of the
 * preview. Only a place within 100 m, with a fix of 100 m or better, is suggested - otherwise the share starts as an
 * approximate area and the person picks the place in the composer. Trust is still decided by the server.
 */
export function suggestCameraPlace<P extends Place>(area: Area | null, places: P[]): CameraPlace<P> | null {
  if (!area || area.source === 'map') return null;
  const uncertain = accuracyUncertain(area.observationAccuracyMeters ?? area.accuracyMeters);
  const nearest = uncertain
    ? null
    : places
      .filter((p) => p.distanceMeters != null && Number.isFinite(p.distanceMeters) && p.distanceMeters <= SUGGEST_WITHIN_METERS)
      .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))[0] ?? null;
  return { place: nearest, label: nearest?.name ?? area.name, uncertain, sensitivity: placeSensitivity(nearest?.category) };
}
