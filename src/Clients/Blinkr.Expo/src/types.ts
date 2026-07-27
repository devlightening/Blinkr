import type { Region } from 'react-native-maps';

export type AuthResponse = {
  userId: string;
  userName: string;
  email: string;
  token: string;
  refreshToken?: string;
  expiresIn?: number;
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
};

export type Bounds = {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
};

export type ClusterPoint = {
  type: 'Feature';
  properties: {
    cluster: boolean;
    post?: BlinkrPost;
    point_count?: number;
    cluster_id?: number;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
};

export type CreateSignalInput = {
  title: string;
  content: string;
  locationName: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  placeId?: string | null;
  signalType: SignalType;
  signalValue?: string | null;
  audienceType: AudienceType;
  identityDisclosure: IdentityDisclosure;
  locationPrecision: LocationPrecision;
  expiresAt: string;
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
export type LocationPrecision = 'ApproximateArea';

export type ComposerArea = {
  name: string;
  region: Region;
  accuracyMeters: number;
  source: 'device' | 'map';
};

export type LocationReadiness =
  | 'checking'
  | 'permission-required'
  | 'locating'
  | 'ready'
  | 'unavailable';

export const ISTANBUL_REGION: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};
