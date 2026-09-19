const esbuild = require('esbuild');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium, expect } = require('@playwright/test');
async function main() {
  const out = path.resolve('.tmp/product-ui');
  await fs.mkdir(out, { recursive: true });
  await esbuild.build({ entryPoints: ['scripts/ui-preview.tsx'], outfile: path.join(out, 'app.js'), bundle: true, jsx: 'automatic', resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.json'], define: { __DEV__: 'true', 'process.env.NODE_ENV': '"development"', global: 'globalThis' }, inject: [path.resolve('scripts/ui-process-shim.js')], alias: {
    'react-native': 'react-native-web',
    // expo SDK 57 nests expo-modules-core under expo/node_modules instead of
    // hoisting it; Metro resolves that fine, plain esbuild/Node resolution does not.
    'expo-modules-core': path.resolve('node_modules/expo/node_modules/expo-modules-core'),
  }, plugins: [{ name: 'native-test-ports', setup(build) {
    build.onResolve({ filter: /^\.\/.*\.js$/ }, async args => {
      const web = path.resolve(args.resolveDir, args.path.replace(/\.js$/, '.web.js'));
      try { await fs.access(web); return { path: web }; } catch { return undefined; }
    });
    build.onResolve({ filter: /^(expo-video|expo-haptics|expo-image-picker|expo-secure-store)$/ }, () => ({ path: path.resolve('scripts/ui-native-stub.tsx') }));
    build.onResolve({ filter: /\/api$/ }, () => ({ path: path.resolve('scripts/ui-api-stub.ts') }));
  } }] });
  const server = http.createServer(async (req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type','text/javascript'); res.end(await fs.readFile(path.join(out,'app.js'))); }
    else { res.setHeader('Content-Type','text/html; charset=utf-8'); res.end('<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}*{box-sizing:border-box}</style><div id="root"></div><script src="/app.js"></script></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors=[]; page.on('pageerror', error => errors.push(error.message));
    const url=`http://127.0.0.1:${server.address().port}`;
    await page.goto(url);
    await expect(page.getByText('Nerede oluyor?')).toBeVisible();
    await page.waitForTimeout(420); await page.screenshot({ path: path.join(out, 'composer-where.png') });
    await page.getByLabel('Şehit Mahmut Kavak Parkı yerini seç').click();
    await expect(page.getByText('Yakındaki yer paylaşımı')).toBeVisible();
    await expect(page.getByText('Hz. Ali Camii')).toHaveCount(0);
    await page.getByText('Devam', { exact: true }).click();
    await page.getByText('Doluluk', { exact: true }).click();
    await page.getByText('Sakin', { exact: true }).click();
    await page.waitForTimeout(420); await page.screenshot({ path: path.join(out, 'composer-type.png') });
    await page.getByText('Devam', { exact: true }).click();
    await page.getByPlaceholder('Örn. Bekleme süresi 10 dakika').fill('Park bu akşam sakin');
    await page.getByText('Devam', { exact: true }).click();
    await page.waitForTimeout(420); await page.screenshot({ path: path.join(out, 'composer-review.png') });
    await page.getByText('Yayınla', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Yayınlanıyor' })).toBeDisabled();
    await expect(page.getByLabel('Published result')).toHaveText('park:Crowd:Calm');
    await expect(page.getByLabel('Publication count')).toHaveText('1');
    await page.goto(url);
    await page.getByLabel('Bu konumda paylaş', { exact: true }).click();
    await page.getByRole('button', { name: 'Devam', exact: true }).click();
    await page.getByText('Doluluk', { exact: true }).click();
    await page.getByText('Sakin', { exact: true }).click();
    await page.getByRole('button', { name: 'Devam', exact: true }).click();
    await page.getByRole('button', { name: 'Devam', exact: true }).click();
    await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
    await expect(page.getByLabel('Published result')).toHaveText('coordinate:Crowd:Calm');
    await expect(page.getByLabel('Publication count')).toHaveText('1');
    await page.goto(url+'?error');
    await expect(page.getByText('Şu anda bağlantı kurulamıyor. Lütfen tekrar dene.')).toBeVisible();
    await expect(page.getByText('Network request timed out')).toHaveCount(0);
    await page.goto(url);
    await page.getByLabel('Kapat', { exact: true }).last().click();
    await expect(page.getByText('Nerede oluyor?')).toHaveCount(0);
    await page.getByLabel('Yeniden aç').click();
    await page.getByText('Yer ara', { exact: true }).click();
    await page.getByLabel('Yer adı veya kategori').fill('BİM');
    await expect(page.getByLabel(/BİM, .*seç/)).toHaveCount(2);
    await page.waitForTimeout(420); await page.screenshot({ path: path.join(out, 'place-search.png') });
    for (const width of [320, 430, 820]) {
      await page.setViewportSize({ width, height: width === 820 ? 1180 : 844 });
      await page.goto(url+'?detail');
      await expect(page.getByText('Şehit Mahmut Kavak Parkı')).toBeVisible();
      await page.waitForTimeout(420); await page.screenshot({ path: path.join(out, `place-detail-${width}.png`) });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Horizontal overflow ${width}`);
      await page.getByLabel('Kaydet', { exact: true }).click();
      await expect(page.getByLabel('Kayıttan kaldır')).toBeVisible();
      await page.getByLabel('Kayıttan kaldır').click();
      await page.getByLabel('Kapat', { exact: true }).last().click();
      await expect(page.getByText('Şehit Mahmut Kavak Parkı')).toHaveCount(0);
    }
    if(errors.length) throw new Error(errors.join('\n'));
    console.log('PASS browser-rendered components: selection, collapse, nearby/coordinate publish, submitting lock, value selection, branch search, save, close, responsive detail. Native map/media/iOS gestures require physical retest.');
  } finally { await browser.close(); server.close(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
