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
  { id: 'u-zeynep', userName: 'zeynep' },
  { id: 'u-arda', userName: 'arda' },
  { id: 'u-melis', userName: 'melis' },
];
export const conversations: Conversation[] = [
  { id: 'c1', otherUserId: 'u-zeynep', lastMessageAtUtc: minutesAgo(2), lastMessagePreview: 'Şu an burası baya canlı', lastMessageSenderId: 'u-zeynep', unreadCount: 3 },
  { id: 'c2', otherUserId: 'u-arda', lastMessageAtUtc: minutesAgo(17), lastMessagePreview: 'Buraya geldin mi?', lastMessageSenderId: 'qa', unreadCount: 0 },
  { id: 'c3', otherUserId: 'u-melis', lastMessageAtUtc: minutesAgo(42), lastMessagePreview: 'Kahve içmeye gelen var mı?', lastMessageSenderId: 'u-melis', unreadCount: 0 },
];
// Newest first, exactly as the server returns them.
export const chatMessages: ChatMessage[] = [
  { id: 'm4', conversationId: 'c1', senderId: 'qa', text: 'Tamam, geliyorum.', createdAtUtc: minutesAgo(1), isRead: true },
  { id: 'm3', conversationId: 'c1', senderId: 'u-zeynep', text: 'Şu an burası baya canlı, gel istersen.', createdAtUtc: minutesAgo(2), isRead: false },
  { id: 'm2', conversationId: 'c1', senderId: 'qa', text: 'Merhaba! Orada yer var mı?', createdAtUtc: minutesAgo(5), isRead: true },
  { id: 'm1', conversationId: 'c1', senderId: 'u-zeynep', text: 'Selam', createdAtUtc: minutesAgo(9), isRead: true },
];
