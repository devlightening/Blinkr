import { chatMessages, chatUsers, conversations, nearby } from './ui-fixtures';
import type { ChatMessage, Relation } from '../src/types';

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
  if (flag('farsearch')) return [
    { id: 'soul-ist', name: 'Soulmate Coffee', category: 'CAFE', latitude: 41.0082, longitude: 28.9784, distanceMeters: 800_000, displayAddress: null },
    { id: 'soul-near', name: 'Soulmate Cafe', category: 'CAFE', latitude: 37.0760, longitude: 36.2480, distanceMeters: 900, displayAddress: null },
  ];
  const folded = q.toLocaleLowerCase('tr');
  const category = ({ eczane: 'PHARMACY', park: 'PARK', market: 'SUPERMARKET' } as Record<string, string>)[folded];
  if (category) return catalogue.filter(p => p.category === category);
  const composerMatches = nearby.filter(p => p.name.toLocaleLowerCase('tr').includes(folded));
  const mapMatches = catalogue.filter(p => p.name.toLocaleLowerCase('tr').includes(folded) || (p.displayAddress ?? '').toLocaleLowerCase('tr').includes(folded));
  return [...composerMatches, ...mapMatches];
};
export const uploadMedia = async () => {
  if (flag('slowmedia')) return new Promise<never>(() => {}); // stays in "uploading" for visual review
  if (flag('mediaok')) return { mediaId: 'media-1', mediaType: 'Image' as const }; // ?mediaok = the upload succeeds
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
// Friends: an in-memory friendship book that behaves like the server (?nofriends = nobody, ?friendsfail, ?actionfail, ?profilefail, ?nobio, ?nosignals).
const book: Record<string, Relation> = flag('nofriends') ? {} : { 'u-zeynep': 'friends', 'u-ece': 'friends', 'u-melis': 'incoming', 'u-can': 'outgoing' };
let myBio: string | null = flag('nobio') ? null : 'Kahve ve yürüyüş.';
const relationOf = (id: string): Relation => book[id] ?? 'none';
const userOf = (id: string) => chatUsers.find((u) => u.id === id);
const inState = (state: Relation) => chatUsers.filter((u) => relationOf(u.id) === state);
export const searchUsers = async (_auth: unknown, query: string) =>
  chatUsers.filter(u => u.userName.includes(query.toLowerCase()) && relationOf(u.id) !== 'blocked').map((u) => ({ ...u, relation: relationOf(u.id) }));
// Follows (Faz 6): u-melis is a private account; u-can follows me; I follow u-zeynep. ?followfail = follow requests fail.
const follows: Record<string, 'none' | 'requested' | 'following'> = { 'u-zeynep': 'following' };
const privateIds = new Set(['u-melis']);
const followsMe = new Set(['u-can', 'u-arda']);
let myPrivate = false;
let myFollowRequests = flag('nofollowrequests') ? [] : [{ id: 'u-ece', userName: 'ece', avatarKey: null, createdAtUtc: '2026-09-22T10:00:00Z' }];
const followerCountOf = (id: string) => (id === 'u-zeynep' ? 41 : id === 'u-melis' ? 7 : 3) + (follows[id] === 'following' ? 1 : 0);
export const getMyProfile = async () => ({ bio: myBio, friendCount: inState('friends').length, incomingRequestCount: inState('incoming').length, followerCount: followsMe.size, followingCount: Object.values(follows).filter((f) => f === 'following').length, followRequestCount: myFollowRequests.length, isPrivate: myPrivate });
export const followUser = async (_auth: unknown, id: string) => {
  if (flag('followfail')) throw new Error('Network request failed');
  follows[id] = privateIds.has(id) ? 'requested' : 'following';
  return { userId: id, follow: follows[id] };
};
export const unfollowUser = async (_auth: unknown, id: string) => { follows[id] = 'none'; return { userId: id, follow: 'none' as const }; };
const followUserRow = (id: string) => { const u = userOf(id)!; return { id, userName: u.userName, avatarKey: u.avatarKey ?? null, follow: (follows[id] ?? 'none'), followsYou: followsMe.has(id) }; };
export const listFollowers = async (_auth: unknown, owner: string) => {
  const ids = owner === 'qa' || owner === 'scene' ? [...followsMe] : ['u-arda', 'u-ece'];
  return { items: ids.map(followUserRow), page: 1, pageSize: 30, totalCount: ids.length, hasMore: false };
};
export const listFollowing = async (_auth: unknown, owner: string) => {
  const ids = owner === 'qa' || owner === 'scene' ? Object.keys(follows).filter((id) => follows[id] === 'following') : ['u-zeynep'];
  return { items: ids.map(followUserRow), page: 1, pageSize: 30, totalCount: ids.length, hasMore: false };
};
export const listFollowRequests = async () => myFollowRequests;
export const acceptFollowRequest = async (_auth: unknown, id: string) => { myFollowRequests = myFollowRequests.filter((r) => r.id !== id); followsMe.add(id); return { userId: id }; };
export const declineFollowRequest = async (_auth: unknown, id: string) => { myFollowRequests = myFollowRequests.filter((r) => r.id !== id); return { userId: id }; };
export const removeFollower = async (_auth: unknown, id: string) => { followsMe.delete(id); return { userId: id }; };
export const setAccountPrivacy = async (_auth: unknown, isPrivate: boolean) => { myPrivate = isPrivate; return { isPrivate }; };
export const setMyBio = async (_auth: unknown, bio: string | null) => {
  if (flag('biofail')) throw new Error('Network request failed');
  myBio = bio;
  return { bio };
};
export const getPublicProfile = async (_auth: unknown, id: string) => {
  if (flag('profilefail')) throw new Error('Network request failed');
  const user = userOf(id);
  if (!user) throw new Error('not found');
  const isPrivate = privateIds.has(id);
  return { ...user, bio: id === 'u-zeynep' ? 'Sabah kahvesi, akşam yürüyüşü.' : null, joinedAtUtc: '2026-03-10T09:00:00Z', relation: relationOf(id), followerCount: followerCountOf(id), followingCount: 12, follow: follows[id] ?? 'none', followsYou: followsMe.has(id), isPrivate, canSeeContent: !isPrivate || follows[id] === 'following' };
};
export const getUserPosts = async (_auth: unknown, _id: string) => {
  if (flag('nosignals')) return { items: [], total: 0 };
  const items = ['Kahve Durağı', 'Kent Meydanı', 'Masal Parkı'].map((place, n) => ({
    id: `up-${n}`, title: `${place}'nda gözlem`, content: 'Sakin.', createdAtUtc: new Date(Date.now() - (n + 1) * 3_600_000).toISOString(), expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    signalType: kinds[n % kinds.length], signalValue: null, locationName: place, identityDisclosure: 'LimitedProfile', mediaUrls: [],
  }));
  return { items, total: 12 };
};
export const listFriends = async () => {
  if (flag('friendsfail')) throw new Error('Network request failed');
  return inState('friends').map((u) => ({ id: u.id, userName: u.userName, avatarKey: u.avatarKey, sinceUtc: '2026-04-01T10:00:00Z' }));
};
export const listFriendRequests = async () => {
  if (flag('friendsfail')) throw new Error('Network request failed');
  const row = (u: { id: string; userName: string; avatarKey?: string | null }) => ({ id: u.id, userName: u.userName, avatarKey: u.avatarKey, createdAtUtc: '2026-09-20T10:00:00Z' });
  return { incoming: inState('incoming').map(row), outgoing: inState('outgoing').map(row) };
};
const move = (from: Relation, to: Relation) => async (_auth: unknown, id: string) => {
  if (flag('actionfail')) throw new Error('Network request failed');
  if (relationOf(id) !== from) throw new Error('REQUEST_NOT_FOUND');
  book[id] = to;
  return { userId: id, relation: to };
};
export const sendFriendRequest = move('none', 'outgoing');
export const acceptFriendRequest = move('incoming', 'friends');
export const declineFriendRequest = move('incoming', 'none');
export const cancelFriendRequest = move('outgoing', 'none');
export const removeFriend = move('friends', 'none');

// Safety: blocks and reports (?noblocks = nobody blocked, ?blockfail / ?reportfail = the server refuses).
const blockedAt = new Map<string, string>(flag('noblocks') ? [] : [['u-mert', '2026-09-19T10:00:00Z']]);
if (!flag('noblocks')) book['u-mert'] = 'blocked';
export const listBlocks = async () => {
  if (flag('blockfail')) throw new Error('Network request failed');
  return [...blockedAt.entries()].map(([id, blockedAtUtc]) => ({ id, userName: userOf(id)?.userName ?? id, avatarKey: userOf(id)?.avatarKey, blockedAtUtc }));
};
export const blockUser = async (_auth: unknown, id: string) => {
  if (flag('blockfail')) throw new Error('Network request failed');
  book[id] = 'blocked';
  blockedAt.set(id, new Date().toISOString());
  return { userId: id, relation: 'blocked' as Relation };
};
export const unblockUser = async (_auth: unknown, id: string) => {
  if (flag('blockfail')) throw new Error('Network request failed');
  book[id] = 'none';
  blockedAt.delete(id);
  return { userId: id, relation: 'none' as Relation };
};
export const sendReport = async (_auth: unknown, report: { targetType: string; targetId: string; reason: string; note?: string }) => {
  if (flag('reportfail')) throw new Error('Network request failed');
  (globalThis as unknown as { __lastReport?: unknown }).__lastReport = report;
  return { reported: true };
};

// Saved places, live: p1 is busy right now, p3 has a recent queue, p2 has only a stale state (?nolive = nothing, ?livefail = error).
export const getPlacesByIds = async (ids: string[]) => {
  if (flag('livefail')) throw new Error('Network request failed');
  if (flag('nolive')) return [];
  const states: Record<string, { signalType: string; signalValue: string; freshness: string; activeSignalCount: number; observedAtUtc: string } | undefined> = {
    p1: { signalType: 'Crowd', signalValue: 'Busy', freshness: 'FRESH', activeSignalCount: 2, observedAtUtc: new Date(Date.now() - 5 * 60_000).toISOString() },
    p2: { signalType: 'Crowd', signalValue: 'Calm', freshness: 'STALE', activeSignalCount: 1, observedAtUtc: new Date(Date.now() - 300 * 60_000).toISOString() },
    p3: { signalType: 'Queue', signalValue: 'Over15', freshness: 'RECENT', activeSignalCount: 1, observedAtUtc: new Date(Date.now() - 35 * 60_000).toISOString() },
  };
  return ids.map((id) => ({ id, name: id, category: 'CAFE', latitude: 37, longitude: 36, currentState: states[id] ?? null }));
};
let sent: ChatMessage[] = [];
export const getMessages = async () => ({ items: flag('emptychat') ? [] : [...sent, ...chatMessages] });
export const sendMessage = async (_auth: unknown, conversationId: string, text: string, _r?: unknown, _e?: unknown, extras: { clientId?: string; signal?: ChatMessage['signal'] } = {}): Promise<ChatMessage> => {
  if (flag('sendfail')) throw new Error('Network request failed');
  const message: ChatMessage = { id: `sent-${sent.length}`, conversationId, senderId: 'qa', text, createdAtUtc: new Date().toISOString(), isRead: false, kind: extras.signal ? 'signal' : 'text', signal: extras.signal ?? null, clientId: extras.clientId ?? null, reactions: [] };
  sent = [message, ...sent];
  if (typeof window !== 'undefined') (window as unknown as { __lastShare?: unknown }).__lastShare = extras.signal ?? null;
  return message;
};
const allMessages = () => [...sent, ...chatMessages];
export const reactToMessage = async (_auth: unknown, _c: string, messageId: string, emoji: string | null) => {
  const message = allMessages().find((m) => m.id === messageId)!;
  message.reactions = [...(message.reactions ?? []).filter((r) => r.userId !== 'qa'), ...(emoji ? [{ userId: 'qa', emoji }] : [])];
  return { ...message };
};
export const unsendMessage = async (_auth: unknown, _c: string, messageId: string) => {
  const message = allMessages().find((m) => m.id === messageId)!;
  message.kind = 'unsent'; message.text = ''; message.signal = null; message.reactions = [];
  return { ...message };
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

// Keşfet feeds (?nofollowing = empty following feed, ?feedfail = both fail).
const feedNow = Date.now();
const feedItem = (id: string, extra: Record<string, unknown> = {}) => ({
  id, title: '', content: 'Kuyruk kapıya kadar.', signalType: 'Queue', signalValue: 'Over15', authorId: 'u-zeynep', authorName: 'zeynep', anonymous: false,
  createdAtUtc: new Date(feedNow - 6 * 60_000).toISOString(), expiresAtUtc: new Date(feedNow + 50 * 60_000).toISOString(), expired: false,
  likeCount: 4, commentCount: 1, isLikedByCurrentUser: false, placeId: 'kent', locationName: 'Kent Eczanesi', distanceMeters: 350, media: [], ...extra,
});
export const getDiscoverNearby = async (_auth: unknown, _lat: number, _lon: number, page = 1) => {
  if (flag('feedfail')) throw new Error('Network request failed');
  const items = page > 1 ? [feedItem('n-4', { title: 'Dördüncü', authorName: 'ece', authorId: 'u-ece' })] : [
    feedItem('n-1'),
    feedItem('n-2', { signalType: 'Crowd', signalValue: 'Calm', content: 'Park sakin.', authorId: null, authorName: 'Topluluk üyesi', anonymous: true, placeId: null, locationName: 'Masal Parkı', distanceMeters: 1200 }),
    feedItem('n-3', { signalType: 'Offer', signalValue: 'Available', content: 'Simit iki al bir öde.', authorId: 'qa', authorName: 'alper', distanceMeters: 50 }),
  ];
  return { items, page, pageSize: 20, hasMore: page === 1 };
};
export const getDiscoverFollowing = async (_auth: unknown, page = 1) => {
  if (flag('feedfail')) throw new Error('Network request failed');
  const items = flag('nofollowing') ? [] : [feedItem('f-1', { content: 'Takip ettiğimden.', distanceMeters: null })];
  return { items, page, pageSize: 20, hasMore: false };
};

// Stories: zeynep has two unseen, ece one seen, I have none until I post one.
const storyPixel = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640"><rect width="360" height="640" fill="#2b5a4a"/></svg>');
let myStories: Array<Record<string, unknown>> = [];
const storyFor = (id: string, authorId: string, authorName: string, seen: boolean) => ({ id, authorId, authorName, mediaType: 'Image', caption: id === 'z-1' ? 'Kuyruk kısa' : null, durationSeconds: 3, createdAtUtc: new Date(feedNow - 30 * 60_000).toISOString(), expiresAtUtc: new Date(feedNow + 20 * 3_600_000).toISOString(), seen, viewerCount: null });
const seenStories = new Set<string>();
export const listStoryTray = async () => [
  ...(myStories.length ? [{ authorId: 'qa', authorName: 'alper', isMine: true, storyCount: myStories.length, latestAtUtc: new Date().toISOString(), allSeen: true }] : []),
  { authorId: 'u-zeynep', authorName: 'zeynep', isMine: false, storyCount: 2, latestAtUtc: new Date(feedNow - 30 * 60_000).toISOString(), allSeen: seenStories.has('z-1') && seenStories.has('z-2') },
  { authorId: 'u-ece', authorName: 'ece', isMine: false, storyCount: 1, latestAtUtc: new Date(feedNow - 90 * 60_000).toISOString(), allSeen: true },
];
export const listUserStories = async (_auth: unknown, userId: string) =>
  userId === 'qa' ? myStories : userId === 'u-zeynep' ? [storyFor('z-1', 'u-zeynep', 'zeynep', seenStories.has('z-1')), storyFor('z-2', 'u-zeynep', 'zeynep', seenStories.has('z-2'))] : [storyFor('e-1', 'u-ece', 'ece', true)];
export const markStorySeen = async (_auth: unknown, id: string) => { seenStories.add(id); };
export const listStoryViewers = async () => [{ userId: 'u-ece', userName: 'ece', seenAtUtc: new Date().toISOString() }];
export const deleteStory = async (_auth: unknown, id: string) => { myStories = myStories.filter((s) => s.id !== id); };
export const storyMediaSource = (_auth: unknown, _id: string) => ({ uri: storyPixel, headers: {} as Record<string, string> });
export const postStory = async () => {
  const story = { ...storyFor(`m-${myStories.length + 1}`, 'qa', 'alper', true), viewerCount: 1 };
  myStories = [...myStories, story];
  return story;
};
export const sentStoryReplies: string[] = [];

// Saved places on the account: the harness has no session, so savedPlaces.ts stays device-local (localStorage).
export const listServerSavedPlaces = async () => [];
export const putSavedPlace = async (_auth: unknown, place: { id: string }) => ({ placeId: place.id, saved: true });
export const deleteSavedPlace = async (_auth: unknown, placeId: string) => ({ placeId, saved: false });
export const importSavedPlaces = async () => [];

// --- Likes and comments (engagement.ts). ?likefail = the like request fails.
export class ApiCodeError extends Error {
  constructor(public code: string, public status: number) { super(code); this.name = 'ApiCodeError'; }
}
type StubComment = { commentId: string; authorId: string | null; authorName: string; isPostAuthor: boolean; isMine: boolean; canDelete: boolean; parentCommentId: string | null; text: string; createdAtUtc: string; replies: StubComment[] };
const stubNow = new Date().toISOString();
let stubLiked = false;
let stubLikes = 3;
let stubComments: StubComment[] = [
  { commentId: 'c1', authorId: 'u-can', authorName: 'can', isPostAuthor: false, isMine: false, canDelete: false, parentCommentId: null, text: 'Sıra ne kadar?', createdAtUtc: stubNow, replies: [
    { commentId: 'c1r1', authorId: null, authorName: 'Paylaşan', isPostAuthor: true, isMine: false, canDelete: false, parentCommentId: 'c1', text: '5 dakika kadar', createdAtUtc: stubNow, replies: [] },
    { commentId: 'c1r2', authorId: 'u-ece', authorName: 'ece', isPostAuthor: false, isMine: false, canDelete: false, parentCommentId: 'c1', text: 'Teşekkürler', createdAtUtc: stubNow, replies: [] },
  ] },
];
const stubCount = () => stubComments.reduce((n, c) => n + 1 + c.replies.length, 0);
export const getPostEngagement = async () => ({ likeCount: stubLikes, commentCount: stubCount(), isLikedByCurrentUser: stubLiked, authorId: 'u-author' });
export const togglePostLike = async () => {
  if (flag('likefail')) throw new ApiCodeError('UNKNOWN', 500);
  stubLiked = !stubLiked; stubLikes += stubLiked ? 1 : -1;
  return stubLiked;
};
export const getPostComments = async () => ({ postId: 'post-a', items: stubComments, page: 1, pageSize: 20, totalCount: stubComments.length, commentCount: stubCount(), hasMore: false });
export const addPostComment = async (_auth: unknown, _postId: string, text: string, parentCommentId?: string | null) => {
  const id = `srv-${stubCount() + 1}`;
  const comment: StubComment = { commentId: id, authorId: 'qa', authorName: 'alper', isPostAuthor: false, isMine: true, canDelete: true, parentCommentId: parentCommentId ?? null, text, createdAtUtc: new Date().toISOString(), replies: [] };
  stubComments = parentCommentId ? stubComments.map((c) => (c.commentId === parentCommentId ? { ...c, replies: [...c.replies, comment] } : c)) : [comment, ...stubComments];
  return id;
};
export const deletePostComment = async (_auth: unknown, _postId: string, commentId: string) => {
  stubComments = stubComments.filter((c) => c.commentId !== commentId).map((c) => ({ ...c, replies: c.replies.filter((r) => r.commentId !== commentId) }));
  return null;
};

export const getPlace = async (placeId: string) => {
  const found = catalogue.find((place) => place.id === placeId);
  if (!found) throw new Error('not found');
  return found;
};
