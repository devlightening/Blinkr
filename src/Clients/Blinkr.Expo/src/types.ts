import type { Region } from 'react-native-maps';

export type AuthResponse = {
  userId: string;
  userName: string;
  email: string;
  token: string;
  refreshToken?: string;
  expiresIn?: number;
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
    allowed: boolean;
    distanceMeters?: number | null;
    effectiveDistanceMeters?: number | null;
    thresholdMeters: number;
  };
};

export type LocationReadiness =
  | 'checking'
  | 'permission-required'
  | 'locating'
  | 'ready'
  | 'unavailable';

export type UploadState = 'idle' | 'preparing' | 'uploading' | 'ready' | 'failed';

export const ISTANBUL_REGION: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};
