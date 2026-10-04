/**
 * Canlı Halka state (v4 brief §4): "what is this place like right now, and how fresh is that?" Pure logic, no React,
 * so plain-node tests run it (scripts/live-state.test.ts).
 *
 * Every screen builds a place's ring from the server's `currentState` (`liveStateFromCurrent`): the server already
 * keeps only VERIFIED_LIVE, unexpired signals and one voice per person (trust is server-owned), so every screen shows
 * the same ring. `computeLiveState` is the client-side fallback for a list of raw signals; it follows the same rules.
 *
 * Value names are the backend's (`signalCatalog.ts`): Crowd Calm | Moderate | Busy - note Busy means *crowded* -
 * Queue None | 5To15 | Over15. Legacy upper-case values (EMPTY, BUSY, LONG) still map. An unknown value is no vote.
 */

export type LiveKind = 'calm' | 'busy' | 'crowded' | 'closed' | 'event' | 'deal' | 'info' | 'unknown';
export type LiveLevel = 0 | 1 | 2;

export type LiveSignal = {
  type: string;
  value: string;
  atUtc: string;
  reporterId: string;
  verified: boolean;
};

export type LiveState = {
  kind: LiveKind;
  level: LiveLevel | null;
  /** 0..1, the filled part of the ring. */
  freshness: number;
  ageMinutes: number | null;
  /** People with a verified live signal here (server: one voice per person). */
  confirmations: number;
  isStale: boolean;
  source: 'live' | 'hours' | 'none';
  /** The signal behind the state, for wording ("Yeni açılış", "Geçici durum"). */
  signalType: string | null;
  signalValue: string | null;
};

export const WINDOW_MINUTES = 180;
export const HALF_LIFE_MINUTES = 30;
export const CLOSED_WINDOW_MINUTES = 90;
export const PULSE_MAX_MINUTES = 15;

const CROWD_LEVELS: Record<string, LiveLevel> = {
  calm: 0, empty: 0, quiet: 0,
  moderate: 1, active: 1,
  busy: 2, crowded: 2, packed: 2, full: 2,
};
const QUEUE_LEVELS: Record<string, LiveLevel> = {
  none: 0, '5to15': 1, short: 1, medium: 1, over15: 2, long: 2,
};

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

export function levelFromSignal(s: { type: string; value: string }): LiveLevel | null {
  const t = norm(s.type);
  const v = norm(s.value);
  if (t === 'crowd') return v in CROWD_LEVELS ? CROWD_LEVELS[v] : null;
  if (t === 'queue') return v in QUEUE_LEVELS ? QUEUE_LEVELS[v] : null;
  return null;
}

export function kindFromLevel(level: LiveLevel): LiveKind {
  return level === 0 ? 'calm' : level === 1 ? 'busy' : 'crowded';
}

/** The ring kind a single signal stands for. `null`: the signal says nothing about the place's state. */
export function kindFromSignal(type: string | null | undefined, value: string | null | undefined): LiveKind | null {
  const t = norm(type);
  const v = norm(value);
  const level = levelFromSignal({ type: t, value: v });
  if (level !== null) return kindFromLevel(level);
  if (t === 'temporarystatus') return v === 'closed' ? 'closed' : v === 'open' ? 'info' : 'unknown';
  if (t === 'event') return v === 'ended' ? null : 'event';
  if (t === 'offer') return v === 'ended' ? null : 'deal';
  if (t === 'newopening') return 'deal';
  return null;
}

/** 0-15 min -> 1 · 15-60 min -> 1..0.7 · 1-3 h -> 0.7..0.2 · 3 h+ -> 0 */
export function freshnessFromAge(min: number): number {
  if (min <= 15) return 1;
  if (min <= 60) return 1 - ((min - 15) / 45) * 0.3;
  if (min <= WINDOW_MINUTES) return 0.7 - ((min - 60) / (WINDOW_MINUTES - 60)) * 0.5;
  return 0;
}

