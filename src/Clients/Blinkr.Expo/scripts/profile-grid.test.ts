import { GRID_COLUMNS, GRID_GAP, gridTile, gridTileSize } from '../src/profileGrid';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

run('three tiles fit the width exactly (never overflow)', () => {
  const size = gridTileSize(390, 16);
  check(GRID_COLUMNS === 3 && size * 3 + GRID_GAP * 2 <= 390 - 32, 'fits');
  check(gridTileSize(10, 16) === 1, 'never zero');
});
run('tile state: photo, expired, anonymous', () => {
  const now = Date.parse('2026-09-23T12:00:00Z');
  const tile = gridTile({ mediaUrls: ['a.jpg', 'b.jpg'], expiresAt: '2026-09-23T11:00:00Z', identityDisclosure: 'AnonymousMap' }, now);
  check(tile.photoUrl === 'a.jpg' && tile.extraPhotos === 1 && tile.expired && tile.anonymous, 'full');
  const plain = gridTile({ mediaUrls: [], expiresAt: '2026-09-23T13:00:00Z', identityDisclosure: 'LimitedProfile' }, now);
  check(plain.photoUrl === null && !plain.expired && !plain.anonymous && plain.extraPhotos === 0, 'text tile');
  check(!gridTile({ mediaUrls: [], expiresAt: null, identityDisclosure: 'LimitedProfile' }, now).expired, 'no expiry');
  const video = gridTile({ mediaUrls: ['v.mp4'], media: [{ url: 'v.mp4', thumbnailUrl: 't.jpg', type: 'Video' }], expiresAt: null, identityDisclosure: 'LimitedProfile' }, now);
  check(video.video && video.photoUrl === 't.jpg', 'video shows its thumbnail');
  const bare = gridTile({ mediaUrls: ['v.mp4'], media: [{ url: 'v.mp4', thumbnailUrl: null, type: 'Video' }], expiresAt: null, identityDisclosure: 'LimitedProfile' }, now);
  check(bare.video && bare.photoUrl === null, 'a video without a thumbnail is never drawn as a picture');
  const photos = gridTile({ mediaUrls: ['a', 'b'], media: [{ url: 'a', type: 'Image' }, { url: 'b', type: 'Video', thumbnailUrl: 'bt' }], expiresAt: null, identityDisclosure: 'LimitedProfile' }, now);
  check(!photos.video && photos.photoUrl === 'a' && photos.extraPhotos === 1, 'photo first');
});
