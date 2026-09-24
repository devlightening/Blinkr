/**
 * How a conversation is laid out as bubbles (plan-devam Faz E). Pure logic, no React Native imports.
 * Messages arrive newest-first (the list is inverted), so "older" is the next item in the array.
 */
type MessageLike = { id: string; senderId: string; createdAtUtc: string; kind?: string; seen?: boolean; seenAtUtc?: string | null };

/** Messages from the same person this close together form one group (rounded corners, one time stamp). */
export const GROUP_GAP_MS = 5 * 60_000;

export type ThreadRow<M extends MessageLike> =
  | { type: 'message'; key: string; message: M; mine: boolean; groupTop: boolean; groupBottom: boolean }
  | { type: 'day'; key: string; label: string };

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Bugün / Dün / a weekday within the last week / a date (with the year when it is not this year). */
export function dayLabel(iso: string, now = new Date(), language: 'tr' | 'en' = 'tr') {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const locale = language === 'en' ? 'en-GB' : 'tr-TR';
  if (days <= 0) return language === 'en' ? 'Today' : 'Bugün';
  if (days === 1) return language === 'en' ? 'Yesterday' : 'Dün';
  if (days < 7) return date.toLocaleDateString(locale, { weekday: 'long' });
  return date.toLocaleDateString(locale, date.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
}

const joins = (a: MessageLike, b: MessageLike) =>
  a.senderId === b.senderId
  && dayKey(new Date(a.createdAtUtc)) === dayKey(new Date(b.createdAtUtc))
  && Math.abs(Date.parse(a.createdAtUtc) - Date.parse(b.createdAtUtc)) <= GROUP_GAP_MS;

/**
 * Rows for an inverted list: each message knows whether it starts (groupTop = oldest) or ends (groupBottom = newest,
 * shows the time) its group, and a day separator follows the oldest message of each day.
 */
export function buildThread<M extends MessageLike>(messages: M[], me: string, now = new Date(), language: 'tr' | 'en' = 'tr'): ThreadRow<M>[] {
  const rows: ThreadRow<M>[] = [];
  messages.forEach((message, index) => {
    const newer = messages[index - 1];
    const older = messages[index + 1];
    rows.push({
      type: 'message',
      key: message.id,
      message,
      mine: message.senderId === me,
      groupTop: !older || !joins(older, message),
      groupBottom: !newer || !joins(message, newer),
    });
    const date = new Date(message.createdAtUtc);
    if (!older || dayKey(new Date(older.createdAtUtc)) !== dayKey(date)) {
      rows.push({ type: 'day', key: `day-${dayKey(date)}`, label: dayLabel(message.createdAtUtc, now, language) });
    }
  });
  return rows;
}

/** The newest message I sent (not a taken-back one, not a snap - a snap shows its own status): the receipt goes under it only. */
export const lastOwnMessageId = (messages: MessageLike[], me: string) =>
  messages.find((m) => m.senderId === me && m.kind !== 'unsent' && m.kind !== 'snap')?.id ?? null;

/** "Görüldü 14:32" when the time is known, "Görüldü" for older messages, otherwise "Gönderildi". */
export function receiptLabel(message: MessageLike, language: 'tr' | 'en' = 'tr') {
  if (!message.seen) return language === 'en' ? 'Sent' : 'Gönderildi';
  const at = message.seenAtUtc ? new Date(message.seenAtUtc) : null;
  const time = at && !Number.isNaN(at.getTime()) ? at.toLocaleTimeString(language === 'en' ? 'en-GB' : 'tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
  return `${language === 'en' ? 'Seen' : 'Görüldü'}${time ? ` ${time}` : ''}`;
}

/** "Typing" is sent at most every few seconds while the person types (the server forgets it after 6 s). */
export const TYPING_PING_MS = 3_000;
export const shouldPingTyping = (lastPingAt: number, now: number, draft: string) => draft.trim().length > 0 && now - lastPingAt >= TYPING_PING_MS;
