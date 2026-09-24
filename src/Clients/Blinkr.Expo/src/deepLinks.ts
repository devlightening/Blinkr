import { parseDeepLink } from './notifications';

/**
 * Links into Blinkr (V2-2). One format for notifications and shared signals: blinkr://posts/{id} and
 * blinkr://users/{id} (the parser lives in notifications.ts). A post link opens that signal on the map.
 */
export const postLink = (postId: string) => `blinkr://posts/${postId}`;

/** The post id from a Blinkr link, or null for anything else. */
export function parsePostLink(url: string | null | undefined): string | null {
  const target = parseDeepLink(url?.trim().replace(/\/?(?:[?#].*)?$/, '') ?? null);
  return target?.kind === 'post' ? target.postId : null;
}
