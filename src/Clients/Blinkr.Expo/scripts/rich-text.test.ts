import { activeMention, foldTag, insertMention, mentionCount, parseRichText } from '../src/richText';
import { HEART, chooseReaction, reactionStateOf, tapHeart, toggleCommentLike, topReactions, totalReactions } from '../src/reactions';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };
const ali = { userId: 'u1', userName: 'ali_k' };

run('tags fold like the server (Turkish letters, case, diacritics)', () => {
  check(foldTag('#AkşamKahvesi') === 'aksamkahvesi', foldTag('#AkşamKahvesi'));
  check(foldTag('İÇLİ_Köfte2') === 'icli_kofte2', foldTag('İÇLİ_Köfte2'));
});
run('resolved mentions become links; unknown names, e-mails and glued @ stay text', () => {
  const s = parseRichText('Selam @ali_k. mail a@ali_k.com @nobody', [ali]);
  const kinds = s.map((x) => x.kind).join(',');
  check(kinds === 'text,mention,text', kinds);
  const mention = s[1];
  check(mention.kind === 'mention' && mention.text === '@ali_k' && mention.userId === 'u1', 'mention');
  check(s[2].kind === 'text' && s[2].text.startsWith('. mail a@ali_k.com'), 'trailing dot + email kept');
  check(parseRichText('@ALI_K', [ali])[0].kind === 'mention', 'case-insensitive');
});
run('hashtags need 2+ characters and a word boundary', () => {
  const s = parseRichText('#a #ok iyi#yok #Çay_1!');
  const tags = s.filter((x) => x.kind === 'hashtag').map((x) => (x.kind === 'hashtag' ? x.tag : ''));
  check(tags.join() === 'ok,cay_1', tags.join());
  check(s.map((x) => x.text).join('') === '#a #ok iyi#yok #Çay_1!', 'text round-trips');
});
run('the @word being typed and inserting a chosen name', () => {
  check(activeMention('merhaba @al')?.query === 'al', 'query');
  check(activeMention('a@al') === null && activeMention('merhaba') === null, 'no mention');
  check(activeMention('@')?.query === '', 'bare @');
  const r = insertMention('selam @al bak', 9, 'ali_k');
  check(r.text === 'selam @ali_k bak' && r.cursor === 13, JSON.stringify(r));
});
run('mention count (limit 10 on the server)', () => {
  check(mentionCount('@abc @abc @def a@ghi') === 2, String(mentionCount('@abc @abc @def a@ghi')));
});
run('reactions: set, replace, take back', () => {
  let s = { mine: null as string | null, counts: {} as Record<string, number> };
  s = chooseReaction(s, '🔥');
  check(s.mine === '🔥' && s.counts['🔥'] === 1, 'set');
  s = chooseReaction(s, '😂');
  check(s.mine === '😂' && s.counts['😂'] === 1 && !('🔥' in s.counts), 'replace');
  s = chooseReaction(s, '😂');
  check(s.mine === null && totalReactions(s.counts) === 0, 'same again = off');
  s = tapHeart(s);
  check(s.mine === HEART && s.counts[HEART] === 1, 'heart tap');
  s = tapHeart(chooseReaction(s, '👏'));
  check(s.mine === null && totalReactions(s.counts) === 0, 'heart tap on a reaction takes it back');
});
run('summary and older servers', () => {
  check(topReactions({ '😂': 1, '🔥': 3, [HEART]: 3 }).join('') === `${HEART}🔥😂`, 'order');
  const legacy = reactionStateOf({ likeCount: 2, isLikedByCurrentUser: true });
  check(legacy.mine === HEART && legacy.counts[HEART] === 2, 'legacy');
  check(reactionStateOf({ reactionCounts: { '🔥': 1 }, myReaction: '🔥' }).mine === '🔥', 'new');
});
run('comment like toggle', () => {
  const a = toggleCommentLike({ likeCount: 2, likedByMe: false });
  check(a.likedByMe && a.likeCount === 3, 'like');
  const b = toggleCommentLike(a);
  check(!b.likedByMe && b.likeCount === 2, 'unlike');
});
