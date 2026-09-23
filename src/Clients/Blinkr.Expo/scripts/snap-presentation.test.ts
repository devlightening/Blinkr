import {
  DEFAULT_TIMER, MAX_COMPOSER_SNAP_FRIENDS, shareToFriendsAvailability, toggleSnapFriend, MAX_CAPTION_LENGTH, TIMER_OPTIONS, cleanCaption, conversationLabel, conversationStatus, nextTimer, sendButtonLabel, snapRow, summarizeSend, timerFraction, timerLabel, toggleRecipient,
} from '../src/snapPresentation';
import type { ChatMessage, Conversation } from '../src/types';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

const ME = 'me';
const THEM = 'them';
const conversation = (over: Partial<Conversation>): Conversation => ({ id: 'c1', otherUserId: THEM, lastMessageAtUtc: new Date().toISOString(), unreadCount: 0, ...over });
const message = (over: Partial<ChatMessage>): ChatMessage => ({ id: 'm1', conversationId: 'c1', senderId: THEM, text: '', createdAtUtc: new Date().toISOString(), isRead: false, ...over });

run('list status: a waiting snap from them is a filled red square that opens the viewer', () => {
  const status = conversationStatus(conversation({ lastMessageKind: 'snap', lastMessageState: 'sent', lastMessageSenderId: THEM, unreadCount: 1 }), ME);
  check(status.kind === 'new-snap' && status.label === 'Yeni Snap' && status.tone === 'snap' && status.icon === 'square' && status.filled && status.opensSnap, 'new snap');
});
run('list status: opened and expired snaps are quiet outlines and do not reopen', () => {
  const opened = conversationStatus(conversation({ lastMessageKind: 'snap', lastMessageState: 'opened', lastMessageSenderId: THEM }), ME);
  check(opened.kind === 'snap-received-opened' && opened.label === 'Açıldı' && !opened.filled && !opened.opensSnap && opened.tone === 'quiet', 'received opened');
  const expired = conversationStatus(conversation({ lastMessageKind: 'snap', lastMessageState: 'expired', lastMessageSenderId: THEM }), ME);
  check(expired.kind === 'snap-expired' && expired.label === 'Süresi doldu' && !expired.opensSnap, 'expired');
});
run('list status: my own snaps show an arrow and never open a viewer', () => {
  const sent = conversationStatus(conversation({ lastMessageKind: 'snap', lastMessageState: 'sent', lastMessageSenderId: ME }), ME);
  check(sent.kind === 'snap-sent' && sent.label === 'Gönderildi' && sent.icon === 'arrow' && !sent.filled && !sent.opensSnap, 'sent');
  const seen = conversationStatus(conversation({ lastMessageKind: 'snap', lastMessageState: 'opened', lastMessageSenderId: ME }), ME);
  check(seen.kind === 'snap-opened' && seen.label === 'Açıldı' && seen.icon === 'arrow' && seen.tone === 'quiet', 'opened by them');
  check(conversationStatus(conversation({ lastMessageKind: 'snap', lastMessageState: 'expired', lastMessageSenderId: ME }), ME).icon === 'arrow', 'expired keeps the arrow of a sent snap');
});
run('list status: text shows "Yeni sohbet" while unread, then the preview', () => {
  const unread = conversationStatus(conversation({ lastMessageKind: 'text', lastMessagePreview: 'Selam', lastMessageSenderId: THEM, unreadCount: 2 }), ME);
  check(unread.kind === 'new-chat' && unread.label === 'Yeni sohbet' && unread.tone === 'chat' && unread.filled && !unread.opensSnap, 'unread chat');
  const read = conversationStatus(conversation({ lastMessageKind: 'text', lastMessagePreview: 'Selam', lastMessageSenderId: THEM, unreadCount: 0 }), ME);
  check(read.kind === 'chat' && read.label === 'Selam' && !read.filled, 'read chat shows preview');
  const mine = conversationStatus(conversation({ lastMessageKind: 'text', lastMessagePreview: 'Tamam', lastMessageSenderId: ME }), ME);
  check(mine.kind === 'chat-sent' && mine.label === 'Tamam', 'own text');
  check(conversationStatus(conversation({}), ME).kind === 'empty', 'no messages yet');
});
run('legacy conversations without kind or state behave like text', () => {
  const status = conversationStatus(conversation({ lastMessagePreview: 'Eski mesaj', lastMessageSenderId: THEM, unreadCount: 0 }), ME);
  check(status.kind === 'chat' && status.label === 'Eski mesaj', 'legacy');
  check(conversationStatus(conversation({ lastMessageKind: 'snap', lastMessageSenderId: THEM, unreadCount: 1 }), ME).kind === 'new-snap', 'missing state means waiting');
});
run('row accessibility label says what a tap will do', () => {
  const snap = conversationStatus(conversation({ lastMessageKind: 'snap', lastMessageState: 'sent', lastMessageSenderId: THEM, unreadCount: 1 }), ME);
  check(conversationLabel('zeynep', snap, '2 dk önce') === 'zeynep, Yeni Snap, 2 dk önce. Snapı aç', 'snap label');
  const chat = conversationStatus(conversation({ lastMessageKind: 'text', lastMessagePreview: 'Selam', lastMessageSenderId: THEM }), ME);
  check(conversationLabel('arda', chat, '') === 'arda, Selam. Sohbeti aç', 'chat label without time');
});
run('message rows: text is not a snap; the recipient taps a waiting snap; nothing else is tappable', () => {
  check(snapRow(message({ kind: 'text', text: 'Selam' }), ME) === null, 'text');
  const snap = (over: Partial<ChatMessage> & { state: 'sent' | 'opened' | 'expired'; video?: boolean }) => message({ kind: 'snap', snap: { mediaType: over.video ? 'Video' : 'Image', durationSeconds: 5, state: over.state, expiresAtUtc: new Date().toISOString() }, ...over });
  const waiting = snapRow(snap({ state: 'sent', senderId: THEM }), ME)!;
  check(waiting.title === 'Snap' && waiting.status === 'Görmek için dokun' && waiting.tappable && waiting.filled && waiting.icon === 'square', 'waiting');
  check(snapRow(snap({ state: 'sent', senderId: THEM, video: true }), ME)!.title === 'Video', 'video title');
  check(!snapRow(snap({ state: 'opened', senderId: THEM }), ME)!.tappable, 'opened is not tappable');
  check(!snapRow(snap({ state: 'expired', senderId: THEM }), ME)!.tappable && snapRow(snap({ state: 'expired', senderId: THEM }), ME)!.status === 'Süresi doldu', 'expired');
  const mineSent = snapRow(snap({ state: 'sent', senderId: ME }), ME)!;
  check(mineSent.status === 'Gönderildi' && !mineSent.tappable && mineSent.icon === 'arrow', 'my waiting snap');
  check(snapRow(snap({ state: 'opened', senderId: ME }), ME)!.status === 'Açıldı', 'my opened snap');
});
run('timer: cycles 3 -> 5 -> 10 -> 3, starts at 5, labels are readable', () => {
  check(DEFAULT_TIMER === 5 && TIMER_OPTIONS.join() === '3,5,10', 'options');
  check(nextTimer(3) === 5 && nextTimer(5) === 10 && nextTimer(10) === 3, 'cycle');
  check(nextTimer(7) === TIMER_OPTIONS[0], 'unknown value restarts the cycle');
  check(timerLabel(5) === '5 sn' && timerLabel(0) === 'Sonuna kadar', 'labels');
});
run('timer fraction drains from 1 to 0 and is clamped', () => {
  check(timerFraction(5000, 5) === 1 && timerFraction(2500, 5) === 0.5 && timerFraction(0, 5) === 0, 'drain');
  check(timerFraction(9000, 5) === 1 && timerFraction(-100, 5) === 0, 'clamp');
  check(timerFraction(1234, 0) === 1, 'no timer stays full');
});
run('captions are one tidy line of at most 80 characters', () => {
  check(cleanCaption('  Merhaba \n  dünya  ') === 'Merhaba dünya', 'whitespace');
  check(cleanCaption('a'.repeat(200)).length === MAX_CAPTION_LENGTH && MAX_CAPTION_LENGTH === 80, 'cap');
});
run('recipients: toggle keeps order, respects the limit', () => {
  let selected: string[] = [];
  selected = toggleRecipient(selected, 'a'); selected = toggleRecipient(selected, 'b'); selected = toggleRecipient(selected, 'c');
  check(selected.join() === 'a,b,c', 'order');
  selected = toggleRecipient(selected, 'b');
  check(selected.join() === 'a,c', 'untoggle');
  let full: string[] = [];
  for (let i = 0; i < 15; i += 1) full = toggleRecipient(full, `r${i}`);
  check(full.length === 10 && !full.includes('r14'), 'limit of 10');
  check(toggleRecipient(full, 'r0').length === 9, 'a selected recipient can still be removed at the limit');
});
run('send button label follows the selection', () => {
  check(sendButtonLabel(0) === 'Kişi seç' && sendButtonLabel(1, 'Zeynep') === 'Gönder · Zeynep' && sendButtonLabel(3, 'Zeynep') === 'Gönder · 3 kişi' && sendButtonLabel(1) === 'Gönder · 1 kişi', 'labels');
});
run('send summary lists what still needs a retry', () => {
  const partial = summarizeSend([{ conversationId: 'a', ok: true }, { conversationId: 'b', ok: false }, { conversationId: 'c', ok: true }]);
  check(partial.sent === 2 && partial.failed.join() === 'b' && !partial.allSent, 'partial');
  check(summarizeSend([{ conversationId: 'a', ok: true }]).allSent, 'all sent');
  check(!summarizeSend([]).allSent, 'nothing sent is not success');
});
{ // P5.9: snaps from the composer
  check(shareToFriendsAvailability({ anonymous: false, hasPhoto: true }) === 'ok', 'ok');
  check(shareToFriendsAvailability({ anonymous: true, hasPhoto: true }) === 'anonymous', 'anonymous never');
  check(shareToFriendsAvailability({ anonymous: false, hasPhoto: false }) === 'no-photo', 'needs a photo');
  let picked: string[] = [];
  picked = toggleSnapFriend(picked, 'a'); picked = toggleSnapFriend(picked, 'b'); picked = toggleSnapFriend(picked, 'a');
  check(picked.join() === 'b', 'toggle');
  for (let i = 0; i < 20; i += 1) picked = toggleSnapFriend(picked, `u${i}`);
  check(picked.length === MAX_COMPOSER_SNAP_FRIENDS, 'capped');
  console.log('PASS composer snaps: photo only, never anonymous, capped');
}
