import type { Region } from 'react-native-maps';

export type AuthResponse = {
  userId: string;
  userName: string;
  email: string;
  token: string;
  refreshToken?: string;
  expiresIn?: number;
  /** Chosen avatar (see avatars.ts); null/absent = the default for this user id. */
  avatarKey?: string | null;
};

export type Bounds = {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
};

export type MediaKind = 'Image' | 'Video';

export type BlinkrMedia = {
  id?: string | null;
  mediaId?: string | null;
  mediaType: MediaKind | string;
  contentType?: string | null;
  url?: string | null;
  thumbnailUrl?: string | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
};

export type CurrentPlaceState = {
  signalType?: SignalType | null;
  signalValue?: string | null;
  freshness?: string | null;
  observedAtUtc?: string | null;
  expiresAtUtc?: string | null;
  confidence?: string | null;
  confidenceValue?: number | null;
  activeSignalCount?: number;
};

export type RecentSignal = {
  publicationTrust?: string | null;
  authorName?: string | null;
  postId: string;
  title?: string | null;
  text?: string | null;
  signalType?: SignalType | null;
  signalValue?: string | null;
  createdAtUtc?: string | null;
  expiresAtUtc?: string | null;
  locationName?: string | null;
  media?: BlinkrMedia[];
};

export type BlinkrPlace = {
  activityCount?: number;
  lastActivityUtc?: string | null;
  id: string;
  name: string;
  category?: string | null;
  latitude: number;
  longitude: number;
  displayAddress?: string | null;
  distanceMeters?: number;
  source?: string | null;
  currentState?: CurrentPlaceState | null;
  recentSignals?: RecentSignal[];
};

export type CoordinateSignal = {
  content?: string;
  media?: BlinkrMedia[];
  postId: string;
  title: string;
  textPreview: string;
  latitude: number;
  longitude: number;
  signalType: SignalType;
  signalValue?: string | null;
  createdAtUtc?: string | null;
  expiresAt?: string | null;
  locationName?: string | null;
  mediaThumbnailUrl?: string | null;
  authorPreview?: string | null;
};

/** One of the signed-in user's own posts, as returned by GET /api/posts-read/author/{id}. */
export type AuthoredPost = {
  id: string;
  title: string;
  content: string;
  createdAtUtc: string;
  expiresAt?: string | null;
  signalType: SignalType;
  signalValue?: string | null;
  locationName?: string | null;
  /** Only the author ever receives their own AnonymousMap posts. */
  identityDisclosure: 'LimitedProfile' | 'AnonymousMap' | string;
  mediaUrls: string[];
  placeId?: string | null;
};

export type UnifiedMapResponse = {
  places: BlinkrPlace[];
  signals: CoordinateSignal[];
};

export type BlinkrPost = {
  id: string;
  title?: string;
  content?: string;
  authorName?: string;
  createdAtUtc?: string;
  latitude: number | null;
  longitude: number | null;
  locationName?: string | null;
  likeCount?: number;
  commentCount?: number;
  freshnessSec?: number | null;
  isLive?: boolean;
  placeId?: string | null;
  signalType?: SignalType;
  signalValue?: string | null;
  audienceType?: AudienceType;
  identityDisclosure?: IdentityDisclosure;
  locationPrecision?: LocationPrecision;
  sourceType?: 'Community' | 'VerifiedBusiness';
  expiresAt?: string | null;
  media?: BlinkrMedia[];
};

export type CreateSignalInput = {
  title: string;
  content: string;
  locationName: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  observationLatitude?: number | null;
  observationLongitude?: number | null;
  observationAccuracyMeters?: number | null;
  proximityDistanceMeters?: number | null;
  proximityAllowed?: boolean | null;
  placeId?: string | null;
  signalType: SignalType;
  signalValue?: string | null;
  audienceType: AudienceType;
  identityDisclosure: IdentityDisclosure;
  locationPrecision: LocationPrecision;
  expiresAt: string;
  media?: Array<{
    mediaId: string;
    mediaType: MediaKind;
  }>;
};

