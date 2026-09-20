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
