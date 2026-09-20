// Usage: node scripts/ui-shot.cjs <scene> [width=390] [height=844] [extra query, e.g. "dark"]
// Renders a browser scene and writes .tmp/product-ui/shot-<scene>.png for visual review.
const path = require('node:path');
const { chromium } = require('@playwright/test');
const { buildPreview, servePreview } = require('./ui-build.cjs');
(async () => {
  const [scene, width = '390', height = '844', extra = ''] = process.argv.slice(2);
  const out = path.resolve('.tmp/product-ui');
  await buildPreview(out);
  const server = await servePreview(out);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: +width, height: +height }, deviceScaleFactor: 2 });
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/?scene=${scene}${extra ? '&' + extra : ''}`);
    await page.waitForTimeout(1400);
    const file = path.join(out, `shot-${scene}${extra ? '-' + extra : ''}.png`);
    await page.screenshot({ path: file });
    console.log(file);
    if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
