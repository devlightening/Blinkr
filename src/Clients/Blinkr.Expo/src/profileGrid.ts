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

export type GridTile = { photoUrl: string | null; expired: boolean; anonymous: boolean; extraPhotos: number };

export const gridTile = (post: Pick<AuthoredPost, 'mediaUrls' | 'expiresAt' | 'identityDisclosure'>, now = Date.now()): GridTile => {
  const photos = (post.mediaUrls ?? []).filter(Boolean);
  return {
    photoUrl: photos[0] ?? null,
    expired: post.expiresAt ? Date.parse(post.expiresAt) < now : false,
    anonymous: post.identityDisclosure === 'AnonymousMap',
    extraPhotos: Math.max(0, photos.length - 1),
  };
};

export type ProfileView = 'grid' | 'list';
