import {
  CATEGORY_SHORTCUTS, MAX_RECENT_SEARCHES, addRecentSearch, distanceTier, editDistance, foldSearchText, fuzzyMatches, isCategoryQuery, typoBudget, highlightSegments, isLiveResult, isSearchableQuery, rankPlaces, recentToPlace, scorePlace, toRecentSearch, type RecentSearch,
} from '../src/placeSearch';
import type { BlinkrPlace } from '../src/types';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };
const place = (id: string, name: string, distanceMeters: number, over: Partial<BlinkrPlace> = {}): BlinkrPlace => ({ id, name, latitude: 37, longitude: 36, distanceMeters, category: 'CAFE', ...over });

run('folding is Turkish-insensitive and length-preserving', () => {
  check(foldSearchText('ECZANESİ') === foldSearchText('eczanesi') && foldSearchText('Işık') === foldSearchText('isik'), 'İ/I/ı/i fold together');
  check(foldSearchText('Şehit Müzesi Çarşı Öğretmen Ğ') === 'sehit muzesi carsi ogretmen g', 'diacritics fold');
  for (const sample of ['İstanbul', 'ÇIĞLIK', 'ığdır', 'Şişli']) check(foldSearchText(sample).length === sample.length, `length kept: ${sample}`);
});
run('scoring: exact > prefix > word prefix > contains > address/category', () => {
  const p = (name: string, extra: Partial<BlinkrPlace> = {}) => ({ name, category: 'SHOP', displayAddress: null, ...extra });
  check(scorePlace('kent', p('Kent')) === 100, 'exact');
  check(scorePlace('kent', p('Kent Meydanı')) === 85, 'prefix');
  check(scorePlace('meydan', p('Kent Meydanı')) === 70, 'word prefix');
  check(scorePlace('ydan', p('Kent Meydanı')) === 50, 'contains');
  check(scorePlace('bulvar', p('Sessiz Market', { displayAddress: 'Alparslan Türkeş Bulvarı' })) === 20, 'address');
  check(scorePlace('eczane', p('Şifa', { category: 'PHARMACY' })) === 20, 'category word answered by the server');
  check(scorePlace('zzz', p('Şifa', { category: 'PHARMACY' })) === 10, 'an accidental server match is noise');
  check(scorePlace('soul mate', p('Soulmate Coffee')) === 55 && scorePlace('soulmate', p('Soul Mate Cafe')) === 55, 'joined and split spellings meet');
  check(scorePlace('soulmte', p('Soulmate Coffee & Bakery')) === 40, 'a one-letter typo is still a good match');
  check(scorePlace('   ', p('Kent')) === 0, 'blank query');
  check(scorePlace('ECZANESİ', p('Kent Eczanesi')) === 70, 'Turkish capitals still match a word prefix');
});
run('ranking: near tier first (best name, then nearest), then the city, then far away; junk dropped', () => {
  const ranked = rankPlaces('kent', [
    place('far-exact', 'Kent', 9000),
    place('near-contains', 'Şehirkent Market', 100),
    place('near-prefix', 'Kent Eczanesi', 400),
    place('near-prefix-2', 'Kent Meydanı', 200),
    place('far-exact', 'Kent', 9000),
    place('other-city', 'Kent', 400_000),
    { ...place('', 'no id', 1) },
  ]);
  check(ranked.map((item) => item.place.id).join() === 'near-prefix-2,near-prefix,near-contains,far-exact,other-city', `order: ${ranked.map((item) => item.place.id).join()}`);
});
run('a distant exact match never outranks a close partial one', () => {
  const ranked = rankPlaces('soulmate', [place('exact-far', 'Soulmate', 300_000), place('partial-near', 'Soulmate Coffee & Bakery', 900)]);
  check(ranked[0].place.id === 'partial-near', 'the cafe 900 m away comes first');
});
run('distances are measured from the person, not taken from the server', () => {
  const near = { ...place('a', 'Kafe A', 999_999), latitude: 37.0311, longitude: 35.3157 };
  const ranked = rankPlaces('kafe', [near], { origin: { latitude: 37.0306, longitude: 35.3157 } });
  check(ranked[0].distanceMeters < 100 && distanceTier(ranked[0].distanceMeters) === 0, 'measured from the origin');
});
run('typos: edit distance, budgets and fuzzy matching', () => {
  check(editDistance('soulmte', 'soulmate') === 1 && editDistance('soulmtae', 'soulmate') === 1 && editDistance('kitten', 'sitting') === 3, 'distance and transposition');
  check(typoBudget(3) === 0 && typoBudget(5) === 1 && typoBudget(8) === 2, 'budget grows with length');
  check(fuzzyMatches('soulmte', 'Soulmate Coffee') && fuzzyMatches('sulmate', 'Soulmate') && fuzzyMatches('kentt', 'Kent Meydanı'), 'typos still match');
  check(!fuzzyMatches('kafe', 'Kale') && !fuzzyMatches('abc', 'Xyz') && !fuzzyMatches('', 'Kent'), 'short words and strangers do not');
  check(fuzzyMatches('soulmt cof', 'Soulmate Coffee'), 'every typed word may carry a typo');
});
run('when a real match exists, accidental server matches are dropped; category queries keep theirs', () => {
  const noisy = rankPlaces('soulmate', [place('good', 'Soulmate', 100), place('noise', 'Sultan Kebap', 50, { category: 'RESTAURANT' })]);
  check(noisy.map((item) => item.place.id).join() === 'good', 'noise dropped');
  const category = rankPlaces('eczane', [place('a', 'Şifa', 100, { category: 'PHARMACY' }), place('b', 'Kent Eczanesi', 200, { category: 'PHARMACY' })]);
  check(category.length === 2 && isCategoryQuery('Eczane') && !isCategoryQuery('soulmate'), 'a pharmacy without "eczane" in its name still shows for "eczane"');
});
run('ranking is deterministic, caps the list and tolerates missing distances', () => {
  const many = Array.from({ length: 60 }, (_, index) => place(`p${index}`, `Kafe ${index}`, index));
  check(rankPlaces('kafe', many).length === 30 && rankPlaces('kafe', many, { limit: 5 }).length === 5, 'limit');
  const a = rankPlaces('kafe', many).map((item) => item.place.id).join();
  const b = rankPlaces('kafe', [...many].reverse()).map((item) => item.place.id).join();
  check(a === b, 'input order must not change the ranking');
  const withMissing = rankPlaces('kafe', [place('x', 'Kafe A', Number.NaN), place('y', 'Kafe B', 50)]);
  check(withMissing[0].place.id === 'y' && withMissing[1].place.id === 'x', 'unknown distance sorts last');
});
run('highlight splits around the first match, ignoring Turkish case', () => {
  check(JSON.stringify(highlightSegments('Kent Eczanesi', 'ECZANESİ')) === JSON.stringify([{ text: 'Kent ', match: false }, { text: 'Eczanesi', match: true }]), 'suffix match');
  check(JSON.stringify(highlightSegments('Kent Meydanı', 'kent')) === JSON.stringify([{ text: 'Kent', match: true }, { text: ' Meydanı', match: false }]), 'prefix match');
  check(JSON.stringify(highlightSegments('Masal Parkı', 'zzz')) === JSON.stringify([{ text: 'Masal Parkı', match: false }]), 'no match');
  check(JSON.stringify(highlightSegments('Şifa', '')) === JSON.stringify([{ text: 'Şifa', match: false }]), 'empty query');
  check(highlightSegments('Işık Market', 'isik')[0].text === 'Işık', 'match text keeps the original spelling');
});
run('category shortcuts are unique, short words the server understands', () => {
  check(new Set(CATEGORY_SHORTCUTS.map((item) => item.id)).size === CATEGORY_SHORTCUTS.length, 'ids');
  check(CATEGORY_SHORTCUTS.every((item) => isSearchableQuery(item.query) && item.label.length <= 10), 'searchable and chip sized');
  const server = ['cami', 'park', 'eczane', 'kafe', 'restoran', 'market', 'okul', 'hastane', 'akaryakıt', 'fırın'];
  check(CATEGORY_SHORTCUTS.every((item) => server.includes(item.query)), 'every shortcut is a word the server maps to a category');
});
run('a query is searchable from 2 to 80 characters', () => {
  check(!isSearchableQuery('') && !isSearchableQuery(' a ') && isSearchableQuery('ka') && isSearchableQuery('a'.repeat(80)) && !isSearchableQuery('a'.repeat(81)), 'bounds');
});
run('recent searches: newest first, deduplicated, capped, junk refused', () => {
  const entry = (id: string): RecentSearch => ({ id, name: `Yer ${id}`, category: 'CAFE', latitude: 37, longitude: 36 });
  let list: RecentSearch[] = [];
  for (const id of ['a', 'b', 'c']) list = addRecentSearch(list, entry(id));
  check(list.map((item) => item.id).join() === 'c,b,a', 'newest first');
  list = addRecentSearch(list, entry('a'));
  check(list.map((item) => item.id).join() === 'a,c,b', 'a repeat moves to the front without duplicating');
  for (let i = 0; i < 20; i += 1) list = addRecentSearch(list, entry(`n${i}`));
  check(list.length === MAX_RECENT_SEARCHES && list[0].id === 'n19', 'capped');
  const before = list;
  check(addRecentSearch(list, { ...entry('bad'), latitude: Number.NaN }) === before && addRecentSearch(list, { ...entry(''), id: '' }) === before, 'invalid entries are ignored');
});
run('recent <-> place round trip keeps what the map needs', () => {
  const original = place('p1', 'Kent Meydanı', 10, { latitude: 37.07, longitude: 36.25, category: 'PUBLIC' });
  const back = recentToPlace(toRecentSearch(original));
  check(back.id === 'p1' && back.name === 'Kent Meydanı' && back.latitude === 37.07 && back.longitude === 36.25 && back.category === 'PUBLIC', 'round trip');
});
run('live badge only for verified, recent activity', () => {
  const state = (freshness: string, count: number) => ({ currentState: { freshness, activeSignalCount: count } });
  check(isLiveResult(place('a', 'A', 1, state('FRESH', 2))) && isLiveResult(place('b', 'B', 1, state('RECENT', 1))), 'fresh and recent');
  check(!isLiveResult(place('c', 'C', 1, state('STALE', 3))) && !isLiveResult(place('d', 'D', 1, state('FRESH', 0))) && !isLiveResult(place('e', 'E', 1)), 'stale, empty, none');
});
