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
