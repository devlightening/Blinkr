import { parsePostLink, postLink } from '../src/deepLinks';

const check = (name: string, ok: boolean) => { if (!ok) throw new Error(`FAIL ${name}`); console.log(`PASS ${name}`); };
const id = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
check('a shared post link round-trips', parsePostLink(postLink(id)) === id);
check('query and trailing slash are ignored', parsePostLink(`blinkr://posts/${id}/?utm=x`) === id);
check('user links and other schemes are not posts', parsePostLink(`blinkr://users/${id}`) === null && parsePostLink(`https://evil.test/posts/${id}`) === null && parsePostLink('') === null && parsePostLink(null) === null);
check('odd ids are refused', parsePostLink('blinkr://posts/..%2F..') === null && parsePostLink('blinkr://posts/abc') === null);
