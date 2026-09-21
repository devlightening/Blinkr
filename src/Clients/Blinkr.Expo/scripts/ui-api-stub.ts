import { chatMessages, chatUsers, conversations, nearby } from './ui-fixtures';
import type { ChatMessage } from '../src/types';

const flag = (name: string) => typeof location !== 'undefined' && location.search.includes(name);

export const searchPlaces = async (q: string) => nearby.filter(p => p.name.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')));
export const uploadMedia = async () => {
  if (flag('slowmedia')) return new Promise<never>(() => {}); // stays in "uploading" for visual review
  throw new Error('Media is covered by the Gateway smoke, not the browser harness.');
};
export const toAbsoluteUrl = (url?: string | null) => url ?? null;
export const authenticate = async () => { throw new Error('Auth not stubbed for login tests.'); };

// Chat: behaviour switches come from the page URL (?empty, ?failing) so one bundle covers every state.
export const listConversations = async () => {
  if (flag('failing')) throw new Error('Network request failed');
  return flag('empty') ? [] : conversations;
};
export const getUser = async (_auth: unknown, id: string) => {
  const user = chatUsers.find(u => u.id === id);
  if (!user) throw new Error('not found');
  return user;
};
export const startConversation = async (_auth: unknown, targetUserId: string) => ({ id: `new-${targetUserId}`, otherUserId: targetUserId, lastMessageAtUtc: new Date().toISOString(), unreadCount: 0 });
export const searchUsers = async (_auth: unknown, query: string) => chatUsers.filter(u => u.userName.includes(query.toLowerCase()));
let sent: ChatMessage[] = [];
export const getMessages = async () => ({ items: flag('emptychat') ? [] : [...sent, ...chatMessages] });
export const sendMessage = async (_auth: unknown, conversationId: string, text: string): Promise<ChatMessage> => {
  if (flag('sendfail')) throw new Error('Network request failed');
  const message = { id: `sent-${sent.length}`, conversationId, senderId: 'qa', text, createdAtUtc: new Date().toISOString(), isRead: false };
  sent = [message, ...sent];
  return message;
};
export const markConversationRead = async () => {};

// Own posts: 20,030 generated rows served in pages, newest first (?fewposts = 3 rows, ?noposts = none, ?postsfail = server error).
const TOTAL_POSTS = 20030;
const kinds = ['Crowd', 'Queue', 'GeneralObservation', 'Event', 'Offer', 'TemporaryStatus'] as const;
export const getMyPosts = async (_auth: unknown, page: number, pageSize: number) => {
  if (flag('postsfail')) throw new Error('Network request failed');
  const total = flag('noposts') ? 0 : flag('fewposts') ? 3 : TOTAL_POSTS;
  const start = (page - 1) * pageSize;
  const items = Array.from({ length: Math.max(0, Math.min(pageSize, total - start)) }, (_, i) => {
    const n = total - (start + i);
    return {
      id: `post-${n}`, title: `Sinyal başlığı ${n}`, content: `Osmaniye Merkez: sıradan bir gözlem. (#${String(n).padStart(5, '0')})`,
      createdAtUtc: new Date(Date.now() - n * 60_000).toISOString(), expiresAt: new Date(Date.now() + (n % 7 === 0 ? 30 : -30) * 60_000).toISOString(),
      signalType: kinds[n % kinds.length], signalValue: null, locationName: 'Osmaniye Merkez', identityDisclosure: n % 10 === 0 ? 'AnonymousMap' : 'LimitedProfile', mediaUrls: n % 5 === 0 ? ['/m.png'] : [],
    };
  });
  return { items, total };
};

// Yakında: a small live neighbourhood around 37.0742, 36.2478 (?nearbyempty = nothing fresh, ?nearbyfail = server error).
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const ahead = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const north = (meters: number) => 37.0742 + meters / 111_320;
const activePlace = (id: string, name: string, category: string, meters: number, signalType: string, signalValue: string, minutes: number, freshness: string, count: number) => ({
  id, name, category, latitude: north(meters), longitude: 36.2478,
  currentState: { signalType, signalValue, freshness, observedAtUtc: ago(minutes), expiresAtUtc: ahead(90), confidence: 'HIGH', confidenceValue: 0.8, activeSignalCount: count },
});
export const getUnifiedMapBounds = async () => {
  if (flag('nearbyfail')) throw new Error('Network request failed');
  if (flag('nearbyempty')) return { places: [], signals: [] };
  return {
    places: [
      activePlace('p1', 'Kent Meydanı', 'PUBLIC', 220, 'Crowd', 'Busy', 4, 'FRESH', 3),
      activePlace('p2', 'Masal Parkı', 'PARK', 640, 'Crowd', 'Calm', 12, 'FRESH', 1),
      activePlace('p3', 'Merkez Eczanesi', 'PHARMACY', 410, 'Queue', 'Over15', 35, 'RECENT', 2),
      activePlace('p4', 'Yıldırım Beyazıt Kafe', 'CAFE', 90, 'Queue', 'None', 70, 'RECENT', 1),
      activePlace('far', 'Çok uzak yer', 'SHOP', 4000, 'Crowd', 'Busy', 2, 'FRESH', 1),
      { id: 'catalog', name: 'Sessiz Market', category: 'SUPERMARKET', latitude: north(150), longitude: 36.2478, currentState: null },
    ],
    signals: [
      { postId: 's1', title: 'Yol çalışması', textPreview: 'İki şeritten biri kapalı', latitude: north(330), longitude: 36.2478, signalType: 'GeneralObservation', createdAtUtc: ago(8), expiresAt: ahead(120) },
      { postId: 's-old', title: 'Eski gözlem', textPreview: '', latitude: north(100), longitude: 36.2478, signalType: 'GeneralObservation', createdAtUtc: ago(400), expiresAt: ahead(10) },
    ],
  };
};
