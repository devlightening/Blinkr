import { nearby } from './ui-fixtures';
export const searchPlaces = async (q: string) => nearby.filter(p => p.name.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')));
export const uploadMedia = async () => { throw new Error('Media is covered by the Gateway smoke, not the browser harness.'); };
export const toAbsoluteUrl = (url?: string | null) => url ?? null;
export const authenticate = async () => { throw new Error('Auth not stubbed for login tests.'); };