export type SignalType =
  | 'GeneralObservation'
  | 'Crowd'
  | 'Queue'
  | 'Event'
  | 'Offer'
  | 'NewOpening'
  | 'TemporaryStatus';

export type AudienceType = 'Public';
export type IdentityDisclosure = 'LimitedProfile' | 'AnonymousMap';
export type LocationPrecision = 'ApproximateArea' | 'PlaceCenter';

export type ComposerArea = {
  name: string;
  region: Region;
  accuracyMeters: number;
  observationLatitude?: number | null;
  observationLongitude?: number | null;
  observationAccuracyMeters?: number | null;
  source: 'device' | 'map' | 'place';
  place?: BlinkrPlace | null;
  proximity?: {
    trustLevel?: string;
    allowed: boolean;
    distanceMeters?: number | null;
    effectiveDistanceMeters?: number | null;
    thresholdMeters?: number;
  };
};

export type PlacePresence = {
  isAllowed: boolean;
  trustLevel: string;
  distanceMeters: number | null;
  effectiveDistanceMeters: number | null;
};

export type LocationReadiness =
  | 'checking'
  | 'permission-required'
  | 'locating'
  | 'ready'
  | 'unavailable';

export type UploadState = 'idle' | 'preparing' | 'uploading' | 'ready' | 'failed';
export type NearbyStatus = 'LOADING' | 'READY' | 'EMPTY' | 'NOT_LOADED' | 'FAILED';

/** How one person relates to another, from the viewer's side ("incoming" = they asked me, "outgoing" = I asked them). */
export type Relation = 'none' | 'self' | 'friends' | 'incoming' | 'outgoing' | 'blocked';

export type UserSummary = {
  id: string;
  userName: string;
  avatarKey?: string | null;
  /** Present on search results; absent on older servers (= none). */
  relation?: Relation;
};

/** What anyone may see of a person: no e-mail, no friend list. */
export type PublicProfile = {
  id: string;
  userName: string;
  avatarKey?: string | null;
  bio?: string | null;
  joinedAtUtc: string;
  relation: Relation;
};

/** My own profile numbers (from /api/users/me). */
export type MyProfile = {
  bio?: string | null;
  friendCount: number;
  incomingRequestCount: number;
};

export type BlockedUser = { id: string; userName: string; avatarKey?: string | null; blockedAtUtc: string };
export type Friend = { id: string; userName: string; avatarKey?: string | null; sinceUtc: string };
export type FriendRequest = { id: string; userName: string; avatarKey?: string | null; createdAtUtc: string };
export type FriendRequests = { incoming: FriendRequest[]; outgoing: FriendRequest[] };

export type Conversation = {
  id: string;
  otherUserId: string;
  lastMessageAtUtc: string;
  lastMessagePreview?: string | null;
  lastMessageSenderId?: string | null;
  /** Messages from the other person that this user has not read yet (server-computed). */
  unreadCount?: number;
  /** "snap" when the latest message is a view-once photo/video; absent on older servers (= text). */
  lastMessageKind?: 'text' | 'snap';
  /** For a snap: waiting ("sent"), "opened" or "expired". */
  lastMessageState?: SnapState | null;
  /** Id of the latest message; lets the list open a waiting snap without loading the conversation. */
  lastMessageId?: string | null;
};

export type SnapState = 'sent' | 'opened' | 'expired';

/** What the client may know about a snap; the media itself is only fetched by the recipient, once. */
export type SnapInfo = {
  mediaType: 'Image' | 'Video';
  /** Seconds the recipient may look (1-10); 0 = until they close it. */
  durationSeconds: number;
  caption?: string | null;
  state: SnapState;
  expiresAtUtc: string;
  openedAtUtc?: string | null;
};

export type SnapOpenResult = {
  contentUrl: string;
  mediaType: 'Image' | 'Video';
  durationSeconds: number;
  caption?: string | null;
  viewUntilUtc: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAtUtc: string;
  isRead: boolean;
  kind?: 'text' | 'snap';
  snap?: SnapInfo | null;
};

export const ISTANBUL_REGION: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};
