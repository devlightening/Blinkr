import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getPlacesByIds } from './api';
import { PLACE_BATCH_LIMIT } from './placeShare';
import type { BlinkrPlace } from './types';

/** A place's live state is re-read at most this often while a screen shows it. */
const REFRESH_MS = 60_000;

/**
 * Places by id with their current state (one `/api/places/batch` call for all of them), refreshed every minute while
 * the app is in the foreground. A failed refresh keeps what was shown (stale-while-revalidate, CLAUDE.md §16); an id
 * the service does not know simply stays absent. Requests are cancelled when the ids change or the screen goes away.
 */
export function usePlacesLive(ids: string[]): Record<string, BlinkrPlace> {
  const [places, setPlaces] = useState<Record<string, BlinkrPlace>>({});
  const key = ids.slice(0, PLACE_BATCH_LIMIT).join(',');
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!key) return undefined;
    const asked = key.split(',');
    const load = () => {
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      getPlacesByIds(asked, controller.signal)
        .then((found) => {
          if (controller.signal.aborted) return;
          setPlaces((current) => {
            const next = { ...current };
            found.forEach((place) => { next[place.id] = place; });
            return next;
          });
        })
        .catch(() => { /* keep what is shown; the next tick tries again */ });
    };
    load();
    const timer = setInterval(() => { if (AppState.currentState === 'active') load(); }, REFRESH_MS);
    return () => { clearInterval(timer); inFlight.current?.abort(); };
  }, [key]);

  return places;
}
