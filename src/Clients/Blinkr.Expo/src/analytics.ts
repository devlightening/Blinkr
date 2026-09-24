/**
 * Product analytics (plan-devam G11, 12_I18N §4). One `track(event, props)` call for the whole app:
 * - It does nothing unless the person said yes (Ayarlar > Gizlilik > "Kullanım verilerini paylaş", off by default)
 *   AND a provider is configured. No provider is wired yet (a PostHog key is a secret the owner must supply), so today
 *   every event only lands in a short in-memory list used by tests and the developer preview.
 * - Only the properties listed for an event pass; anything else - coordinates, e-mail, message or description text -
 *   is dropped, and values must be short primitives.
 */
export const ANALYTICS_SCHEMA = {
  app_opened: ['cold_start', 'from_push'],
  map_viewed: ['zoom_bucket', 'pins_visible'],
  pin_tapped: ['signal_type', 'is_cluster', 'is_place'],
  signal_card_opened: ['signal_type', 'position'],
  signal_card_swiped: ['signal_type', 'position'],
  signal_create_started: ['entry'],
  signal_create_step: ['step', 'duration_ms'],
  signal_created: ['signal_type', 'has_media', 'source', 'is_anonymous', 'visibility', 'to_story', 'snap_recipients'],
  signal_verified: ['verdict', 'signal_age_min'],
  reaction_added: ['reaction'],
  comment_posted: ['is_reply', 'has_mention'],
  user_followed: ['source'],
  place_followed: ['mode'],
  story_viewed: ['items_seen'],
  message_sent: ['type'],
  notification_opened: ['type'],
  onboarding_step: ['step', 'result'],
} as const;

export type AnalyticsEvent = keyof typeof ANALYTICS_SCHEMA;
type Value = string | number | boolean;
export type AnalyticsProps = Record<string, unknown>;
export type AnalyticsSink = (event: AnalyticsEvent, props: Record<string, Value>) => void;

const MAX_STRING = 40;
const RECENT_LIMIT = 50;

/** Keeps only the schema's properties, as short primitives. */
export function cleanProps(event: AnalyticsEvent, props: AnalyticsProps = {}): Record<string, Value> {
  const allowed = ANALYTICS_SCHEMA[event] as readonly string[];
  const out: Record<string, Value> = {};
  for (const key of allowed) {
    const value = props[key];
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) out[key] = value;
    else if (typeof value === 'string' && value.length > 0 && value.length <= MAX_STRING) out[key] = value;
  }
  return out;
}

let consent = false;
let sink: AnalyticsSink | null = null;
const recent: Array<{ event: AnalyticsEvent; props: Record<string, Value> }> = [];

export const setAnalyticsConsent = (value: boolean) => { consent = value; if (!value) recent.length = 0; };
export const analyticsConsent = () => consent;
/** A provider, once one is configured (none in the MVP). */
export const setAnalyticsSink = (next: AnalyticsSink | null) => { sink = next; };
export const recentEvents = () => [...recent];

export function track(event: AnalyticsEvent, props?: AnalyticsProps) {
  if (!consent) return;
  const clean = cleanProps(event, props);
  recent.push({ event, props: clean });
  if (recent.length > RECENT_LIMIT) recent.shift();
  try { sink?.(event, clean); } catch { /* analytics never breaks the app */ }
}

/** Zoom levels grouped so no exact viewport is sent. */
export const zoomBucket = (zoom: number) => (zoom >= 16 ? 'street' : zoom >= 13 ? 'district' : zoom >= 10 ? 'city' : 'region');
