import { useEffect, useRef, useState } from 'react';

import { isRealtimeLive, onRealtime, onRealtimeLiveChange } from './realtime';

/** Whether the realtime hub is connected right now (screens slow their polling while it is). */
export function useRealtimeLive() {
  const [live, setLive] = useState(isRealtimeLive());
  useEffect(() => onRealtimeLiveChange(setLive), []);
  return live;
}

/** Runs `handler` for every `event` from the hub; the latest handler is always used, the subscription is made once. */
export function useRealtimeEvent(event: string, handler: (payload: unknown) => void) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => onRealtime(event, (payload) => latest.current(payload)), [event]);
}
