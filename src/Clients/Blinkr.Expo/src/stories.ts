/**
 * Stories (sinyal-mvp-plan Faz 7 P7.6-P7.8). Pure logic, no React Native imports.
 * Server: NotificationsService `/api/stories` (24 h, author + accepted followers).
 */
export type StoryTrayItem = { authorId: string; authorName: string; isMine: boolean; storyCount: number; latestAtUtc: string; allSeen: boolean };
export type Story = {
  id: string;
  authorId: string;
  authorName: string;
  mediaType: 'Image' | 'Video' | string;
  caption?: string | null;
  durationSeconds: number;
  createdAtUtc: string;
  expiresAtUtc: string;
  seen: boolean;
  viewerCount?: number | null;
};
export type StoryViewer = { userId: string; userName: string; seenAtUtc: string };

export const STORY_PHOTO_SECONDS = [3, 5, 10] as const;
export const DEFAULT_STORY_SECONDS = 5;
/** A clip with no timer still moves on after this long (the recording cap). */
export const STORY_VIDEO_MAX_SECONDS = 15;
export const STORY_REPLY_MAX = 300;

/** How long a story stays on screen. */
export const storySeconds = (story: Pick<Story, 'mediaType' | 'durationSeconds'>) =>
  story.mediaType === 'Video' ? (story.durationSeconds > 0 ? story.durationSeconds : STORY_VIDEO_MAX_SECONDS) : Math.max(1, story.durationSeconds || DEFAULT_STORY_SECONDS);

/** Where to start watching someone: the first unseen story, or the beginning when all are seen. */
export const firstUnseenIndex = (stories: Pick<Story, 'seen'>[]) => {
  const index = stories.findIndex((story) => !story.seen);
  return index < 0 ? 0 : index;
};

export type StoryStep = { kind: 'story'; index: number } | { kind: 'close' };
/** Tap right / timer end: next story, or leave after the last. */
export const nextStep = (index: number, count: number): StoryStep => (index + 1 < count ? { kind: 'story', index: index + 1 } : { kind: 'close' });
/** Tap left: previous story; on the first one it simply restarts. */
export const previousStep = (index: number): StoryStep => ({ kind: 'story', index: Math.max(0, index - 1) });

/** Progress bar fill for each segment: done ones full, the current one partial, later ones empty. */
export const segmentFill = (segment: number, current: number, progress: number) =>
  segment < current ? 1 : segment > current ? 0 : Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));

/** A reply to a story goes to the author as an ordinary direct message, clearly marked. */
export const storyReplyText = (reply: string) => {
  const clean = reply.replace(/\s+/g, ' ').trim().slice(0, STORY_REPLY_MAX);
  return clean ? `↩ Hikayene yanıt: ${clean}` : '';
};

/** The tray ring: my own story (or the "+" when I have none), unseen (bright) or seen (quiet). */
export const trayRing = (item: Pick<StoryTrayItem, 'isMine' | 'allSeen' | 'storyCount'>): 'add' | 'unseen' | 'seen' =>
  item.isMine && item.storyCount === 0 ? 'add' : item.allSeen ? 'seen' : 'unseen';
