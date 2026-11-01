import type { Region } from 'react-native-maps';

/**
 * The heat layer (D-045, after Snap Map's Explore heat). Far out, the map shows where verified things are happening
 * right now instead of hundreds of pins; closer in, the pins come back. The server (`GET /api/places/heat`) does the
 * counting and the k-anonymity (a cell needs three different people); this module only decides when to ask and how a
 * cell is drawn. Pure, so plain-node tests run it (scripts/map-heat.test.ts).
 */
export type HeatLevel = 1 | 2 | 3;
export type HeatCell = { latitude: number; longitude: number; level: HeatLevel };
export type PlaceHeat = { cellDegrees: number; cells: HeatCell[] };

/** From about zoom 12 out (a district and wider) the heat replaces the pins. */
export const HEAT_MIN_DELTA = 0.08;
/** The server answers up to 3° across; further out nothing is asked and nothing is drawn. */
export const HEAT_MAX_DELTA = 3;

export const isHeatView = (region: Pick<Region, 'latitudeDelta' | 'longitudeDelta'>) => {
  const span = Math.max(region.latitudeDelta, region.longitudeDelta);
  return span >= HEAT_MIN_DELTA && span <= HEAT_MAX_DELTA;
};

/** A little over half a cell, so neighbouring cells just meet into one patch. */
export const heatRadiusMeters = (cellDegrees: number) => Math.round(cellDegrees * 111_320 * 0.6);

/** Fill strength by level; the colour is the theme's (MapScreen), only the weight lives here. */
export const heatAlpha = (level: HeatLevel) => (level === 3 ? 0.42 : level === 2 ? 0.3 : 0.18);

/** Only well-formed cells are drawn; anything else from the network is dropped, never guessed. */
export const readHeat = (payload: unknown): PlaceHeat => {
  const value = payload as { cellDegrees?: unknown; cells?: unknown } | null;
  const cellDegrees = typeof value?.cellDegrees === 'number' && value.cellDegrees > 0 ? value.cellDegrees : 0;
  const cells = Array.isArray(value?.cells) ? value.cells : [];
  return {
    cellDegrees,
    cells: cellDegrees === 0 ? [] : cells.filter((cell): cell is HeatCell =>
      Number.isFinite(cell?.latitude) && Number.isFinite(cell?.longitude) && (cell?.level === 1 || cell?.level === 2 || cell?.level === 3)),
  };
};

/**
 * Area activity (plan Faz 2.3, after Google's area busyness), for the closer views where the heat is not drawn: the
 * busiest cell in view. No cells means nothing is said - too few verified people is not the same as quiet.
 */
export const areaActivity = (heat: PlaceHeat | null): HeatLevel | null =>
  heat && heat.cells.length > 0 ? (Math.max(...heat.cells.map((cell) => cell.level)) as HeatLevel) : null;

/** Pins hide only when there is heat to show; an empty heat answer keeps the usual pins (never an empty map). */
export const showsHeatInsteadOfPins = (heatView: boolean, heat: PlaceHeat | null) => heatView && Boolean(heat && heat.cells.length > 0);
