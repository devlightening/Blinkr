import { suggestCameraPlace } from '../src/cameraPlace';
import { placeSticker, stickerTilt } from '../src/cameraEffects';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

const area = (accuracy: number, source = 'device') => ({ source, name: 'Etimesgut civarı', accuracyMeters: accuracy, observationAccuracyMeters: accuracy });
const places = [
  { id: 'far', name: 'Park', category: 'PARK', distanceMeters: 240 },
  { id: 'bim', name: 'BİM', category: 'SUPERMARKET', distanceMeters: 60 },
  { id: 'school', name: 'Okul', category: 'EDUCATION', distanceMeters: 90 },
];

run('the nearest place within 100 m is suggested', () => {
  const s = suggestCameraPlace(area(20), places);
  check(s?.place?.id === 'bim' && s.label === 'BİM' && !s.uncertain && s.sensitivity === null, JSON.stringify(s));
});
run('nothing close enough: approximate area', () => {
  const s = suggestCameraPlace(area(20), [places[0]]);
  check(s?.place === null && s.label === 'Etimesgut civarı', 'area label');
});
run('a loose fix never claims a place', () => {
  const s = suggestCameraPlace(area(180), places);
  check(s?.place === null && s.uncertain, 'uncertain');
});
run('a school nearby carries its sensitivity', () => {
  const s = suggestCameraPlace(area(15), [places[2]]);
  check(s?.sensitivity === 'education', 'education');
});
run('a map-picked area or no area has no chip', () => {
  check(suggestCameraPlace(area(20, 'map'), places) === null && suggestCameraPlace(null, places) === null, 'none');
});
run('stickers get a small alternating tilt (2-4 degrees)', () => {
  for (let i = 0; i < 6; i += 1) {
    const deg = Math.abs(stickerTilt(i, 1_000 + i) * 180 / Math.PI);
    check(deg >= 2 && deg <= 4, `tilt ${deg}`);
  }
  check(Math.sign(stickerTilt(0, 5)) !== Math.sign(stickerTilt(1, 5)), 'alternates');
  const placed = placeSticker([], 'fire', { width: 300, height: 400 }, 7);
  check(placed[0].rotation !== 0, 'placed sticker is tilted');
});
