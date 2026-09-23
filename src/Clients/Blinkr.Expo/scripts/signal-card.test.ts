import { cardText, fromCoordinateSignal, fromRecentSignal, mediaFrame, stepIndex, TALLEST, timeLeft, verifyState, withDetail, WIDEST, zoomOf } from '../src/signalCard';
import type { BlinkrPlace } from '../src/types';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

const place: BlinkrPlace = { id: 'p1', name: 'BİM', category: 'SUPERMARKET', latitude: 37, longitude: 36 };

run('media is never cropped: own ratio between 9:16 and 4:5, contained outside it', () => {
  check(mediaFrame(1080, 1350).aspectRatio === 0.8 && mediaFrame(1080, 1350).fit === 'cover', '4:5 exact');
  check(mediaFrame(1080, 1920).fit === 'cover' && Math.abs(mediaFrame(1080, 1920).aspectRatio - TALLEST) < 1e-9, '9:16 exact');
  check(mediaFrame(3, 4).fit === 'cover' && mediaFrame(3, 4).aspectRatio === 0.75, '3:4 keeps its ratio');
  check(mediaFrame(1920, 1080).fit === 'contain' && mediaFrame(1920, 1080).aspectRatio === WIDEST, 'landscape is contained in 4:5');
  check(mediaFrame(500, 2000).fit === 'contain' && mediaFrame(500, 2000).aspectRatio === TALLEST, 'very tall is contained in 9:16');
  check(mediaFrame(null, null).fit === 'contain', 'unknown size is contained, never cropped');
});

run('one text: title and description merged without repeating', () => {
  check(cardText('Kapalı bim', 'Bim kapalı gelmeyin', 'TemporaryStatus') === 'Kapalı bim. Bim kapalı gelmeyin', 'different title kept');
  check(cardText('Geçici durum', 'Kapı kilitli', 'TemporaryStatus') === 'Kapı kilitli', 'title that is the type label dropped');
  check(cardText('Sıra var', 'Sıra var, 10 dk', 'Queue') === 'Sıra var, 10 dk', 'title inside the description dropped');
  check(cardText('Kalabalık', '', 'Crowd') === 'Kalabalık', 'title alone');
});

run('time left and pager steps', () => {
  const now = Date.parse('2026-09-23T12:00:00Z');
  const left = timeLeft('2026-09-23T13:28:00Z', now)!;
  check(left.hours === 1 && left.minutes === 28, 'hours and minutes');
  check(timeLeft('2026-09-23T11:00:00Z', now) === null && timeLeft(null, now) === null, 'expired or unknown');
  check(stepIndex(0, -1, 3) === 0 && stepIndex(2, 1, 3) === 2 && stepIndex(1, 1, 3) === 2, 'pager stays in range');
  check(zoomOf(0.005) > 16 && zoomOf(0.05) < 16, 'zoom from longitude span');
});

run('"Hâlâ böyle mi?": place signals only, not your own, within 500 m, with a known position', () => {
  const card = fromRecentSignal({ postId: 'a', signalType: 'Queue', signalValue: 'LONG', publicationTrust: 'VERIFIED_LIVE', authorName: 'ayse' }, place);
  check(verifyState(card, 120).enabled, 'near');
  check(verifyState(card, 900).reason === 'far', 'far');
  check(verifyState(card, null).reason === 'noLocation', 'no position');
  check(verifyState({ ...card, isMine: true }, 10).reason === 'mine', 'own signal');
  check(verifyState(fromCoordinateSignal({ postId: 'b', title: '', textPreview: 'x', latitude: 1, longitude: 1, signalType: 'Crowd' }), 10).reason === 'notPlace', 'coordinate signal');
});

run('detail completes the card; anonymous never reveals the author', () => {
  const card = fromRecentSignal({ postId: 'a', signalType: 'Crowd', authorName: 'ayse' }, place);
  check(card.verified === false && card.placeName === 'BİM' && !card.complete, 'preliminary');
  const done = withDetail(card, { id: 'a', authorId: 'u1', authorName: 'ayse', publicationTrust: 'VERIFIED_LIVE', likeCount: 3, commentCount: 2, isLikedByCurrentUser: true, isMine: false, media: [{ url: '/m/1', type: 1, width: 1080, height: 1920 }] });
  check(done.complete && done.verified && done.authorId === 'u1' && done.likeCount === 3 && done.liked, 'filled');
  check(done.media[0].type === 'Video' && done.media[0].height === 1920, 'media with size');
  const anon = withDetail(card, { id: 'a', authorId: '00000000-0000-0000-0000-000000000000', authorName: 'Topluluk üyesi', identityDisclosure: 'AnonymousMap' });
  check(anon.anonymous && anon.authorId === null && anon.authorName === null, 'anonymous hidden');
});