export type AgeParts = { unit: 'min' | 'hour' | 'day'; n: number };
export function ageParts(min: number): AgeParts {
  if (min < 60) return { unit: 'min', n: Math.max(1, Math.round(min)) };
  if (min < 60 * 24) return { unit: 'hour', n: Math.round(min / 60) };
  return { unit: 'day', n: Math.round(min / (60 * 24)) };
}

const ageMin = (atUtc: string, nowMs: number) => Math.max(0, (nowMs - Date.parse(atUtc)) / 60000);

const NONE: LiveState = {
  kind: 'unknown', level: null, freshness: 0, ageMinutes: null, confirmations: 0, isStale: true, source: 'none', signalType: null, signalValue: null,
};

/**
 * Simple "HH:MM-HH:MM" opening hours. Anything more complex -> null (unknown). `now` must be the PLACE's local time.
 * The catalogue carries no hours today, so the dashed "by hours" estimate only appears once the server sends them.
 */
export function openByHours(hours: string | null | undefined, now: Date): boolean | null {
  if (!hours) return null;
  const m = /^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/.exec(hours.trim());
  if (!m) return null;
  const from = +m[1] * 60 + +m[2];
  let to = +m[3] * 60 + +m[4];
  const cur = now.getHours() * 60 + now.getMinutes();
  if (to <= from) to += 24 * 60;
  const c = cur < from ? cur + 24 * 60 : cur;
  return c >= from && c < to;
}

function byHours(hoursOpen: boolean | null): LiveState {
  if (hoursOpen === true) return { ...NONE, kind: 'info', isStale: false, source: 'hours' };
  if (hoursOpen === false) return { ...NONE, kind: 'closed', isStale: false, source: 'hours' };
  return NONE;
}

/** The ring from the server's summary (`BlinkrPlace.currentState`). */
export function liveStateFromCurrent(
  current: {
    signalType?: string | null; signalValue?: string | null; freshness?: string | null;
    observedAtUtc?: string | null; expiresAtUtc?: string | null; activeSignalCount?: number | null;
  } | null | undefined,
  nowMs: number,
  hoursOpen: boolean | null = null,
): LiveState {
  if (!current?.signalType || !current.observedAtUtc || current.freshness === 'NONE') return byHours(hoursOpen);
  if (current.expiresAtUtc && Date.parse(current.expiresAtUtc) <= nowMs) return byHours(hoursOpen);
  const age = ageMin(current.observedAtUtc, nowMs);
  if (!Number.isFinite(age) || age > WINDOW_MINUTES || current.freshness === 'STALE') return byHours(hoursOpen);
  const kind = kindFromSignal(current.signalType, current.signalValue);
  if (kind === null) return byHours(hoursOpen);
  const level = levelFromSignal({ type: current.signalType, value: current.signalValue ?? '' });
  return {
    kind, level, freshness: freshnessFromAge(age), ageMinutes: age, confirmations: Math.max(1, current.activeSignalCount ?? 1),
    isStale: false, source: 'live', signalType: current.signalType, signalValue: current.signalValue ?? null,
  };
}

