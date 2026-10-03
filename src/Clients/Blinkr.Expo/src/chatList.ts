import { foldSearchText } from './placeSearch';
import type { Conversation, UserSummary } from './types';

/** Doc S2: below this many letters the people search does not run (the server needs two). */
export const PEOPLE_QUERY_MIN = 2;

/** Folded, trimmed query; empty means "no search". */
export const normalizeQuery = (query: string) => foldSearchText(query.trim());

/**
 * Doc S2: conversations whose person matches the query, by user name or display name, Turkish-insensitive
 * ("sule" finds "Şule"). Names that start with the query come first; the list order (newest first) is kept otherwise.
 */
export const filterConversations = (
  conversations: Conversation[],
  nameOf: (userId: string) => { userName?: string; displayName?: string | null } | undefined,
  query: string,
): Conversation[] => {
  const q = normalizeQuery(query);
  if (!q) return conversations;
  const scored = conversations.flatMap((conversation, index) => {
    const person = nameOf(conversation.otherUserId);
    const names = [person?.userName, person?.displayName].filter((name): name is string => Boolean(name)).map(foldSearchText);
    if (names.some((name) => name.startsWith(q))) return [{ conversation, rank: 0, index }];
    if (names.some((name) => name.includes(q))) return [{ conversation, rank: 1, index }];
    return [];
  });
  return scored.sort((a, b) => a.rank - b.rank || a.index - b.index).map((entry) => entry.conversation);
};

/** Doc S2 "diğer kişiler": search results that are not me and not already in a listed conversation. */
export const otherPeople = (results: UserSummary[], conversations: Conversation[], myId: string): UserSummary[] => {
  const talking = new Set(conversations.map((conversation) => conversation.otherUserId));
  return results.filter((person) => person.id !== myId && !talking.has(person.id) && person.relation !== 'blocked');
};

/** Doc S6: the unread count on a row; nothing for zero, "9+" past nine so the badge keeps its size. */
export const unreadBadge = (count: number | null | undefined): string | null => {
  const n = Math.max(0, Math.floor(count ?? 0));
  if (n === 0) return null;
  return n > 9 ? '9+' : String(n);
};

/**
 * Doc S4: the long-press menu for a row. "Mark as read" only when something is unread and it is not only a waiting
 * snap (reading the conversation never consumes a snap, so it could not clear it).
 */
export const canMarkRead = (conversation: Conversation, myId: string) =>
  (conversation.unreadCount ?? 0) > 0
  && !(conversation.lastMessageKind === 'snap' && conversation.lastMessageState === 'sent' && conversation.lastMessageSenderId !== myId && (conversation.unreadCount ?? 0) <= 1);
