const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const { buildPreview, servePreview } = require('./ui-build.cjs');
async function main() {
  const out = path.resolve('.tmp/product-ui');
  await buildPreview(out);
  const server = await servePreview(out);
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
    // Shared design-system components (BlinkrButton/Chip/BottomBar/...).
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url + '?scene=kit');
    await expect(page.getByRole('tab')).toHaveCount(3);
    await expect(page.getByLabel('Sohbet, okunmamış mesaj var')).toBeVisible();
    await page.getByLabel('Sinyal bırak', { exact: true }).click();
    await expect(page.getByLabel('Tap count')).toHaveText('1');
    await page.getByLabel('Kamerayla sinyal paylaş').click();
    await expect(page.getByLabel('Tap count')).toHaveText('11');
    await expect(page.getByRole('button', { name: 'Kapalı' })).toBeDisabled();
    await page.screenshot({ path: path.join(out, 'kit.png') });

    // Map chrome: four layers, exactly one selected, tab bar present, scan + locate reachable.
    await page.goto(url + '?scene=map');
    await expect(page.getByRole('tab')).toHaveCount(3 + 4);
    await expect(page.getByLabel('Bu alanı tara')).toBeVisible();
    await expect(page.getByLabel('Konumuma git')).toBeVisible();
    await page.getByRole('tab', { name: 'Canlı', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Canlı', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Tümü', exact: true })).toHaveAttribute('aria-selected', 'false');
    await page.screenshot({ path: path.join(out, 'map-chrome.png') });

    // Profile: real saved places (per user), no invented counters or badges.
    await page.goto(url + '?scene=profile');
    await expect(page.getByText('Kaydettiğin yerler')).toBeVisible();
    await expect(page.getByLabel(/haritada aç/)).toHaveCount(3);
    await expect(page.getByText('Kaydedilen', { exact: true })).toBeVisible();
    await expect(page.getByText(/rozet|puan|yorum/i)).toHaveCount(0);
    await page.screenshot({ path: path.join(out, 'profile.png') });

    // Detail sheet: real facts only (signal count, freshness, confidence, distance) and working secondary actions.
    await page.goto(url + '?scene=detail');
    await expect(page.getByText('Örnek Lokanta')).toBeVisible();
    await expect(page.getByLabel('Yol tarifi')).toBeVisible();
    await expect(page.getByLabel('Paylaş')).toBeVisible();
    await expect(page.getByText('+2')).toBeVisible();
    await expect(page.getByText(/4\.6|şu anda burada|kaydetme/i)).toHaveCount(0);
    await page.screenshot({ path: path.join(out, 'detail.png') });
    if(errors.length) throw new Error(errors.join('\n'));
    console.log('PASS browser-rendered components: selection, collapse, nearby/coordinate publish, submitting lock, value selection, branch search, save, close, responsive detail. Native map/media/iOS gestures require physical retest.');
  } finally { await browser.close(); server.close(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