/** Client-side fallback from raw signals; same rules as the server plus "closed wins for 90 min". */
export function computeLiveState(signals: LiveSignal[], nowMs: number, hoursOpen: boolean | null = null): LiveState {
  const live = signals.filter((s) => s.verified && Number.isFinite(Date.parse(s.atUtc)) && ageMin(s.atUtc, nowMs) <= WINDOW_MINUTES);

  const latestByReporter = new Map<string, LiveSignal>();
  for (const s of live) {
    const key = `${s.reporterId}|${norm(s.type)}`;
    const prev = latestByReporter.get(key);
    if (!prev || Date.parse(s.atUtc) > Date.parse(prev.atUtc)) latestByReporter.set(key, s);
  }
  const votes = [...latestByReporter.values()];

  const status = votes
    .filter((s) => norm(s.type) === 'temporarystatus')
    .sort((a, b) => Date.parse(b.atUtc) - Date.parse(a.atUtc))[0];
  if (status && norm(status.value) === 'closed' && ageMin(status.atUtc, nowMs) <= CLOSED_WINDOW_MINUTES) {
    const a = ageMin(status.atUtc, nowMs);
    return { ...NONE, kind: 'closed', freshness: freshnessFromAge(a), ageMinutes: a, confirmations: 1, isStale: false, source: 'live', signalType: status.type, signalValue: status.value };
  }

  const weights: [number, number, number] = [0, 0, 0];
  const who = new Set<string>();
  let newest: number | null = null;
  let newestSignal: LiveSignal | null = null;
  for (const s of votes) {
    const lvl = levelFromSignal(s);
    if (lvl === null) continue;
    const a = ageMin(s.atUtc, nowMs);
    weights[lvl] += Math.pow(0.5, a / HALF_LIFE_MINUTES);
    who.add(s.reporterId);
    if (newest === null || a < newest) { newest = a; newestSignal = s; }
  }
  if (newest !== null && newestSignal) {
    // Ties go to the cautious (higher) level.
    const best = ([0, 1, 2] as LiveLevel[]).reduce((p, c) => (weights[c] >= weights[p] ? c : p), 0 as LiveLevel);
    return {
      kind: kindFromLevel(best), level: best, freshness: freshnessFromAge(newest), ageMinutes: newest,
      confirmations: who.size, isStale: false, source: 'live', signalType: newestSignal.type, signalValue: newestSignal.value,
    };
  }
  return byHours(hoursOpen);
}

export type ClusterMix = { calm: number; busy: number; crowded: number; other: number };
export function clusterMix(states: LiveState[]): ClusterMix {
  const mix = { calm: 0, busy: 0, crowded: 0, other: 0 };
  for (const s of states) {
    if (s.kind === 'calm') mix.calm++;
    else if (s.kind === 'busy') mix.busy++;
    else if (s.kind === 'crowded') mix.crowded++;
    else mix.other++;
  }
  return mix;
}

/** Pulse only for fresh live information, and never on a map marker (bitmap). */
export const shouldPulse = (s: LiveState) => s.source === 'live' && s.ageMinutes !== null && s.ageMinutes <= PULSE_MAX_MINUTES;

/** Estimated from hours, never confused with verified live information (dashed). */
export const isEstimated = (s: LiveState) => s.source === 'hours';

export type NowFilter = 'open' | 'calm' | 'event' | 'deal';
const OPEN_KINDS: ReadonlySet<LiveKind> = new Set(['calm', 'busy', 'crowded', 'info', 'event', 'deal']);

/** "Şimdi" chips: a place passes when it matches ANY active filter; no active filter passes everything. */
export function matchesNowFilters(s: LiveState, active: ReadonlySet<NowFilter>): boolean {
  if (active.size === 0) return true;
  for (const f of active) {
    if (f === 'open' && s.source !== 'none' && OPEN_KINDS.has(s.kind)) return true;
    if (f === 'calm' && s.source === 'live' && s.kind === 'calm') return true;
    if (f === 'event' && s.source === 'live' && s.kind === 'event') return true;
    if (f === 'deal' && s.source === 'live' && s.kind === 'deal') return true;
  }
  return false;
}

/**
 * A marker's bitmap only changes when its kind, source or ring step changes (tenths of the arc). Used as the marker
 * `key` with tracksViewChanges={false}, so the 60 s freshness tick redraws only the markers that actually changed.
 */
export const liveRenderKey = (s: LiveState) => `${s.kind}.${s.source}.${Math.round(s.freshness * 10)}`;

/** Lists: live and fresh first (fresher first), then the rest by distance. */
export function compareByLiveness(a: { state: LiveState; distanceMeters?: number | null }, b: { state: LiveState; distanceMeters?: number | null }): number {
  const la = a.state.source === 'live' ? 0 : a.state.source === 'hours' ? 1 : 2;
  const lb = b.state.source === 'live' ? 0 : b.state.source === 'hours' ? 1 : 2;
  if (la !== lb) return la - lb;
  if (la === 0) {
    const fa = Math.round(a.state.freshness * 10);
    const fb = Math.round(b.state.freshness * 10);
    if (fa !== fb) return fb - fa;
  }
  return (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.distanceMeters ?? Number.MAX_SAFE_INTEGER);
}
