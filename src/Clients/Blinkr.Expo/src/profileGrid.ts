import type { AuthoredPost } from './types';

/**
 * Profile signal grid (sinyal-mvp-plan P6.3): three square tiles per row. Pure logic, no React Native imports.
 * A tile shows its photo when it has one, otherwise a tinted square with the type; expired signals are dimmed;
 * anonymous ones carry a marker (only the author ever receives them).
 */
export const GRID_COLUMNS = 3;
export const GRID_GAP = 2;

export const gridTileSize = (screenWidth: number, horizontalPadding: number) =>
  Math.max(1, Math.floor((screenWidth - horizontalPadding * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS));

export type GridTile = { photoUrl: string | null; expired: boolean; anonymous: boolean; extraPhotos: number; video: boolean };

/**
 * V2-6: with typed media a video shows its thumbnail and a play marker (never the video file drawn as a picture); a
 * video without a thumbnail becomes a text tile. Older servers only send urls: those are taken as photos.
 */
export const gridTile = (post: Pick<AuthoredPost, 'mediaUrls' | 'expiresAt' | 'identityDisclosure' | 'media'>, now = Date.now()): GridTile => {
  const typed = (post.media ?? []).filter((m) => m && m.url);
  const first = typed[0];
  const count = typed.length > 0 ? typed.length : (post.mediaUrls ?? []).filter(Boolean).length;
  const video = first ? first.type === 'Video' : false;
  const photoUrl = first ? (video ? first.thumbnailUrl ?? null : first.thumbnailUrl ?? first.url) : (post.mediaUrls ?? []).filter(Boolean)[0] ?? null;
  return {
    photoUrl,
    expired: post.expiresAt ? Date.parse(post.expiresAt) < now : false,
    anonymous: post.identityDisclosure === 'AnonymousMap',
    extraPhotos: Math.max(0, count - 1),
    video,
  };
};

export type ProfileView = 'grid' | 'list';
