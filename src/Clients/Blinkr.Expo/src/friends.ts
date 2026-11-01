import type { Relation, UserSummary } from './types';
import { tx } from './i18n/tx';

/**
 * Pure logic of friends and the public profile: the bio limit, what a relation lets the viewer do, and how people
 * are ordered. Friendship only helps people find each other and message; it never shares a location.
 */

export const BIO_MAX = 160;

/** The server collapses whitespace and line breaks the same way, so what is counted here is what gets stored. */
export const cleanBio = (raw: string) => raw.replace(/\s+/g, ' ').trim();

export const bioState = (raw: string) => {
  const value = cleanBio(raw);
  return { value, length: value.length, tooLong: value.length > BIO_MAX, empty: value.length === 0 };
};

export type FriendAction = 'add' | 'cancel' | 'accept' | 'decline' | 'remove' | 'block' | 'unblock';

/** The main button on a person: what tapping it does for this relation. Nothing for yourself. */
export const primaryAction = (relation: Relation | undefined): { action: FriendAction; label: string } | null => {
  switch (relation ?? 'none') {
    case 'none': return { action: 'add', label: tx('profile:friends.addFriend', 'Arkadaş ekle') };
    case 'outgoing': return { action: 'cancel', label: tx('profile:friends.withdrawRequest', 'İsteği geri al') };
    case 'incoming': return { action: 'accept', label: tx('profile:friends.accept', 'Kabul et') };
    case 'blocked': return { action: 'unblock', label: tx('profile:friends.unblock', 'Engeli kaldır') };
    default: return null;
  }
};

/** A small status word for rows and profiles ("" when there is nothing worth saying). */
export const relationLabel = (relation: Relation | undefined) => {
  switch (relation) {
    case 'friends': return tx('profile:relation.friends', 'Arkadaş');
    case 'outgoing': return tx('profile:relation.outgoing', 'İstek gönderildi');
    case 'incoming': return tx('profile:relation.incoming', 'Seni ekledi');
    case 'blocked': return tx('profile:relation.blocked', 'Engelli');
    default: return '';
  }
};

/** What the relation becomes when an action succeeds; the server's answer replaces it, this only drives the optimistic UI. */
export const relationAfter = (action: FriendAction): Relation => {
  switch (action) {
    case 'add': return 'outgoing';
    case 'accept': return 'friends';
    case 'block': return 'blocked';
    default: return 'none';
  }
};

const RANK: Record<Relation, number> = { friends: 0, incoming: 1, outgoing: 2, none: 3, blocked: 4, self: 5 };

/** Search results: friends first, then people waiting on me, then the rest; alphabetical inside each group. */
export const orderPeople = <T extends Pick<UserSummary, 'userName' | 'relation'>>(people: T[]): T[] =>
  [...people].sort((a, b) => RANK[a.relation ?? 'none'] - RANK[b.relation ?? 'none'] || a.userName.localeCompare(b.userName, 'tr'));

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']; // i18n-fallback: Turkish source, the UI reads common:months.N

/** "Eylül 2026'dan beri"; empty when the date is unusable. */
export const formatJoined = (iso: string | null | undefined) => {
  const time = iso ? Date.parse(iso) : Number.NaN;
  if (!Number.isFinite(time)) return '';
  const date = new Date(time);
  return tx('profile:joined', '{{month}} {{year}} tarihinden beri', { month: tx(`common:months.${date.getUTCMonth()}`, MONTHS[date.getUTCMonth()]), year: date.getUTCFullYear() });
};

/** "1 istek" / "12 istek"; the badge caps at 99+. */
export const badgeText = (count: number) => (count > 99 ? '99+' : String(Math.max(0, Math.floor(count))));

export type ReportTarget = 'user' | 'signal';
export type ReportReasonId = 'spam' | 'harassment' | 'hate' | 'nudity' | 'violence' | 'privacy' | 'self_harm' | 'inappropriate' | 'wrong_info' | 'other';
export const REPORT_NOTE_MAX = 300;

const REASON_LABELS: Record<ReportReasonId, string> = {
  spam: tx('profile:report.spam', 'Spam ya da reklam'),
  harassment: tx('profile:report.harassment', 'Taciz ya da rahatsız edici davranış'),
  hate: tx('profile:report.hate', 'Nefret söylemi'),
  nudity: tx('profile:report.nudity', 'Çıplaklık ya da cinsel içerik'),
  violence: tx('profile:report.violence', 'Şiddet'),
  privacy: tx('profile:report.privacy', 'Mahremiyet ihlali (izinsiz görüntü ya da bilgi)'),
  self_harm: tx('profile:report.selfHarm', 'Kendine zarar verme'),
  inappropriate: tx('profile:report.inappropriate', 'Uygunsuz içerik'),
  wrong_info: tx('profile:report.wrongInfo', 'Yanlış ya da eski bilgi'),
  other: tx('profile:report.other', 'Başka bir neden'),
};

/**
 * The reasons offered for a target (sinyal-mvp-plan 11 §4). "Wrong information" only makes sense for a signal about a
 * place. "inappropriate" is still accepted by the server for older app versions but no longer offered.
 */
export const reportReasons = (target: ReportTarget): { id: ReportReasonId; label: string }[] =>
  (['spam', 'harassment', 'hate', 'nudity', 'violence', 'privacy', 'self_harm', 'wrong_info', 'other'] as ReportReasonId[])
    .filter((id) => target === 'signal' || id !== 'wrong_info')
    .map((id) => ({ id, label: REASON_LABELS[id] }));

/** A report can be sent once a reason is chosen and the optional note fits. */
export const canSendReport = (reason: ReportReasonId | null, note: string) => reason !== null && cleanBio(note).length <= REPORT_NOTE_MAX;
