import type { BlinkrPlace, ComposerArea } from '../src/types';
// UI-only scenarios. Real catalog acceptance is exercised through the Gateway script.
export const nearby: BlinkrPlace[] = [
  { id: 'mosque', name: 'Hz. Ali Camii', category: 'MOSQUE', distanceMeters: 352, latitude: 39.9, longitude: 32.8 },
  { id: 'park', name: 'Şehit Mahmut Kavak Parkı', category: 'PARK', distanceMeters: 365, latitude: 39.9, longitude: 32.8 },
  { id: 'cafe', name: 'Mahalle Kahvesi', category: 'CAFE', distanceMeters: 420, latitude: 39.9, longitude: 32.8 },
  { id: 'branch-a', name: 'BİM', category: 'SUPERMARKET', distanceMeters: 500, latitude: 39.9, longitude: 32.8 },
  { id: 'branch-b', name: 'BİM', category: 'SUPERMARKET', distanceMeters: 1300, latitude: 39.9, longitude: 32.8 },
];
export const area: ComposerArea = { name: 'Etimesgut civarı', region: { latitude: 39.9, longitude: 32.8, latitudeDelta: .01, longitudeDelta: .01 }, source: 'device', accuracyMeters: 22 };

// --- Chat (UI-only; real conversations are covered by scripts/test-chat-smoke.ps1) ---
import type { ChatMessage, Conversation, UserSummary } from '../src/types';
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
export const chatUsers: UserSummary[] = [
  { id: 'u-zeynep', userName: 'zeynep', avatarKey: '134' },
  { id: 'u-arda', userName: 'arda' },
  { id: 'u-melis', userName: 'melis' },
  { id: 'u-ece', userName: 'ece' },
  { id: 'u-can', userName: 'can' },
  { id: 'u-mert', userName: 'mert' },
];
export const conversations: Conversation[] = [
  // A snap from zeynep is waiting (filled red square), arda got my text, melis opened my snap, ece has an unread chat.
  { id: 'c1', otherUserId: 'u-zeynep', lastMessageAtUtc: minutesAgo(2), lastMessagePreview: 'Snap', lastMessageSenderId: 'u-zeynep', unreadCount: 1, lastMessageKind: 'snap', lastMessageState: 'sent', lastMessageId: 'snap-1' },
  { id: 'c2', otherUserId: 'u-arda', lastMessageAtUtc: minutesAgo(17), lastMessagePreview: 'Buraya geldin mi?', lastMessageSenderId: 'qa', unreadCount: 0, lastMessageKind: 'text' },
  { id: 'c3', otherUserId: 'u-melis', lastMessageAtUtc: minutesAgo(42), lastMessagePreview: 'Snap', lastMessageSenderId: 'qa', unreadCount: 0, lastMessageKind: 'snap', lastMessageState: 'opened', lastMessageId: 'snap-3' },
  { id: 'c4', otherUserId: 'u-ece', lastMessageAtUtc: minutesAgo(55), lastMessagePreview: 'Akşam görüşelim mi?', lastMessageSenderId: 'u-ece', unreadCount: 2, lastMessageKind: 'text' },
  { id: 'c5', otherUserId: 'u-can', lastMessageAtUtc: minutesAgo(180), lastMessagePreview: 'Snap', lastMessageSenderId: 'u-can', unreadCount: 0, lastMessageKind: 'snap', lastMessageState: 'expired', lastMessageId: 'snap-5' },
];
// Newest first, exactly as the server returns them.
export const chatMessages: ChatMessage[] = [
  { id: 'snap-1', conversationId: 'c1', senderId: 'u-zeynep', text: '', createdAtUtc: minutesAgo(1), isRead: false, kind: 'snap', snap: { mediaType: 'Image', durationSeconds: 3, caption: 'Burası çok kalabalık', state: 'sent', expiresAtUtc: minutesAgo(-1400) } },
  { id: 'snap-mine', conversationId: 'c1', senderId: 'qa', text: '', createdAtUtc: minutesAgo(1.5), isRead: true, kind: 'snap', snap: { mediaType: 'Video', durationSeconds: 0, state: 'opened', expiresAtUtc: minutesAgo(-1400), openedAtUtc: minutesAgo(1) } },
  { id: 'm4', conversationId: 'c1', senderId: 'qa', text: 'Tamam, geliyorum.', createdAtUtc: minutesAgo(1), isRead: true },
  { id: 'm3', conversationId: 'c1', senderId: 'u-zeynep', text: 'Şu an burası baya canlı, gel istersen.', createdAtUtc: minutesAgo(2), isRead: false },
  { id: 'm2', conversationId: 'c1', senderId: 'qa', text: 'Merhaba! Orada yer var mı?', createdAtUtc: minutesAgo(5), isRead: true },
  { id: 'm1', conversationId: 'c1', senderId: 'u-zeynep', text: 'Selam', createdAtUtc: minutesAgo(9), isRead: true },
];

// Sinyal Kartı photos (plan-devam Faz C): a landscape and a 4:5 portrait, to check nothing is cropped.
const cardPhoto = (w: number, h: number, fill: string) => 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${fill}"/><circle cx="${w / 2}" cy="${h * 0.4}" r="${Math.min(w, h) * 0.22}" fill="#f4c95d"/><rect x="${w * 0.3}" y="${h * 0.62}" width="${w * 0.4}" height="${h * 0.3}" rx="30" fill="#f49ac2"/></svg>`);
export const CARD_LANDSCAPE = cardPhoto(1600, 900, '#3e9a7a');
export const CARD_PORTRAIT = cardPhoto(1080, 1350, '#6d4ac9');
