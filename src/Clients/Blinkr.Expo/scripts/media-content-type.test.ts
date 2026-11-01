import { resolveUploadContentType, safeUploadFileName } from '../src/mediaContentType';

const equal = (actual: unknown, expected: unknown) => { if (actual !== expected) throw new Error('expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual)); };
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('picker type wins when the server accepts it', () => {
  equal(resolveUploadContentType('Image', 'image/png', 'image/jpeg', 'a.jpg'), 'image/png');
});
run('image/jpg is spelled image/jpeg', () => {
  equal(resolveUploadContentType('Image', 'image/jpg', null, 'a.jpg'), 'image/jpeg');
});
run('missing picker type falls back to the blob type', () => {
  equal(resolveUploadContentType('Image', undefined, 'image/webp', 'x'), 'image/webp');
});
run('missing types fall back to the file extension, ignoring query strings', () => {
  equal(resolveUploadContentType('Image', null, '', 'file:///cache/IMG_1.PNG?x=1'), 'image/png');
  equal(resolveUploadContentType('Video', null, 'application/octet-stream', 'file:///cache/clip.mov'), 'video/quicktime');
});
run('unsupported or empty types default per media kind', () => {
  equal(resolveUploadContentType('Image', 'image/heic', '', 'a.heic'), 'image/jpeg');
  equal(resolveUploadContentType('Video', undefined, undefined, undefined), 'video/mp4');
});
run('a video is never declared as an image type', () => {
  equal(resolveUploadContentType('Video', 'image/jpeg', 'image/jpeg', 'clip.mp4'), 'video/mp4');
});
run('charset parameters are ignored', () => {
  equal(resolveUploadContentType('Image', 'image/jpeg; charset=binary', null, null), 'image/jpeg');
});
run('file names lose path and reserved characters but stay readable', () => {
  equal(safeUploadFileName('a/b\\c:d.jpg', 'Image', 'image/jpeg'), 'a_b_c_d.jpg');
  equal(safeUploadFileName('', 'Image', 'image/png'), 'blinkr-photo.png');
  equal(safeUploadFileName(null, 'Video', 'video/quicktime'), 'blinkr-video.mov');
});
