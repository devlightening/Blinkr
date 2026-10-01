import { useEffect, useState } from 'react';

import { getUsersBatch } from './api';
import type { AuthResponse } from './types';

/**
 * Who a user id is, for avatars across the app (D-032): chosen avatar, profile photo version and names. Any avatar
 * that knows its person's id asks here; the ids asked for in the same moment go to the server as one
 * GET /api/users/batch call, and the answer is shared for a few minutes. People the server leaves out (deleted, or a
 * block either way) stay unknown and draw the default avatar. Only real user ids ever come here: anonymous signals
 * carry no author id, so they can never be matched to a person.
 */
export type Person = { userName?: string; displayName?: string | null; avatarKey?: string | null; photoVersion?: string | null };

const FRESH_MS = 5 * 60_000;
const BATCH_DELAY_MS = 40;
const BATCH_MAX = 50;

let auth: AuthResponse | null = null;
const cache = new Map<string, { person: Person | null; at: number }>();
const listeners = new Map<string, Set<() => void>>();
const queued = new Set<string>();
const inFlight = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** The server sends an all-zero id for an anonymous author: that is nobody, never ask about it. */
const EMPTY_ID = '00000000-0000-0000-0000-000000000000';
const isPerson = (id?: string | null): id is string => Boolean(id) && id !== EMPTY_ID;

const notify = (id: string) => listeners.get(id)?.forEach((listener) => listener());

/** Called whenever the session changes; a new person signing in starts with an empty cache. */
export function setPeopleAuth(next: AuthResponse | null) {
  if (next?.userId !== auth?.userId) cache.clear();
  auth = next;
}

export function getPeopleAuth() {
  return auth;
}

/** What a screen already knows (search results, a profile, my own change) goes in without another request. */
export function rememberPerson(id: string, person: Person) {
  const known = cache.get(id)?.person ?? {};
  cache.set(id, { person: { ...known, ...person }, at: Date.now() });
  notify(id);
}

async function flush() {
  timer = null;
  const current = auth;
  const ids = [...queued].slice(0, BATCH_MAX);
  ids.forEach((id) => { queued.delete(id); inFlight.add(id); });
  if (queued.size > 0) timer = setTimeout(flush, BATCH_DELAY_MS);
  if (!current || ids.length === 0) { ids.forEach((id) => inFlight.delete(id)); return; }
  try {
    const people = await getUsersBatch(current, ids);
    const now = Date.now();
    const found = new Set(people.map((p) => p.id));
    people.forEach((p) => cache.set(p.id, { person: { userName: p.userName, displayName: p.displayName, avatarKey: p.avatarKey, photoVersion: p.photoVersion }, at: now }));
    ids.filter((id) => !found.has(id)).forEach((id) => cache.set(id, { person: null, at: now }));
  } catch {
    // Offline or a server hiccup: keep whatever was known and ask again next time.
  } finally {
    ids.forEach((id) => { inFlight.delete(id); notify(id); });
  }
}

function want(id: string) {
  const entry = cache.get(id);
  if (entry && Date.now() - entry.at < FRESH_MS) return;
  if (queued.has(id) || inFlight.has(id)) return;
  queued.add(id);
  if (!timer) timer = setTimeout(flush, BATCH_DELAY_MS);
}

/** The person behind an id (undefined while unknown). Pass nothing for avatars that are not a person (anonymous). */
export function usePerson(rawId?: string | null): Person | undefined {
  const id = isPerson(rawId) ? rawId : undefined;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!id) return undefined;
    const listener = () => setTick((n) => n + 1);
    const set = listeners.get(id) ?? new Set();
    set.add(listener);
    listeners.set(id, set);
    want(id);
    return () => { set.delete(listener); if (set.size === 0) listeners.delete(id); };
  }, [id]);
  return id ? cache.get(id)?.person ?? undefined : undefined;
}
