import { CAMERA_LENSES, MAX_STICKERS, STICKERS, clampToFrame, clampZoom, clockLabel, flashLabel, formatRecording, lensById, lensChangesPicture, nextFlash, placeSticker, stickerText, zoomMultiplierLabel } from '../src/cameraEffects';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('lens catalogue: unique ids, Normal first, all colours are hex', () => {
  check(new Set(CAMERA_LENSES.map((lens) => lens.id)).size === CAMERA_LENSES.length, 'lens ids must be unique');
  check(CAMERA_LENSES[0].id === 'none' && CAMERA_LENSES[0].layers.length === 0, 'Normal must be the first, untouched lens');
  check(CAMERA_LENSES.every((lens) => /^#[0-9A-Fa-f]{6}$/.test(lens.swatch) && lens.layers.every((layer) => /^#[0-9A-Fa-f]{6}$/.test(layer.color) && layer.opacity > 0 && layer.opacity <= 0.5)), 'lens colours and opacities');
  check(CAMERA_LENSES.every((lens) => lens.vignette === undefined || (lens.vignette > 0 && lens.vignette <= 1)), 'vignette range');
});
run('lensById falls back to Normal', () => {
  check(lensById('neon').id === 'neon' && lensById('nope').id === 'none' && lensById(null).id === 'none', 'lookup');
});
run('only real lenses change the picture', () => {
  check(!lensChangesPicture(lensById('none')), 'Normal keeps the original photo');
  check(CAMERA_LENSES.slice(1).every(lensChangesPicture), 'every other lens re-renders the photo');
});
run('sticker catalogue: unique ids, one clock, labels present', () => {
  check(new Set(STICKERS.map((s) => s.id)).size === STICKERS.length, 'sticker ids must be unique');
  check(STICKERS.filter((s) => s.kind === 'time').length === 1, 'one clock sticker');
  check(STICKERS.filter((s) => s.kind === 'label').every((s) => s.label.trim().length > 0), 'label stickers need text');
});
run('clock sticker uses local time, zero padded', () => {
  check(clockLabel(new Date(2026, 8, 21, 7, 5)) === '07:05', 'padding');
  check(stickerText(STICKERS[0], new Date(2026, 8, 21, 14, 32)) === '14:32', 'time sticker text');
  check(stickerText(STICKERS[1], new Date()) === 'Kalabalık', 'label sticker text');
});
run('recording timer', () => {
  check(formatRecording(0) === '00:00' && formatRecording(7.9) === '00:07' && formatRecording(45) === '00:45' && formatRecording(-3) === '00:00', 'mm:ss');
  check(formatRecording(125) === '02:05', 'minutes');
});
run('flash cycles off -> on -> auto -> off with readable labels', () => {
  check(nextFlash('off') === 'on' && nextFlash('on') === 'auto' && nextFlash('auto') === 'off', 'cycle');
  check(flashLabel('off') === 'Flaş kapalı' && flashLabel('on') === 'Flaş açık' && flashLabel('auto') === 'Flaş otomatik', 'labels');
});
run('zoom is clamped to 0..1 and NaN-safe', () => {
  check(clampZoom(-1) === 0 && clampZoom(2) === 1 && clampZoom(0.3) === 0.3 && clampZoom(Number.NaN) === 0, 'clamp');
});
run('zoom multiplier label is a friendly "1.0x".."5.0x" readout', () => {
  check(zoomMultiplierLabel(0) === '1.0x' && zoomMultiplierLabel(1) === '5.0x', 'range ends');
  check(zoomMultiplierLabel(0.5) === '3.0x', 'midpoint');
  check(zoomMultiplierLabel(-3) === '1.0x' && zoomMultiplierLabel(9) === '5.0x', 'out-of-range zoom is clamped first');
});
run('stickers stay inside the frame', () => {
  check(clampToFrame(-50, 300) === 24 && clampToFrame(999, 300) === 276 && clampToFrame(150, 300) === 150, 'clampToFrame');
});
run('placing stickers fans out and caps at the maximum', () => {
  const frame = { width: 390, height: 700 };
  let list = placeSticker([], 'crowded', frame, 1);
  check(list.length === 1 && list[0].scale === 1, 'first sticker');
  list = placeSticker(list, 'queue', frame, 2);
  check(list[1].x !== list[0].x && list[1].y !== list[0].y, 'stickers must not stack exactly');
  check(new Set(list.map((s) => s.key)).size === 2, 'keys unique');
  for (let i = 0; i < 10; i += 1) list = placeSticker(list, 'open', frame, 10 + i);
  check(list.length === MAX_STICKERS, 'sticker cap');
  check(placeSticker(list, 'open', frame, 99) === list, 'over the cap returns the same list');
});
