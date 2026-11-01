import { CAMERA_LENSES, HOLD_TO_RECORD_MS, TEXT_MAX, cleanOverlayText, nextTextStyle, placeText, textOnColor, stickersOverlap, isOverTrash, signalFromStickers, stickerName, LENS_SWIPE_MIN_PX, lensAfterSwipe, MAX_STICKERS, MAX_VIDEO_SECONDS, recordingProgress, STICKERS, clampToFrame, clampZoom, clockLabel, flashLabel, formatRecording, lensById, lensChangesPicture, nextFlash, placeSticker, stickerText, zoomMultiplierLabel } from '../src/cameraEffects';

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
  check(!stickersOverlap(list[0], list[1]), 'stickers must not stack');
  check(new Set(list.map((s) => s.key)).size === 2, 'keys unique');
  for (let i = 0; i < 10; i += 1) list = placeSticker(list, 'open', frame, 10 + i);
  check(list.length === MAX_STICKERS, 'sticker cap');
  check(placeSticker(list, 'open', frame, 99) === list, 'over the cap returns the same list');
});
run('hold-to-record: 15 s cap and a ring that fills from 0 to 1', () => {
  check(MAX_VIDEO_SECONDS === 15, 'plan: max 15 s');
  check(recordingProgress(0) === 0 && recordingProgress(7.5) === 0.5 && recordingProgress(15) === 1, 'linear');
  check(recordingProgress(99) === 1 && recordingProgress(-1) === 0 && recordingProgress(Number.NaN) === 0, 'clamped');
  check(HOLD_TO_RECORD_MS >= 200 && HOLD_TO_RECORD_MS <= 500, 'a hold is distinct from a tap');
});
run('swiping steps through the lenses and wraps around; small drags do nothing', () => {
  check(lensAfterSwipe('none', -80) === 'sunset' && lensAfterSwipe('sunset', 80) === 'none', 'next / previous');
  check(lensAfterSwipe('night', -80) === 'none' && lensAfterSwipe('none', 80) === 'night', 'wraps');
  check(lensAfterSwipe('mint', LENS_SWIPE_MIN_PX - 1) === 'mint' && lensAfterSwipe('mint', Number.NaN) === 'mint', 'no change');
  check(lensAfterSwipe('unknown', -80) === 'sunset', 'unknown starts from Normal');
});
run('new stickers never land on top of each other (AUDIT #8)', () => {
  const frame = { width: 360, height: 480 };
  let placed: ReturnType<typeof placeSticker> = [];
  for (let i = 0; i < MAX_STICKERS; i += 1) placed = placeSticker(placed, 'calm', frame, i);
  check(placed.length === MAX_STICKERS, 'all placed');
  for (const a of placed) for (const b of placed) if (a !== b) check(!stickersOverlap(a, b), `overlap ${a.key}/${b.key}`);
  check(placed.every((s) => s.x >= 0 && s.x <= frame.width && s.y >= 0 && s.y <= frame.height), 'inside the picture');
  check(placeSticker(placed, 'calm', frame).length === MAX_STICKERS, 'limit');
});
run('the bin sits at the bottom centre', () => {
  const frame = { width: 360, height: 480 };
  check(isOverTrash({ x: 180, y: 450 }, frame) && isOverTrash({ x: 230, y: 420 }, frame), 'inside');
  check(!isOverTrash({ x: 180, y: 200 }, frame) && !isOverTrash({ x: 20, y: 470 }, frame), 'outside');
});
run('a type sticker suggests the signal type; the first one wins; decoration is ignored', () => {
  check(signalFromStickers([{ stickerId: 'time' }, { stickerId: 'crowded' }, { stickerId: 'closed' }])?.type === 'Crowd', 'first type sticker');
  check(signalFromStickers([{ stickerId: 'closed' }])?.value === 'Closed', 'value');
  check(signalFromStickers([{ stickerId: 'e-fire' }, { stickerId: 'weather' }]) === null, 'none');
});
run('emoji stickers have no text but still a name', () => {
  const fire = STICKERS.find((s) => s.id === 'e-fire')!;
  check(fire.kind === 'emoji' && stickerText(fire, new Date()) === '' && stickerName(fire, new Date()) === '🔥', 'name');
});
run('text tool: cleaned, capped, placed like a sticker, three styles, readable colours', () => {
  const frame = { width: 360, height: 480 };
  check(cleanOverlayText('  Sıra   \n uzun  ') === 'Sıra uzun' && cleanOverlayText('x'.repeat(200)).length === TEXT_MAX, 'clean');
  check(placeText([], '   ', 'plain', '#FFFFFF', frame).length === 0, 'empty writes nothing');
  const one = placeText([], 'Kapı açık', 'solid', '#FFC845', frame, 1);
  check(one.length === 1 && one[0].text === 'Kapı açık' && one[0].textStyle === 'solid' && one[0].stickerId === 'text', 'placed');
  check(nextTextStyle('plain') === 'solid' && nextTextStyle('solid') === 'highlight' && nextTextStyle('highlight') === 'plain', 'styles cycle');
  check(textOnColor('#FFFFFF') === '#111111' && textOnColor('#111111') === '#FFFFFF' && textOnColor('#FFC845') === '#111111', 'contrast');
});
