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
    await page.getByText('Sinyal bırak', { exact: true }).click();
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
    await page.getByRole('button', { name: 'Sinyal bırak', exact: true }).click();
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
    await expect(page.getByRole('tab')).toHaveCount(4);
    await expect(page.getByLabel('Sohbet, okunmamış mesaj var')).toBeVisible();
    await page.getByLabel('Sinyal bırak', { exact: true }).click();
    await expect(page.getByLabel('Tap count')).toHaveText('1');
    await page.getByLabel('Kamerayla sinyal paylaş').click();
    await expect(page.getByLabel('Tap count')).toHaveText('11');
    await expect(page.getByRole('button', { name: 'Kapalı' })).toBeDisabled();
    await page.screenshot({ path: path.join(out, 'kit.png') });

    // Map chrome: four layers, exactly one selected, tab bar present, scan + locate reachable.
    await page.goto(url + '?scene=map');
    await expect(page.getByRole('tab')).toHaveCount(4 + 4);
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
    // Own posts: the real total (Turkish thousands separator), newest first, paged as the list scrolls.
    await expect(page.getByLabel('20.030 sinyal')).toBeVisible();
    await expect(page.getByText('Sinyal başlığı 20030')).toBeVisible();
    await expect(page.getByText('Anonim').first()).toBeVisible();
    // 50 rows per page: rows only appear after scrolling loads the next pages (the list is virtualised).
    const lowestRow = async () => (await page.getByText(/^Sinyal başlığı \d+$/).allTextContents()).map((v) => Number(v.replace(/\D/g, ''))).reduce((a, b) => Math.min(a, b), Infinity);
    const firstScreenLowest = await lowestRow();
    if (firstScreenLowest < 19981) throw new Error('rows beyond the first page were loaded before scrolling: ' + firstScreenLowest);
    await page.mouse.move(195, 500);
    for (let i = 0; i < 10; i += 1) { await page.mouse.wheel(0, 1800); await page.waitForTimeout(150); }
    const afterScrollLowest = await lowestRow();
    if (!(afterScrollLowest < 19981)) throw new Error('scrolling did not load the next page: ' + afterScrollLowest);
    await page.screenshot({ path: path.join(out, 'profile.png') });
    await page.goto(url + '?scene=profile&noposts');
    await expect(page.getByText('Henüz sinyal paylaşmadın')).toBeVisible();
    await expect(page.getByRole('button', { name: 'İlk sinyalini bırak' })).toBeVisible();
    await page.goto(url + '?scene=profile&postsfail');
    await expect(page.getByText('Sinyallerin yüklenemedi. Tekrar dene.')).toBeVisible();
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    await page.goto(url + '?scene=profile&fewposts');
    await expect(page.getByText('Hepsi bu kadar')).toBeVisible();

    // Chat list: names, real unread badge, "Sen:" prefix for own last message; empty and failing states.
    await page.goto(url + '?scene=chat');
    await expect(page.getByLabel(/zeynep ile konuşma, 3 okunmamış mesaj/)).toBeVisible();
    await expect(page.getByLabel('arda ile konuşmayı aç')).toBeVisible();
    await expect(page.getByText('Sen: Buraya geldin mi?')).toBeVisible();
    await expect(page.getByText('3 konuşma')).toBeVisible();
    await expect(page.getByLabel('Sohbet, okunmamış mesaj var')).toBeVisible();
    await page.screenshot({ path: path.join(out, 'chat.png') });
    await page.goto(url + '?scene=chat&empty');
    await expect(page.getByText('Henüz mesajın yok')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Yeni mesaj' })).toHaveCount(2);
    await page.goto(url + '?scene=chat&failing');
    await expect(page.getByText('Sohbetler açılamadı')).toBeVisible();
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    await page.getByRole('button', { name: 'Tekrar dene' }).click();
    await expect(page.getByText('Sohbetler açılamadı')).toBeVisible();

    // Yakında: fresh, close, capped list of what is happening around the device; five-item bottom bar.
    await page.goto(url + '?scene=nearby');
    await expect(page.getByRole('heading', { name: 'Yakında' })).toBeVisible();
    await expect(page.getByLabel(/Kent Meydanı, .*Haritada aç/)).toBeVisible();
    await expect(page.getByText(/5 taze sinyal/)).toBeVisible();
    const rowLabels = await page.getByLabel(/Haritada aç/).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label').split(',')[0]));
    // Freshest bucket (< 15 min) by distance, then the older bucket by distance.
    if (rowLabels.join('|') !== 'Kent Meydanı|Yol çalışması|Masal Parkı|Yıldırım Beyazıt Kafe|Merkez Eczanesi') throw new Error('Yakında order wrong: ' + rowLabels.join('|'));
    await expect(page.getByText('Çok uzak yer')).toHaveCount(0);
    await expect(page.getByText('Sessiz Market')).toHaveCount(0);
    await expect(page.getByText('Eski gözlem')).toHaveCount(0);
    await expect(page.getByRole('tab')).toHaveCount(4);
    await expect(page.getByRole('tab', { name: 'Yakında' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Harita' })).toHaveAttribute('aria-selected', 'false');
    await page.waitForTimeout(420); await page.screenshot({ path: path.join(out, 'nearby.png') });
    await page.getByRole('button', { name: /Tümü, 5 sonuç/ }).waitFor();
    await page.getByRole('button', { name: /Bekleme, 2 sonuç/ }).click();
    await expect(page.getByLabel(/Haritada aç/)).toHaveCount(2);
    await page.getByRole('button', { name: /Canlı, 4 sonuç/ }).click();
    await expect(page.getByLabel(/Haritada aç/)).toHaveCount(4);
    await page.getByRole('button', { name: /Tümü, 5 sonuç/ }).click();
    await page.getByLabel(/Kent Meydanı, .*Haritada aç/).click();
    await expect(page.getByLabel('opened')).toHaveText('place:p1');
    await page.getByLabel(/Yol çalışması, .*Haritada aç/).click();
    await expect(page.getByLabel('opened')).toHaveText('signal:s1');
    await page.goto(url + '?scene=nearby&nearbyempty');
    await expect(page.getByText('Çevrende taze sinyal yok')).toBeVisible();
    await page.getByRole('button', { name: 'Sinyal paylaş', exact: true }).click();
    await expect(page.getByLabel('opened')).toHaveText('camera');
    await page.goto(url + '?scene=nearby&nearbyfail');
    await expect(page.getByText('Yakındakiler açılamadı')).toBeVisible();
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    await page.goto(url + '?scene=nearby&needperm');
    await expect(page.getByText('Yakındakileri görmek için konum gerekli')).toBeVisible();
    await expect(page.getByLabel(/Kent Meydanı, .*Haritada aç/)).toHaveCount(0);
    await page.screenshot({ path: path.join(out, 'nearby-permission.png') });
    await page.getByRole('button', { name: 'Konumu kullan' }).click();
    await expect(page.getByLabel(/Kent Meydanı, .*Haritada aç/)).toBeVisible();
    await page.goto(url + '?scene=nearby&blockedperm');
    await expect(page.getByRole('button', { name: 'Ayarları aç' })).toBeVisible();

    // Conversation: newest message at the bottom, send clears the draft, a failed send keeps it and shows a plain message.
    await page.goto(url + '?scene=conversation');
    const first = await page.getByText('Selam', { exact: true }).boundingBox();
    const last = await page.getByText('Tamam, geliyorum.').boundingBox();
    if (!first || !last || last.y <= first.y) throw new Error('Newest chat message is not below the oldest one');
    await page.getByLabel('Mesaj yaz').fill('Deneme mesajı');
    await page.getByRole('button', { name: 'Gönder' }).click();
    await expect(page.getByText('Deneme mesajı')).toBeVisible();
    await expect(page.getByLabel('Mesaj yaz')).toHaveValue('');
    await page.screenshot({ path: path.join(out, 'conversation.png') });
    await page.goto(url + '?scene=conversation&sendfail');
    await page.getByLabel('Mesaj yaz').fill('Gitmeyecek');
    await page.getByRole('button', { name: 'Gönder' }).click();
    await expect(page.getByText('Mesaj gönderilemedi. Tekrar dene.')).toBeVisible();
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    await expect(page.getByLabel('Mesaj yaz')).toHaveValue('Gitmeyecek');
    await page.goto(url + '?scene=conversation&emptychat');
    await expect(page.getByText('Henüz mesaj yok')).toBeVisible();

    // User search opens with a hint, finds people by name and never lists yourself.
    await page.goto(url + '?scene=search');
    await expect(page.getByText(/en az 2 harf/)).toBeVisible();
    await page.getByLabel('Kullanıcı adı').fill('zey');
    await expect(page.getByLabel('zeynep ile mesajlaş')).toBeVisible();
    await page.getByLabel('Kullanıcı adı').fill('yok-boyle-biri');
    await expect(page.getByText('Bu isimde bir kullanıcı bulunamadı.')).toBeVisible();

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
