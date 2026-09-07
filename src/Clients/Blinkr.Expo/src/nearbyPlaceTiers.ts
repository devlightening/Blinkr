import type { BlinkrPlace } from './types';

export const VERY_NEAR_RADIUS_METERS = 200;
export const PRIMARY_NEARBY_RADIUS_METERS = 600;
export const EXTENDED_NEARBY_RADIUS_METERS = 1500;
export const PRIMARY_NEARBY_LIMIT = 5;

const byDistance = (a: BlinkrPlace, b: BlinkrPlace) =>
  (a.distanceMeters ?? Number.POSITIVE_INFINITY) - (b.distanceMeters ?? Number.POSITIVE_INFINITY);

export const splitNearbyPlaces = (places: BlinkrPlace[]) => {
  const sorted = [...places]
    .filter((place) => Number.isFinite(place.distanceMeters ?? Number.POSITIVE_INFINITY))
    .sort(byDistance);

  const primary = sorted
    .filter((place) => (place.distanceMeters ?? Number.POSITIVE_INFINITY) <= PRIMARY_NEARBY_RADIUS_METERS)
    .slice(0, PRIMARY_NEARBY_LIMIT);
  const primaryIds = new Set(primary.map((place) => place.id));
  const extended = sorted.filter((place) =>
    !primaryIds.has(place.id)
    && (place.distanceMeters ?? Number.POSITIVE_INFINITY) <= EXTENDED_NEARBY_RADIUS_METERS);

  return { primary, extended };
};
