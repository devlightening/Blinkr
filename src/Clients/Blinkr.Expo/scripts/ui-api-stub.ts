import { chatMessages, chatUsers, conversations, nearby } from './ui-fixtures';
import type { ChatMessage } from '../src/types';

const flag = (name: string) => typeof location !== 'undefined' && location.search.includes(name);

const catalogue = [
  { id: 'kent', name: 'Kent Meydanı', category: 'PUBLIC', latitude: 37.075, longitude: 36.248, distanceMeters: 220, displayAddress: 'Osmaniye Merkez', currentState: { activeSignalCount: 2, freshness: 'FRESH', signalType: 'Crowd', signalValue: 'Busy' } },
  { id: 'kent-ecz', name: 'Kent Eczanesi', category: 'PHARMACY', latitude: 37.076, longitude: 36.25, distanceMeters: 640, displayAddress: 'Raufbey Mh.', currentState: { activeSignalCount: 0, freshness: 'NONE' } },
  { id: 'sifa-ecz', name: 'Şifa Eczanesi', category: 'PHARMACY', latitude: 37.07, longitude: 36.24, distanceMeters: 4200, displayAddress: 'Yıldırım Beyazıt Mh.', currentState: { activeSignalCount: 0, freshness: 'NONE' } },
  { id: 'masal', name: 'Masal Parkı', category: 'PARK', latitude: 37.08, longitude: 36.26, distanceMeters: 1900, displayAddress: 'Alparslan Türkeş Bulvarı', currentState: { activeSignalCount: 1, freshness: 'RECENT', signalType: 'Crowd', signalValue: 'Calm' } },
  { id: 'sehirkent', name: 'Şehirkent Market', category: 'SUPERMARKET', latitude: 37.06, longitude: 36.23, distanceMeters: 900, displayAddress: null, currentState: { activeSignalCount: 0, freshness: 'NONE' } },
];
// ?searchfail = the search request fails; ?emptysearch = nothing is found.
export const searchPlaces = async (q: string) => {
  if (flag('searchfail')) throw new Error('Network request failed');
  if (flag('emptysearch')) return [];
  const folded = q.toLocaleLowerCase('tr');
  const category = ({ eczane: 'PHARMACY', park: 'PARK', market: 'SUPERMARKET' } as Record<string, string>)[folded];
  if (category) return catalogue.filter(p => p.category === category);
  const composerMatches = nearby.filter(p => p.name.toLocaleLowerCase('tr').includes(folded));
  const mapMatches = catalogue.filter(p => p.name.toLocaleLowerCase('tr').includes(folded) || (p.displayAddress ?? '').toLocaleLowerCase('tr').includes(folded));
  return [...composerMatches, ...mapMatches];
};
export const uploadMedia = async () => {
  if (flag('slowmedia')) return new Promise<never>(() => {}); // stays in "uploading" for visual review
  throw new Error('Media is covered by the Gateway smoke, not the browser harness.');
};
export const toAbsoluteUrl = (url?: string | null) => url ?? null;
export const authenticate = async () => { throw new Error('Auth not stubbed for login tests.'); };

// Chat: behaviour switches come from the page URL (?empty, ?failing) so one bundle covers every state.
const opened = new Set<string>();
export const listConversations = async () => {
  if (flag('failing')) throw new Error('Network request failed');
  if (flag('empty')) return [];
  // Opening snap-1 in the viewer turns its row into "Açıldı", exactly what the server would report.
  return conversations.map((item) => (item.lastMessageId && opened.has(item.lastMessageId) ? { ...item, lastMessageState: 'opened' as const, unreadCount: 0 } : item));
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

// Avatars: ?avatarfail = the server refuses (network error).
export const setMyAvatar = async (_auth: unknown, avatarKey: string | null) => {
  if (flag('avatarfail')) throw new Error('Network request failed');
  return { avatarKey };
};

// Snaps: ?snapgone = the snap was already opened / expired; ?slowsnap = never loads; ?sendsnapfail = sending fails.
const SNAP_IMAGE = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="#3b5a4c"/><circle cx="450" cy="500" r="220" fill="#e9c46a"/></svg>');
export const openSnap = async (_auth: unknown, _conversationId: string, messageId: string) => {
  if (flag('snapgone')) throw new Error('Bu Snap zaten açıldı.');
  opened.add(messageId);
  return { contentUrl: SNAP_IMAGE, mediaType: 'Image' as const, durationSeconds: flag('untimed') ? 0 : 3, caption: 'Burası çok kalabalık', viewUntilUtc: new Date(Date.now() + 60_000).toISOString() };
};
export const snapMediaSource = (_auth: unknown, contentUrl: string) => ({ uri: flag('slowsnap') ? 'data:image/svg+xml;base64,' : contentUrl, headers: {} as Record<string, string> });
export const sentSnaps: Array<{ conversationId: string; caption?: string; durationSeconds: number }> = [];
export const sendSnap = async (_auth: unknown, conversationId: string, _media: unknown, options: { durationSeconds: number; caption?: string }) => {
  if (flag('sendsnapfail')) throw new Error('Network request failed');
  sentSnaps.push({ conversationId, ...options });
  (window as unknown as { __sentSnaps?: unknown }).__sentSnaps = sentSnaps;
  return { id: 'sent-' + sentSnaps.length, conversationId, senderId: 'qa', text: '', createdAtUtc: new Date().toISOString(), isRead: true, kind: 'snap', snap: { mediaType: 'Image', durationSeconds: options.durationSeconds, state: 'sent', expiresAtUtc: new Date(Date.now() + 86_400_000).toISOString() } };
};
