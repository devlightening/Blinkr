import NetInfo from '@react-native-community/netinfo';
import { Directory, File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { createSignal, postStory, sendSnap, startConversation, uploadMedia } from './api';
import { afterFailure, mediaKindOf, nextDue, summarize, type OutboxItem, type OutboxMedia } from './shareQueue';
import type { AuthResponse } from './types';

type Refresh = { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };

const TICK_MS = 5_000;
const OUTBOX_FILE = 'outbox.json';
const OUTBOX_DIR = 'outbox';

/** Loads the saved outbox. A broken or missing file is an empty outbox, never a crash. */
export const loadOutbox = (): OutboxItem[] => {
  try {
    const file = new File(Paths.document, OUTBOX_FILE);
    if (!file.exists) return [];
    const parsed = JSON.parse(file.textSync()) as OutboxItem[];
    // Anything left "sending" by a closed app is simply pending again.
    return Array.isArray(parsed) ? parsed.map((item) => (item.status === 'sending' ? { ...item, status: 'pending' as const } : item)) : [];
  } catch {
    return [];
  }
};

const saveOutbox = (items: OutboxItem[]) => {
  try {
    const file = new File(Paths.document, OUTBOX_FILE);
    if (!file.exists) file.create();
    file.write(JSON.stringify(items));
  } catch { /* the in-memory outbox still works this session */ }
};

/** Keeps a copy of a captured file in the app's own folder: camera/cache files can be cleared before a late upload. */
const keepCopy = async (uri: string, name: string) => {
  try {
    const dir = new Directory(Paths.document, OUTBOX_DIR);
    if (!dir.exists) dir.create();
    const target = new File(dir, name);
    await new File(uri).copy(target);
    return target.uri;
  } catch {
    return uri;
  }
};

const dropCopies = (item: OutboxItem) => {
  for (const m of item.media) {
    if (!m.localUri.includes(`/${OUTBOX_DIR}/`)) continue;
    try { const file = new File(m.localUri); if (file.exists) file.delete(); } catch { /* best effort */ }
  }
};

export type SharedResult = { postId: string; item: OutboxItem };

/**
 * The background sender (plan-devam D9). `enqueue` returns at once; the runner publishes in order, uploads media that
 * is not uploaded yet (never twice), then the story and snaps (best effort - the signal is what matters). It wakes up
 * every few seconds, when the connection comes back and when the app returns to the foreground.
 */
export function useShareOutbox({ auth, refresh, onShared, onRefused }: {
  auth: AuthResponse | null;
  refresh: Refresh;
  onShared: (result: SharedResult) => void;
  onRefused: (item: OutboxItem) => void;
}) {
  const [items, setItems] = useState<OutboxItem[]>(loadOutbox);
  const itemsRef = useRef(items);
  const busy = useRef(false);
  const context = useRef({ auth, refresh, onShared, onRefused });
  context.current = { auth, refresh, onShared, onRefused };

  const persist = useCallback((next: OutboxItem[]) => {
    itemsRef.current = next;
    setItems(next);
    saveOutbox(next);
  }, []);
  const update = useCallback((id: string, change: (item: OutboxItem) => OutboxItem | null) => {
    persist(itemsRef.current.flatMap((item) => {
      if (item.id !== id) return [item];
      const next = change(item);
      return next ? [next] : [];
    }));
  }, [persist]);

  const process = useCallback(async () => {
    const { auth: session, refresh: hooks } = context.current;
    if (busy.current || !session) return;
    const item = nextDue(itemsRef.current);
    if (!item) return;
    busy.current = true;
    update(item.id, (i) => ({ ...i, status: 'sending' }));
    try {
      const media: OutboxMedia[] = [];
      for (const [index, m] of item.media.entries()) {
        if (m.mediaId) { media.push(m); continue; }
        const uploaded = await uploadMedia(session, { uri: m.localUri, fileName: m.fileName, mimeType: m.mimeType, type: m.kind }, hooks.onAuthRefresh, hooks.onSessionExpired);
        const done = { ...m, mediaId: uploaded.mediaId };
        media.push(done);
        // Remember the upload right away: a retry after a later failure must not upload the same file again.
        update(item.id, (i) => ({ ...i, media: i.media.map((x, j) => (j === index ? done : x)) }));
      }
      const postId = await createSignal(session, { ...item.input, media: media.map((m) => ({ mediaId: m.mediaId!, mediaType: mediaKindOf(m.kind) })) }, hooks.onAuthRefresh, hooks.onSessionExpired);
      const photo = item.media.find((m) => m.kind === 'image') ?? item.media[0];
      if (item.story && photo) {
        await postStory(session, { uri: photo.localUri, mimeType: photo.mimeType, fileName: photo.fileName, type: photo.kind }, { durationSeconds: photo.kind === 'video' ? 0 : 5 }, hooks).catch(() => {});
      }
      const snapPhoto = item.media.find((m) => m.kind === 'image');
      if (snapPhoto) {
        for (const friendId of item.snapFriendIds) {
          try {
            const conversation = await startConversation(session, friendId, hooks.onAuthRefresh, hooks.onSessionExpired);
            await sendSnap(session, conversation.id, { uri: snapPhoto.localUri, fileName: snapPhoto.fileName, mimeType: snapPhoto.mimeType, type: 'image' }, { durationSeconds: 5 }, hooks.onAuthRefresh, hooks.onSessionExpired);
          } catch { /* a snap that did not go is not worth holding the signal back */ }
        }
      }
      dropCopies(item);
      update(item.id, () => null);
      context.current.onShared({ postId, item });
    } catch (error) {
      const next = afterFailure(item, error);
      update(item.id, () => next);
      if (next.status === 'failed') context.current.onRefused(next);
    } finally {
      busy.current = false;
    }
  }, [update]);

  // Wake-ups: a steady tick, connection back, app back in front.
  useEffect(() => {
    const timer = setInterval(() => { void process(); }, TICK_MS);
    const net = NetInfo.addEventListener((state) => { if (state.isConnected) void process(); });
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') void process(); });
    void process();
    return () => { clearInterval(timer); net(); app.remove(); };
  }, [process]);

  const enqueue = useCallback(async (item: OutboxItem) => {
    const media = await Promise.all(item.media.map(async (m, i) => (m.mediaId ? m : { ...m, localUri: await keepCopy(m.localUri, `${item.id}-${i}.${m.kind === 'video' ? 'mp4' : 'jpg'}`) })));
    persist([...itemsRef.current, { ...item, media }]);
    void process();
  }, [persist, process]);

  const retry = useCallback((id: string) => {
    update(id, (i) => ({ ...i, status: 'pending', nextAttemptAt: 0 }));
    void process();
  }, [process, update]);

  const discard = useCallback((id: string) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (item) dropCopies(item);
    update(id, () => null);
  }, [update]);

  const summary = useMemo(() => summarize(items), [items]);
  return { items, summary, enqueue, retry, discard };
}
