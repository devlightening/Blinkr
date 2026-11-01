import { areaActivity, heatAlpha, heatRadiusMeters, isHeatView, readHeat, showsHeatInsteadOfPins } from '../src/mapHeat';
import { parseFlagOverrides } from '../src/flagRules';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('heat only from a district out, and not beyond what the server answers', () => {
  check(!isHeatView({ latitudeDelta: 0.02, longitudeDelta: 0.02 }), 'street level shows pins');
  check(isHeatView({ latitudeDelta: 0.06, longitudeDelta: 0.1 }), 'the wider side decides');
  check(isHeatView({ latitudeDelta: 0.5, longitudeDelta: 0.5 }), 'a city is heat');
  check(!isHeatView({ latitudeDelta: 5, longitudeDelta: 5 }), 'a country is not asked');
});

run('cells are drawn from the server answer only when well formed', () => {
  const heat = readHeat({ cellDegrees: 0.01, cells: [{ latitude: 37.055, longitude: 36.255, level: 2 }, { latitude: 'x', longitude: 1, level: 1 }, { latitude: 1, longitude: 1, level: 7 }] });
  check(heat.cells.length === 1 && heat.cells[0].level === 2, 'bad cells dropped');
  check(readHeat(null).cells.length === 0 && readHeat({ cellDegrees: 0, cells: [{ latitude: 1, longitude: 1, level: 1 }] }).cells.length === 0, 'no size, no cells');
});

run('circle size and weight', () => {
  check(heatRadiusMeters(0.01) === 668, `0.01° cell -> ${heatRadiusMeters(0.01)} m`);
  check(heatAlpha(3) > heatAlpha(2) && heatAlpha(2) > heatAlpha(1), 'more people, stronger fill');
});

run('pins hide only when there is heat to show (never an empty map)', () => {
  const some = readHeat({ cellDegrees: 0.01, cells: [{ latitude: 1, longitude: 1, level: 1 }] });
  check(showsHeatInsteadOfPins(true, some), 'heat view with cells');
  check(!showsHeatInsteadOfPins(true, readHeat({ cellDegrees: 0.01, cells: [] })), 'empty heat keeps pins');
  check(!showsHeatInsteadOfPins(true, null) && !showsHeatInsteadOfPins(false, some), 'not loaded / close in keeps pins');
});

run('feature flags: "a,-b" switches flags on and off, unknown names are ignored', () => {
  const parsed = parseFlagOverrides(' -heatLayer , nope ');
  check(parsed.heatLayer === false && !('nope' in parsed), 'off and unknown');
  check(parseFlagOverrides('heatLayer').heatLayer === true && Object.keys(parseFlagOverrides(null)).length === 0, 'on and empty');
});

run('area activity: the busiest cell in view, and silence without data', () => {
  check(areaActivity(readHeat({ cellDegrees: 0.0025, cells: [{ latitude: 1, longitude: 1, level: 1 }, { latitude: 1, longitude: 2, level: 3 }] })) === 3, 'busiest cell');
  check(areaActivity(readHeat({ cellDegrees: 0.0025, cells: [] })) === null && areaActivity(null) === null, 'no cells is not "quiet"');
});
