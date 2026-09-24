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
    const errors=[]; page.on('pageerror', error => errors.push(page.url().replace(/^.*?/, '?') + ' ' + error.message));
    const url=`http://127.0.0.1:${server.address().port}`;
    await page.goto(url);
    // plan-devam D6/D8: one page - place, type + level, one description (no title), identity, send targets, Gönder.
    await expect(page.getByRole('heading', { name: 'Yeni sinyal' })).toBeVisible();
    await expect(page.getByPlaceholder(/Bekleme süresi/)).toHaveCount(0);
    await page.waitForTimeout(420); await page.screenshot({ path: path.join(out, 'composer-page.png') });
    await page.getByLabel('Şehit Mahmut Kavak Parkı yerini seç').click();
    await expect(page.getByText(/Yakındaki yer paylaşımı/)).toBeVisible();
    await expect(page.getByText('Hz. Ali Camii')).toHaveCount(0);
    await page.getByRole('button', { name: 'Doluluk', exact: true }).click();
    await page.getByRole('button', { name: 'Sakin', exact: true }).click();
    await page.getByLabel('Açıklama', { exact: true }).fill('Park bu akşam sakin');
    await expect(page.getByTestId('ttl-info')).toHaveText('Haritada 1 sa kalır');
    await expect(page.getByTestId('target-story')).toHaveAttribute('aria-disabled', 'true');
    await page.waitForTimeout(420); await page.screenshot({ path: path.join(out, 'composer-filled.png') });
    await page.getByRole('button', { name: 'Gönder', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Gönderiliyor' })).toBeDisabled();
    await expect(page.getByLabel('Published result')).toHaveText('park:Crowd:Calm');
    await expect(page.getByLabel('Publication count')).toHaveText('1');
    await page.goto(url);
    // The place chooser lives behind "Yer seç"; "Bu konumda paylaş" keeps a coordinate signal. Three taps to share.
    await page.getByRole('button', { name: 'Yer seç', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nerede oluyor?' })).toBeVisible();
    await page.getByLabel('Bu konumda paylaş', { exact: true }).click();
    await page.getByRole('button', { name: 'Doluluk', exact: true }).click();
    await page.getByRole('button', { name: 'Sakin', exact: true }).click();
    await page.getByRole('button', { name: 'Gönder', exact: true }).click();
    await expect(page.getByLabel('Published result')).toHaveText('coordinate:Crowd:Calm');
    await expect(page.getByLabel('Publication count')).toHaveText('1');
    await page.goto(url+'?error');
    await expect(page.getByText('Şu anda bağlantı kurulamıyor. Lütfen tekrar dene.')).toBeVisible();
    await expect(page.getByText('Network request timed out')).toHaveCount(0);
    await page.goto(url);
    await page.getByLabel('Kapat', { exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Yeni sinyal' })).toHaveCount(0);
    await page.getByLabel('Yeniden aç').click();
    await page.getByRole('button', { name: 'Yer seç', exact: true }).click();
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
    // 4 bottom-bar tabs + the P1.5 SegmentedControl's 2 segments (also role "tab").
    await expect(page.getByRole('tab')).toHaveCount(6);
    await expect(page.getByLabel('Sohbet, okunmamış mesaj var')).toBeVisible();
    await page.getByLabel('Sinyal bırak', { exact: true }).click();
    await expect(page.getByLabel('Tap count')).toHaveText('1');
    await page.getByLabel('Yeni sinyal paylaş').click();
    await expect(page.getByLabel('Tap count')).toHaveText('11');
    // P5.1: a long press on (+) asks for the text-only composer instead of the camera.
    await page.getByLabel('Yeni sinyal paylaş').click({ delay: 700 });
    await expect(page.getByLabel('Tap count')).toHaveText('111');
    await expect(page.getByRole('button', { name: 'Kapalı' })).toBeDisabled();
    // P1.5: FreshnessRing, TypeBadge, LevelMeter, Toast.
    await expect(page.getByLabel('freshness-ring-row').locator('svg')).toHaveCount(6);
    await expect(page.getByText('Bekleme · 5-15 dk')).toBeVisible();
    await expect(page.getByText('Geçici durum · Kapalı')).toBeVisible();
    await expect(page.getByLabel('Doluluk seviyesi: kalabalık')).toBeVisible();
    await expect(page.getByText('Şişli\'de İğneada Çığlığı')).toBeVisible();
    // P1.5 continued: IconButton, SegmentedControl (sliding highlight, role "tab"), ErrorState.
    await expect(page.getByLabel('Kapat')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Yakınımda' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Takip' }).click();
    await expect(page.getByRole('tab', { name: 'Takip' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Yakınımda' })).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByText('Sinyaller yüklenemedi. Bağlantını kontrol edip tekrar dene.')).toBeVisible();
    await expect(page.getByText('Paylaşıldı', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Toast göster' }).click();
    await expect(page.getByText('Paylaşıldı', { exact: true })).toBeVisible();
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
    // Faz 6: Sinyal / Takipçi / Takip counts; the e-mail is only in Settings; a waiting follow request has its own entry.
    await expect(page.getByText('Takipçi', { exact: true })).toBeVisible();
    await expect(page.getByText('Takip', { exact: true })).toBeVisible();
    await expect(page.getByText('alper@example.test')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Takip istekleri · 1' })).toBeVisible();
    await expect(page.getByText(/rozet|puan|yorum/i)).toHaveCount(0);
    // Own posts: the real total (Turkish thousands separator), newest first, paged as the list scrolls.
    await expect(page.getByLabel('20.030 sinyal')).toBeVisible();
    // P6.3: the grid is the default view (square tiles, dimmed when expired); the list view keeps the details.
    await expect(page.getByTestId(/^grid-tile-/).first()).toBeVisible();
    // V2-6: a video tile shows its thumbnail and a play marker; photos do not.
    await expect(page.getByTestId('grid-video-post-20028')).toBeVisible();
    await expect(page.getByTestId('grid-video-post-20030')).toHaveCount(0);
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'profile-grid.png') });
    await page.getByRole('tab', { name: 'Liste' }).click();
    await expect(page.getByText('Sinyal başlığı 20030')).toBeVisible();
    await expect(page.getByText('Anonim').first()).toBeVisible();
    // 50 rows per page: rows only appear after scrolling loads the next pages (the list is virtualised).
    const lowestRow = async () => (await page.getByText(/^Sinyal başlığı \d+/).allTextContents()).map((v) => Number(v.match(/\d+/)[0])).reduce((a, b) => Math.min(a, b), Infinity);
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
    // Snapchat-style rows: a waiting snap is "Yeni Snap" and opens the viewer; text shows its preview or "Yeni sohbet".
    await expect(page.getByLabel(/^zeynep, Yeni Snap, .* önce\. Snapı aç$/)).toBeVisible();
    await expect(page.getByLabel(/^arda, Buraya geldin mi\?, .* önce\. Sohbeti aç$/)).toBeVisible();
    await expect(page.getByLabel(/^melis, Açıldı, .* önce\. Sohbeti aç$/)).toBeVisible();
    await expect(page.getByLabel(/^ece, Yeni sohbet, .* önce\. Sohbeti aç$/)).toBeVisible();
    await expect(page.getByLabel(/^can, Süresi doldu, .* önce\. Sohbeti aç$/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sohbetler' })).toBeVisible();
    await expect(page.getByLabel('zeynep kişisine Snap gönder')).toBeVisible();
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

    // Snap viewer: opens from the row, shows the caption, closes on tap, and the row becomes "Açıldı" (view once).
    await page.goto(url + '?scene=chat');
    await page.getByLabel(/^zeynep, Yeni Snap/).click();
    await expect(page.getByLabel('Snap yazısı: Burası çok kalabalık')).toBeVisible();
    await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, 'snap-viewer.png') });
    await page.getByRole('button', { name: 'Snapı kapat' }).click();
    await expect(page.getByLabel('Snap yazısı: Burası çok kalabalık')).toHaveCount(0);
    await expect(page.getByLabel(/^zeynep, Açıldı, .* önce\. Sohbeti aç$/)).toBeVisible();
    await page.goto(url + '?scene=chat');
    await page.getByLabel(/^zeynep, Yeni Snap/).click();
    await expect(page.getByLabel('Snap yazısı: Burası çok kalabalık')).toBeVisible();
    await expect(page.getByLabel('Snap yazısı: Burası çok kalabalık')).toHaveCount(0, { timeout: 7000 });
    await page.goto(url + '?scene=chat&snapgone');
    await page.getByLabel(/^zeynep, Yeni Snap/).click();
    await expect(page.getByText('Bu Snap zaten açıldı.')).toBeVisible();
    await page.getByRole('button', { name: 'Kapat', exact: true }).last().click();
    await expect(page.getByText('Bu Snap zaten açıldı.')).toHaveCount(0);

    // Snap sending: camera -> editor -> caption/timer -> send to the person; failures keep the caption.
    await page.goto(url + '?scene=chat');
    await page.getByLabel('arda kişisine Snap gönder').click();
    await page.getByRole('button', { name: 'Fotoğraf çek' }).click();
    await expect(page.getByRole('heading', { name: 'Efekt ve çıkartma' })).toBeVisible();
    await page.getByRole('button', { name: 'İleri' }).click();
    await expect(page.getByRole('heading', { name: 'Snap gönder' })).toBeVisible();
    await expect(page.getByText('Kime?')).toHaveCount(0);
    await page.getByLabel('Snap yazısı').fill('Selam');
    await page.getByRole('button', { name: /^Süre 5 sn/ }).click();
    await expect(page.getByRole('button', { name: /^Süre 10 sn/ })).toBeVisible();
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'snap-send.png') });
    await page.getByRole('button', { name: 'Gönder · arda' }).click();
    await expect(page.getByText('Snap gönderildi')).toBeVisible();
    const sentOne = await page.evaluate(() => JSON.stringify(window.__sentSnaps));
    if (sentOne !== JSON.stringify([{ conversationId: 'c2', durationSeconds: 10, caption: 'Selam' }])) throw new Error('Unexpected snap payload: ' + sentOne);
    await page.goto(url + '?scene=chat&sendsnapfail');
    await page.getByLabel('arda kişisine Snap gönder').click();
    await page.getByRole('button', { name: 'Fotoğraf çek' }).click();
    await page.getByRole('button', { name: 'İleri' }).click();
    await page.getByLabel('Snap yazısı').fill('Kalsın');
    await page.getByRole('button', { name: 'Gönder · arda' }).click();
    await expect(page.getByText('Snap gönderilemedi. Tekrar dene.')).toBeVisible();
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    await expect(page.getByLabel('Snap yazısı')).toHaveValue('Kalsın');

    // Snap to several people from the share hub's flow: pick recipients, one send per person.
    await page.goto(url + '?scene=chat&compose');
    await page.getByRole('button', { name: 'Fotoğraf çek' }).click();
    await page.getByRole('button', { name: 'İleri' }).click();
    await expect(page.getByText('Kime?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kişi seç' })).toBeDisabled();
    await page.getByRole('checkbox', { name: 'zeynep' }).click();
    await page.getByRole('checkbox', { name: 'ece' }).click();
    await expect(page.getByRole('checkbox', { name: 'zeynep, seçili' })).toBeVisible();
    await page.getByRole('button', { name: 'Gönder · 2 kişi' }).click();
    await expect(page.getByText('Snap 2 kişiye gönderildi')).toBeVisible();
    const sentTwo = await page.evaluate(() => JSON.stringify(window.__sentSnaps.map((item) => item.conversationId)));
    if (sentTwo !== JSON.stringify(['c1', 'c4'])) throw new Error('Unexpected recipients: ' + sentTwo);

    // Inside a conversation: snap rows are Snapchat-style lines; a waiting one opens the viewer, my own cannot be opened.
    await page.goto(url + '?scene=chat');
    await page.getByLabel(/^arda, Buraya geldin mi\?/).click();
    await expect(page.getByLabel('Snap, Görmek için dokun')).toBeVisible();
    await expect(page.getByLabel('Video, Açıldı')).toBeVisible();
    await expect(page.getByLabel('arda kişisine Snap gönder').first()).toBeVisible();
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'conversation-snapchat.png') });
    await page.getByLabel('Snap, Görmek için dokun').click();
    await expect(page.getByLabel('Snap yazısı: Burası çok kalabalık')).toBeVisible();
    await page.getByRole('button', { name: 'Snapı kapat' }).click();
    // Answering "Hâlâ böyle mi?": the composer opens on the last step with the current signal already chosen.
    await page.goto(url + '?prefill');
    await expect(page.getByRole('button', { name: 'Doluluk', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Kalabalık', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Gönder', exact: true }).click();
    await expect(page.getByLabel('Published result')).toHaveText(/:Crowd:Busy$/);

    // In-app camera: lenses, mode switch, edit stage with lens + stickers, untouched photos are passed on as they are.
    await page.goto(url + '?scene=camera');
    await expect(page.getByLabel('Kamera önizlemesi')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fotoğraf çek' })).toBeEnabled();
    // plan-devam D4: no row of lens circles - swipe, or the small arrows around the lens name.
    await expect(page.getByTestId('lens-current')).toHaveText('Normal');
    for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: 'Sonraki efekt' }).click();
    await expect(page.getByTestId('lens-current')).toHaveText('Neon');
    await page.getByRole('button', { name: 'Flaş kapalı' }).click();
    await expect(page.getByRole('button', { name: 'Flaş açık' })).toBeVisible();
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'camera.png') });
    await page.getByRole('button', { name: 'Video modu' }).click();
    await expect(page.getByText('Video, seçtiğin efekt olmadan kaydedilir.')).toBeVisible();
    await expect(page.getByTestId('lens-current')).toHaveCount(0);
    await page.getByRole('button', { name: 'Fotoğraf modu' }).click();
    await page.getByRole('button', { name: 'Fotoğraf çek' }).click();
    await expect(page.getByRole('heading', { name: 'Efekt ve çıkartma' })).toBeVisible();
    await page.getByRole('button', { name: 'Kalabalık çıkartması ekle' }).click();
    await expect(page.getByLabel('Kalabalık çıkartması', { exact: true })).toBeVisible();
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'camera-editor.png') });
    await page.getByRole('button', { name: 'Kalabalık çıkartmasını kaldır' }).click();
    await expect(page.getByLabel('Kalabalık çıkartması', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Kullan' }).click();
    await expect(page.getByLabel('captured')).toHaveText('image:image/jpeg:rendered');
    // P5.5: a type sticker preselects the signal type; an emoji sticker has no text; a sticker dropped on the bin is gone.
    await page.goto(url + '?scene=camera');
    await page.getByRole('button', { name: 'Fotoğraf çek' }).click();
    await page.getByRole('button', { name: '🔥 çıkartması ekle' }).click();
    await expect(page.getByLabel('🔥 çıkartması', { exact: true })).toBeVisible();
    const fire = await page.getByLabel('🔥 çıkartması', { exact: true }).boundingBox();
    const photoBox = await page.getByLabel('Çekilen fotoğraf').boundingBox();
    await page.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2); await page.mouse.down();
    await page.mouse.move(fire.x + 20, fire.y + 40, { steps: 4 });
    await expect(page.getByTestId('sticker-trash')).toBeVisible();
    await page.mouse.move(photoBox.x + photoBox.width / 2, photoBox.y + photoBox.height - 40, { steps: 10 }); await page.mouse.up();
    await expect(page.getByLabel('🔥 çıkartması', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Kapalı çıkartması ekle' }).click();
    // P5.6 text tool: write, switch style and colour, the text lands on the picture.
    await page.getByRole('button', { name: 'Yazı ekle' }).click();
    await page.getByLabel('Fotoğrafa yazı').fill('Kapı açık');
    await page.getByRole('button', { name: 'Yazı stili: Zeminli' }).click();
    await expect(page.getByRole('button', { name: 'Yazı stili: Vurgulu' })).toBeVisible();
    await page.getByRole('button', { name: 'Renk #FFC845' }).click();
    await page.getByRole('button', { name: 'Yazıyı ekle' }).click();
    await expect(page.getByLabel('Kapı açık çıkartması', { exact: true })).toBeVisible();
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'camera-text.png') });
    await page.getByRole('button', { name: 'Kullan' }).click();
    await expect(page.getByLabel('captured')).toHaveText('image:image/jpeg:rendered:TemporaryStatus');
    await page.goto(url + '?scene=camera');
    await page.getByRole('button', { name: 'Fotoğraf çek' }).click();
    await expect(page.getByTestId('lens-current')).toHaveText('Normal');
    await page.getByRole('button', { name: 'Kullan' }).click();
    await expect(page.getByLabel('captured')).toHaveText('image:image/jpeg:original');
    await page.goto(url + '?scene=camera');
    await page.getByRole('button', { name: 'Video modu' }).click();
    await page.getByRole('button', { name: 'Kaydı başlat' }).click();
    await expect(page.getByRole('button', { name: 'Kaydı durdur' })).toBeVisible();
    await page.getByRole('button', { name: 'Kaydı durdur' }).click();
    await expect(page.getByLabel('captured')).toHaveText('video:video/mp4:original');
    // D3/D11: the nearest place on the preview, "Konum belirsiz" for a loose fix, a school's no-media notice.
    await page.goto(url + '?scene=camera&place');
    await expect(page.getByTestId('camera-place')).toContainText('BİM');
    await expect(page.getByTestId('camera-sensitive')).toHaveCount(0);
    await page.goto(url + '?scene=camera&loose');
    await expect(page.getByTestId('camera-place')).toContainText('Konum belirsiz');
    await page.goto(url + '?scene=camera&school');
    await expect(page.getByTestId('camera-sensitive')).toContainText('Bu yerde fotoğraf ve video kapalı');
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'camera-school.png') });
    await page.getByRole('button', { name: 'Yazılı sinyal', exact: true }).click();
    await expect(page.getByLabel('captured')).toHaveText('text');
    await page.goto(url + '?scene=camera&school');
    await page.getByRole('button', { name: 'Anladım' }).click();
    await expect(page.getByTestId('camera-sensitive')).toHaveCount(0);
    // P5.4: a horizontal swipe over the preview changes the lens and shows its name.
    await page.goto(url + '?scene=camera');
    await expect(page.getByRole('button', { name: 'Fotoğraf çek' })).toBeEnabled();
    await page.mouse.move(300, 400); await page.mouse.down(); await page.mouse.move(250, 402, { steps: 5 }); await page.mouse.move(120, 405, { steps: 8 }); await page.mouse.up();
    await expect(page.getByTestId('lens-name')).toHaveText('Gün batımı');
    await expect(page.getByTestId('lens-current')).toHaveText('Gün batımı');
    await expect(page.getByTestId('lens-name')).toHaveCount(0, { timeout: 3000 });
    // P5.2: holding the shutter records a clip (ring fills toward 15 s); releasing stops and hands it on.
    await page.goto(url + '?scene=camera');
    await expect(page.getByRole('button', { name: 'Fotoğraf çek' })).toBeEnabled();
    await page.getByTestId('shutter').hover();
    await page.mouse.down();
    await expect(page.getByLabel(/^kayıt ilerlemesi/)).toBeVisible();
    await page.waitForTimeout(600);
    await page.mouse.up();
    await expect(page.getByLabel('captured')).toHaveText('video:video/mp4:original');
    // "Aa" leaves the camera for a text-only signal.
    await page.goto(url + '?scene=camera');
    await page.getByRole('button', { name: 'Sadece yazılı sinyal' }).click();
    await expect(page.getByLabel('captured')).toHaveText('text');
    await page.goto(url + '?scene=camera&nocamperm');
    await expect(page.getByText('Kamera izni gerekiyor')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kameraya izin ver' })).toBeVisible();
    await page.getByRole('button', { name: 'Kamerayı kapat' }).click();
    await expect(page.getByLabel('captured')).toHaveText('closed');
    // Avatars: profile shows the default character, the picker changes colour/face/accessory and saves a catalogue key.
    await page.goto(url + '?scene=profile');
    await expect(page.getByLabel('avatar-key')).toHaveText('default');
    await page.getByRole('button', { name: 'Avatarı değiştir' }).click();
    await expect(page.getByRole('heading', { name: 'Avatarını seç' })).toBeVisible();
    await page.getByRole('button', { name: 'Mor renk' }).click();
    await expect(page.getByRole('button', { name: 'Mor renk' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Şaşkın yüz' }).click();
    await page.getByRole('button', { name: 'Gözlük aksesuar' }).click();
    await page.waitForTimeout(700); await page.screenshot({ path: path.join(out, 'avatar-picker.png') });
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.getByLabel('avatar-key')).toHaveText('421');
    await expect(page.getByRole('heading', { name: 'Avatarını seç' })).toHaveCount(0);
    await page.goto(url + '?scene=profile&avatarfail');
    await page.getByRole('button', { name: 'Avatarı değiştir' }).click();
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.getByText('Avatar kaydedilemedi. Tekrar dene.')).toBeVisible();
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Avatarını seç' })).toBeVisible();
    // Map search "Nereye gidiyorsun?": categories, ranking, live badge, recents, address fallback, empty/error states.
    await page.goto(url + '?scene=map');
    await expect(page.getByRole('search', { name: /Yer ara/ })).toBeVisible();
    await page.goto(url + '?scene=mapSearch');
    await expect(page.getByLabel('Yer ara', { exact: true })).toBeFocused();
    await expect(page.getByText('Yakınında ara')).toBeVisible();
    await expect(page.getByText('Son aramalar')).toHaveCount(0);
    await page.getByRole('button', { name: 'Eczane', exact: true }).click();
    await expect(page.getByLabel(/Kent Eczanesi, .*Haritada göster/)).toBeVisible();
    const pharmacyOrder = await page.getByLabel(/Haritada göster/).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label').split(',')[0]));
    if (pharmacyOrder.join('|') !== 'Kent Eczanesi|Şifa Eczanesi') throw new Error('Category results not nearest first: ' + pharmacyOrder.join('|'));
    await page.getByLabel('Yer ara', { exact: true }).fill('a');
    await expect(page.getByText('Aramak için en az 2 harf yaz.')).toBeVisible();
    await page.getByLabel('Yer ara', { exact: true }).fill('kent');
    await expect(page.getByLabel(/Kent Meydanı, .*Haritada göster/)).toBeVisible();
    const kentOrder = await page.getByLabel(/Haritada göster/).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label').split(',')[0]));
    // Name matches first (prefix, nearest first), a mid-word match last.
    if (kentOrder.join('|') !== 'Kent Meydanı|Kent Eczanesi|Şehirkent Market') throw new Error('Name ranking wrong: ' + kentOrder.join('|'));
    await expect(page.getByText('Canlı', { exact: true })).toHaveCount(1);
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'map-search.png') });
    await page.getByLabel(/Kent Meydanı, .*Haritada göster/).click();
    await expect(page.getByLabel('chosen')).toHaveText('place:kent');
    await page.goto(url + '?scene=mapSearch');
    await expect(page.getByText('Son aramalar')).toBeVisible();
    await page.getByLabel(/Kent Meydanı, son arama/).click();
    await expect(page.getByLabel('chosen')).toHaveText('place:kent');
    await page.goto(url + '?scene=mapSearch');
    await page.getByRole('button', { name: 'Son aramaları temizle' }).click();
    await expect(page.getByText('Son aramalar')).toHaveCount(0);
    await page.getByRole('button', { name: 'Aramayı kapat' }).click();
    await expect(page.getByLabel('chosen')).toHaveText('closed');
    // Results are sectioned by distance from the person: near first, other cities last.
    await page.goto(url + '?scene=mapSearch&farsearch');
    await page.getByLabel('Yer ara', { exact: true }).fill('soulmate');
    await expect(page.getByText('Diğer şehirler', { exact: true })).toBeVisible();
    await expect(page.getByText('Yakınında', { exact: true })).toBeVisible();
    const soulOrder = await page.getByLabel(/Haritada göster/).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label').split(',')[0]));
    if (soulOrder.join('|') !== 'Soulmate Cafe|Soulmate Coffee') throw new Error('Far result outranked the near one: ' + soulOrder.join('|'));
    await page.goto(url + '?scene=mapSearch&emptysearch');
    await page.getByLabel('Yer ara', { exact: true }).fill('zzzz');
    await expect(page.getByText('Sonuç bulunamadı')).toBeVisible();
    await page.goto(url + '?scene=mapSearch&searchfail');
    await page.getByLabel('Yer ara', { exact: true }).fill('kent');
    await expect(page.getByText('Arama açılamadı')).toBeVisible();
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    await page.goto(url + '?scene=mapSearch&emptysearch&geocode');
    await page.getByLabel('Yer ara', { exact: true }).fill('kadirli');
    await expect(page.getByLabel('kadirli konumuna git')).toBeVisible();
    await page.getByLabel('kadirli konumuna git').click();
    await expect(page.getByLabel('chosen')).toHaveText('location:kadirli');
    // Kişiler tab (P3.13): friends shortcut, a real search, selecting a person.
    await page.goto(url + '?scene=mapSearch');
    await page.getByRole('tab', { name: 'Kişiler' }).click();
    await expect(page.getByText('Arkadaşların')).toBeVisible();
    await expect(page.getByLabel('zeynep profilini aç')).toBeVisible();
    await expect(page.getByLabel('ece profilini aç')).toBeVisible();
    await page.getByLabel('Kullanıcı ara').fill('a');
    await expect(page.getByText('Aramak için en az 2 harf yaz.')).toBeVisible();
    await page.getByLabel('Kullanıcı ara').fill('arda');
    await expect(page.getByLabel('arda profilini aç')).toBeVisible();
    await page.getByLabel('arda profilini aç').click();
    await expect(page.getByLabel('chosen')).toHaveText('person:arda');
    await page.goto(url + '?scene=mapSearch');
    await page.getByRole('tab', { name: 'Kişiler' }).click();
    await page.getByLabel('Kullanıcı ara').fill('zzzz');
    await expect(page.getByText('Kullanıcı bulunamadı')).toBeVisible();
    // Switching back to Yerler keeps the place-search behaviour untouched (the query box is shared,
    // so it is cleared first - each tab searches its own thing, not a stale query from the other).
    await page.getByLabel('Kullanıcı ara').fill('');
    await page.getByRole('tab', { name: 'Yerler' }).click();
    await expect(page.getByText('Yakınında ara')).toBeVisible();
    // Friends: profile numbers, requests, adding people, a person's public profile, bio editing and honest empty/error states.
    await page.goto(url + '?scene=profile');
    await expect(page.getByText('Kahve ve yürüyüş.')).toBeVisible();
    // Own follower list: people who follow me, with their follow-back state; a follower can be removed after a confirm.
    await page.getByRole('button', { name: '2 Takipçi' }).click();
    await expect(page.getByRole('tab', { name: 'Takipçiler' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'İstekler' })).toBeVisible();
    await page.getByRole('button', { name: 'can: Çıkar' }).click();
    await expect(page.getByText(/Takipçilerinden çıkarılsın mı/)).toBeVisible();
    await page.getByRole('button', { name: 'Çıkar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'can: Çıkar' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'İstekler' }).click();
    await page.getByRole('button', { name: 'Onayla' }).click();
    await expect(page.getByText('Bekleyen takip isteği yok')).toBeVisible();
    await page.getByRole('button', { name: 'Kapat' }).last().click();
    await expect(page.getByRole('button', { name: 'Arkadaşlar, 1 yeni istek' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Profil, bekleyen arkadaş isteği var/ }).or(page.getByRole('tab', { name: 'Profil' }))).toHaveCount(1);
    await page.getByRole('button', { name: 'Arkadaşlar, 1 yeni istek' }).click();
    await expect(page.getByRole('heading', { name: 'Arkadaşlar', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Sohbet' })).toHaveCount(0);
    await expect(page.getByText('Gelen istekler')).toBeVisible();
    await expect(page.getByText('Gönderilen istekler')).toBeVisible();
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'friends-requests.png') });
    await page.getByRole('button', { name: 'melis isteğini kabul et' }).click();
    await expect(page.getByText('Gelen istekler')).toHaveCount(0);
    await page.getByRole('button', { name: 'can isteğini geri al' }).click();
    await expect(page.getByText('Bekleyen istek yok')).toBeVisible();
    await page.getByRole('tab', { name: /Arkadaşlarım/ }).click();
    await expect(page.getByLabel('melis, profili aç')).toBeVisible();
    await expect(page.getByLabel('zeynep, profili aç')).toBeVisible();
    await expect(page.getByLabel('ece, profili aç')).toBeVisible();
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'friends-list.png') });
    await page.getByRole('tab', { name: 'Ekle', exact: true }).click();
    await expect(page.getByText('Eklemek istediğin kişinin kullanıcı adını yaz')).toBeVisible();
    await page.getByLabel('Kullanıcı adı ara').fill('ar');
    await page.getByRole('button', { name: 'arda için arkadaşlık isteği gönder' }).click();
    await expect(page.getByRole('button', { name: 'arda isteğini geri al' })).toBeVisible();
    await page.getByLabel('Kullanıcı adı ara').fill('me');
    await expect(page.getByLabel('melis, profili aç')).toBeVisible();
    await expect(page.getByText('Arkadaş', { exact: true }).last()).toBeVisible(); // the row's relation tag (the profile stat sits behind)
    await page.getByLabel('Kullanıcı adı ara').fill('zz');
    await expect(page.getByText('Kullanıcı bulunamadı')).toBeVisible();
    await page.getByLabel('Kullanıcı adı ara').fill('ze');
    await page.getByLabel('zeynep, profili aç').click();
    await expect(page.getByRole('heading', { name: 'zeynep' })).toBeVisible();
    await expect(page.getByText('Sabah kahvesi, akşam yürüyüşü.')).toBeVisible();
    await expect(page.getByText('Mart 2026 tarihinden beri')).toBeVisible();
    await expect(page.getByText("Kahve Durağı'nda gözlem")).toBeVisible();
    await expect(page.getByText('Arkadaşsınız')).toBeVisible();
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'person-profile.png') });
    await page.getByRole('button', { name: 'Arkadaşlıktan çıkar' }).click();
    await expect(page.getByRole('button', { name: 'Evet, çıkar' })).toBeVisible();
    await page.getByRole('button', { name: 'Vazgeç' }).click();
    await expect(page.getByRole('button', { name: 'Arkadaşlıktan çıkar' })).toBeVisible();
    await page.getByRole('button', { name: 'Arkadaşlıktan çıkar' }).click();
    await page.getByRole('button', { name: 'Evet, çıkar' }).click();
    await expect(page.getByRole('button', { name: 'Arkadaş ekle' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Arkadaşlıktan çıkar' })).toHaveCount(0);
    await page.goto(url + '?scene=friends');
    await page.getByRole('button', { name: 'Geri dön' }).click();
    await expect(page.getByLabel('chosen')).toHaveText('back');
    await page.goto(url + '?scene=friends&nofriends');
    await expect(page.getByText('Henüz arkadaşın yok')).toBeVisible();
    await page.getByRole('tab', { name: 'İstekler' }).click();
    await expect(page.getByText('Bekleyen istek yok')).toBeVisible();
    await page.goto(url + '?scene=friends&friendsfail');
    await expect(page.getByText('Arkadaş listesi yüklenemedi. Tekrar dene.')).toBeVisible();
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    await page.goto(url + '?scene=friends&actionfail');
    await page.getByRole('tab', { name: /İstekler/ }).click();
    await page.getByRole('button', { name: 'melis isteğini kabul et' }).click();
    await expect(page.getByText('İşlem tamamlanamadı. Tekrar dene.')).toBeVisible();
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'melis isteğini kabul et' })).toBeVisible();
    // A person's profile: strangers, someone waiting on me, failures and no public signals.
    await page.goto(url + '?scene=personProfile&who=u-arda');
    await page.getByRole('button', { name: 'Arkadaş ekle' }).click();
    await expect(page.getByRole('button', { name: 'İsteği geri al' })).toBeVisible();
    await expect(page.getByText('İstek gönderildi', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Mesaj gönder' }).click();
    await expect(page.getByLabel('chosen')).toHaveText('message:arda');
    await page.goto(url + '?scene=personProfile&who=u-melis');
    await expect(page.getByRole('button', { name: 'Kabul et' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reddet' })).toBeVisible();
    await expect(page.getByText('Seni ekledi', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reddet' }).click();
    await expect(page.getByRole('button', { name: 'Arkadaş ekle' })).toBeVisible();
    await page.goto(url + '?scene=personProfile&who=u-arda&profilefail');
    await expect(page.getByText('Profil açılamadı. Tekrar dene.')).toBeVisible();
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    await page.goto(url + '?scene=personProfile&who=u-arda&nosignals');
    await expect(page.getByText('Henüz herkese açık sinyali yok.')).toBeVisible();
    // Bio: empty prompt, live counter, over-limit blocks saving, failure is friendly, saving shows the new bio.
    await page.goto(url + '?scene=profile&nobio');
    await expect(page.getByText('Kendini kısaca tanıt…')).toBeVisible();
    await page.getByRole('button', { name: 'Profili düzenle' }).click();
    await expect(page.getByRole('heading', { name: 'Profili düzenle' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kaydet' })).toBeDisabled();
    await page.getByLabel('Hakkında', { exact: true }).fill('x'.repeat(161));
    await expect(page.getByLabel('161 / 160 karakter')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kaydet' })).toBeDisabled();
    await page.getByLabel('Hakkında', { exact: true }).fill('  Yeni   bio  ');
    await expect(page.getByLabel('8 / 160 karakter')).toBeVisible();
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'profile-edit.png') });
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.getByRole('heading', { name: 'Profili düzenle' })).toHaveCount(0);
    await expect(page.getByText('Yeni bio')).toBeVisible();
    await page.goto(url + '?scene=profile&biofail');
    await page.getByRole('button', { name: 'Profili düzenle' }).click();
    await page.getByLabel('Hakkında', { exact: true }).fill('Bir şey');
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.getByText('Profil kaydedilemedi. Tekrar dene.')).toBeVisible();
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    // Messaging picks friends first: they are listed before anything is typed, and search tags them.
    await page.goto(url + '?scene=search');
    await expect(page.getByText('Arkadaşların')).toBeVisible();
    await expect(page.getByLabel('zeynep ile mesajlaş')).toBeVisible();
    await expect(page.getByLabel('ece ile mesajlaş')).toBeVisible();
    await expect(page.getByLabel('arda ile mesajlaş')).toHaveCount(0);
    await page.getByLabel('Kullanıcı adı', { exact: true }).fill('ze');
    await expect(page.getByText('Arkadaş', { exact: true })).toBeVisible();
    // First-run introduction: three cards, skippable until the last, finishing hands control back.
    await page.goto(url + '?scene=onboarding');
    await expect(page.getByRole('heading', { name: 'Gitmeden önce bil' })).toBeVisible();
    await expect(page.getByLabel('Sayfa 1 / 3')).toBeVisible();
    await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, 'onboarding.png') });
    await page.getByRole('button', { name: 'İleri' }).click();
    await expect(page.getByRole('heading', { name: 'Sen de bir sinyal bırak' })).toBeVisible();
    await page.getByRole('button', { name: 'İleri' }).click();
    await expect(page.getByRole('heading', { name: 'Konumun sende kalır' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tanıtımı atla' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Başla' }).click();
    await expect(page.getByLabel('chosen')).toHaveText('done');
    await page.goto(url + '?scene=onboarding');
    await page.getByRole('button', { name: 'Tanıtımı atla' }).click();
    await expect(page.getByLabel('chosen')).toHaveText('done');
    // Settings: real facts only; the blocked list can be undone; failures are friendly.
    await page.goto(url + '?scene=settings');
    await expect(page.getByRole('heading', { name: 'Ayarlar' })).toBeVisible();
    await expect(page.getByText('qa@example.test')).toBeVisible();
    await expect(page.getByText(/OpenStreetMap katkıcıları/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Engellenen kişiler, 1' })).toBeVisible();
    await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, 'settings.png') });
    await page.getByRole('button', { name: 'Engellenen kişiler, 1' }).click();
    await expect(page.getByRole('heading', { name: 'Engellenen kişiler' })).toBeVisible();
    await expect(page.getByText('mert', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'mert engelini kaldır' }).click();
    await expect(page.getByText('Kimseyi engellemedin')).toBeVisible();
    await page.getByRole('button', { name: 'Geri dön' }).click();
    await expect(page.getByRole('heading', { name: 'Ayarlar' })).toBeVisible();
    // P1.9: the dev-only component preview (Ayarlar > Geliştirici), the same catalogue the "Kit" scene covers, native-runnable.
    await page.getByRole('button', { name: 'Bileşen önizleme' }).click();
    await expect(page.getByRole('heading', { name: 'Bileşen Önizleme' })).toBeVisible();
    // plan-devam B10: the preview shows the new scale and the active theme's colours.
    await expect(page.getByText('Display 34/40')).toBeVisible();
    await expect(page.getByText('Title1 24/30')).toBeVisible();
    await expect(page.getByText('Renk (açık tema)')).toBeVisible();
    await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, 'dev-component-preview.png'), fullPage: true });
    await page.getByRole('tab', { name: 'Takip' }).click();
    await expect(page.getByRole('tab', { name: 'Takip' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Toast göster' }).click();
    await expect(page.getByText('Kaydedildi', { exact: true })).toBeVisible();
    await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, 'dev-component-preview.png') });
    await page.getByRole('button', { name: 'Geri dön' }).click();
    await expect(page.getByRole('heading', { name: 'Ayarlar' })).toBeVisible();
    await page.getByRole('button', { name: 'Oturumu kapat' }).click();
    await expect(page.getByLabel('chosen')).toHaveText('logout');
    // SECURITY S6: sessions - how many devices are signed in, and signing out of the others (two steps).
    await page.goto(url + '?scene=settings');
    await page.getByRole('button', { name: 'Oturumlar' }).click();
    await expect(page.getByText('3 açık oturum')).toBeVisible();
    await page.getByRole('button', { name: 'Diğer cihazlardan çıkış yap' }).click();
    await expect(page.getByText('Bu cihaz dışındaki tüm oturumlar kapanacak.')).toBeVisible();
    await page.getByRole('button', { name: 'Evet, çıkış yap' }).click();
    await expect(page.getByText('2 oturum kapatıldı.')).toBeVisible();
    await expect(page.getByText('1 açık oturum')).toBeVisible();
    await page.waitForTimeout(200); await page.screenshot({ path: path.join(out, 'settings-sessions.png') });
    await page.goto(url + '?scene=settings&noblocks');
    await page.getByRole('button', { name: 'Engellenen kişiler' }).click();
    await expect(page.getByText('Kimseyi engellemedin')).toBeVisible();
    await page.goto(url + '?scene=settings&blockfail');
    await page.getByRole('button', { name: 'Engellenen kişiler' }).click();
    await expect(page.getByText('Engellenen kişiler yüklenemedi. Tekrar dene.')).toBeVisible();
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    // Reporting a person: a reason is required, wrong-information is for signals only, the report reaches the server, failures are friendly.
    await page.goto(url + '?scene=personProfile&who=u-can');
    await page.getByRole('button', { name: 'Bildir', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Bildir' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bildirimi gönder' })).toBeDisabled();
    await expect(page.getByRole('radio', { name: 'Yanlış ya da eski bilgi' })).toHaveCount(0);
    await page.getByRole('radio', { name: 'Spam ya da reklam' }).click();
    await expect(page.getByRole('button', { name: 'Bildirimi gönder' })).toBeEnabled();
    await page.getByLabel('Bildirim notu').fill('  tekrar   tekrar yaziyor ');
    await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, 'report.png') });
    await page.getByRole('button', { name: 'Bildirimi gönder' }).click();
    await expect(page.getByText('Bildirimin alındı')).toBeVisible();
    const sent = await page.evaluate(() => window.__lastReport);
    if (!sent || sent.targetType !== 'user' || sent.targetId !== 'u-can' || sent.reason !== 'spam' || sent.note !== 'tekrar tekrar yaziyor') throw new Error('Report body wrong: ' + JSON.stringify(sent));
    await page.getByRole('button', { name: 'Tamam' }).click();
    await expect(page.getByRole('button', { name: 'Bildir', exact: true })).toBeVisible();
    await page.goto(url + '?scene=personProfile&who=u-can&reportfail');
    await page.getByRole('button', { name: 'Bildir', exact: true }).click();
    await page.getByRole('radio', { name: 'Taciz ya da rahatsız edici davranış' }).click();
    await page.getByRole('button', { name: 'Bildirimi gönder' }).click();
    await expect(page.getByText('Bildirim gönderilemedi. Tekrar dene.')).toBeVisible();
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    // Reporting a signal from the place detail: each signal carries its own report link.
    await page.goto(url + '?scene=reportableDetail');
    await expect(page.getByRole('button', { name: 'Bu sinyali bildir' })).toHaveCount(2);
    await page.getByRole('button', { name: 'Bu sinyali bildir' }).first().click();
    await page.getByRole('radio', { name: 'Yanlış ya da eski bilgi' }).click();
    await page.getByRole('button', { name: 'Bildirimi gönder' }).click();
    await expect(page.getByText('Bildirimin alındı')).toBeVisible();
    const sentSignal = await page.evaluate(() => window.__lastReport);
    if (!sentSignal || sentSignal.targetType !== 'signal' || sentSignal.targetId !== 'post-a' || sentSignal.reason !== 'wrong_info') throw new Error('Signal report wrong: ' + JSON.stringify(sentSignal));
    await expect(page.getByTestId('report-self-harm-help')).toHaveCount(0);
    await page.getByRole('button', { name: 'Tamam' }).click();
    // Faz 10: a self-harm report shows where to get help right away.
    await page.getByRole('button', { name: 'Bu sinyali bildir' }).last().click();
    await page.getByRole('radio', { name: 'Kendine zarar verme' }).click();
    await page.getByRole('button', { name: 'Bildirimi gönder' }).click();
    await expect(page.getByTestId('report-self-harm-help')).toContainText('112');
    await page.getByRole('button', { name: 'Tamam' }).click();
    await expect(page.getByText('Son sinyaller')).toBeVisible();
    // P5.3 sensitive places: no media at a school (and attached media can be removed), a privacy reminder at a
    // clinic that goes away once acknowledged, a "location uncertain" note past 100 m, and a health notice on the place.
    await page.goto(url + '?scene=composerMedia&school');
    await expect(page.getByTestId('no-media-notice')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Galeri', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Eklenen medyayı kaldır' }).click();
    await expect(page.getByRole('button', { name: 'Eklenen medyayı kaldır' })).toHaveCount(0);
    await page.goto(url + '?scene=composerMedia&clinic');
    await expect(page.getByTestId('privacy-notice')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Galeri', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Anladım' }).click();
    await expect(page.getByTestId('privacy-notice')).toHaveCount(0);
    // P5.9: the photo can also go to friends as a snap from the review step - never from an anonymous signal.
    await page.goto(url + '?scene=composerMedia&mediaok');
    await expect(page.getByTestId('target-story')).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('checkbox', { name: 'Arkadaşlar' }).click();
    await expect(page.getByTestId('snap-friends')).toBeVisible();
    await page.waitForTimeout(420); await page.screenshot({ path: path.join(out, 'composer-media.png') });
    const firstFriend = page.getByTestId('snap-friends').getByRole('button').first();
    const friendName = (await firstFriend.innerText()).trim();
    await firstFriend.click();
    await expect(page.getByText('1 kişi seçildi')).toBeVisible();
    await page.getByRole('button', { name: 'Anonim', exact: true }).click();
    await expect(page.getByText(/Anonim sinyal arkadaşlara gönderilemez/)).toBeVisible();
    await expect(page.getByTestId('snap-friends')).toHaveCount(0);
    await expect(page.getByTestId('target-story-hint')).toHaveText('Anonim sinyal hikayeye eklenmez.');
    await page.getByRole('button', { name: 'Sınırlı profil', exact: true }).click();
    await page.getByRole('button', { name: 'Gönder', exact: true }).click();
    await expect(page.getByLabel('snap-to')).toHaveText(/^sent:.+:photo:story$/);
    if (!friendName) throw new Error('friend chip had no name');
    // P5.11: an old gallery photo is labelled and does not count as live.
    await page.goto(url + '?scene=composerMedia&oldphoto');
    await expect(page.getByTestId('gallery-stale')).toContainText('Galeriden · 5 sa önce');
    await page.goto(url + '?scene=composerMedia');
    await expect(page.getByTestId('gallery-stale')).toHaveCount(0);
    await page.goto(url + '?scene=composerMedia&loose');
    await expect(page.getByTestId('location-uncertain')).toContainText('250 m');
    await page.goto(url + '?scene=reportableDetail&clinic');
    await expect(page.getByTestId('health-notice')).toContainText('112');
    await page.goto(url + '?scene=reportableDetail');
    await expect(page.getByTestId('health-notice')).toHaveCount(0);
    // Faz 7 Keşfet: ranked nearby signals, anonymous without author, like in place, own signal not likeable,
    // comments open the thread, following tab, places tab keeps the old list.
    await page.goto(url + '?scene=discover');
    await expect(page.getByRole('heading', { name: 'Keşfet' })).toBeVisible();
    await expect(page.getByTestId('feed-card-n-1')).toBeVisible();
    await expect(page.getByTestId('feed-card-n-2')).toContainText('Topluluk üyesi');
    await expect(page.getByTestId('feed-card-n-2')).not.toContainText('zeynep');
    await expect(page.getByTestId('feed-card-n-1')).toContainText('~350 m');
    // Faz 10: light swearing is labelled, clean items are not.
    await expect(page.getByTestId('feed-card-n-3').getByTestId('feed-sensitive')).toContainText('Hassas içerik');
    await expect(page.getByTestId('feed-card-n-1').getByTestId('feed-sensitive')).toHaveCount(0);
    await page.getByTestId('feed-like-n-1').click();
    await expect(page.getByTestId('feed-like-n-1')).toContainText('5');
    await expect(page.getByTestId('feed-like-n-3')).toBeDisabled();
    // V2-4: the reaction summary, a long press picks an emoji (replacing the heart), mentions and tags are links.
    await expect(page.getByTestId('feed-like-n-1')).toContainText('🔥');
    await page.getByTestId('feed-like-n-1').hover(); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
    await expect(page.getByTestId('feed-like-n-1-picker')).toBeVisible();
    await page.waitForTimeout(200); await page.screenshot({ path: path.join(out, 'reaction-picker.png') });
    await page.getByTestId('feed-like-n-1-picker').getByRole('button', { name: '😂 ile tepki ver' }).click();
    await expect(page.getByRole('button', { name: '😂 tepkini geri al' })).toBeVisible();
    await expect(page.getByTestId('feed-like-n-1')).toContainText('5');
    const lastReaction = await page.evaluate(() => window.__lastReaction);
    if (!lastReaction || lastReaction.reaction !== '😂' || lastReaction.postId !== 'n-1') throw new Error('reaction payload wrong: ' + JSON.stringify(lastReaction));
    await expect(page.getByTestId('feed-card-n-1').getByRole('link', { name: '@zeynep' })).toBeVisible();
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'discover.png') });
    await page.getByTestId('feed-card-n-1').getByRole('button', { name: 'Yorumlar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Yorumlar' })).toBeVisible();
    // plan-devam A7: one like/comment row in the sheet (its own), not the card's as well.
    await expect(page.getByTestId('like-button')).toHaveCount(1);
    await expect(page.getByTestId('feed-like-n-1')).toHaveCount(1); // only the card behind the sheet
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'discover-thread.png') });
    await page.getByRole('button', { name: 'Kapat' }).last().click();
    await page.getByTestId('feed-card-n-1').getByRole('button', { name: 'Haritada göster' }).click();
    await expect(page.getByLabel('opened')).toHaveText('place:kent');
    // V2-6 Instagram card: media edge to edge, a double tap adds the heart, the caption starts with the name,
    // "N yorumun tümünü gör" opens the comments.
    await page.goto(url + '?scene=discover');
    await expect(page.getByTestId('feed-card-n-1').getByTestId('card-media')).toBeVisible();
    await expect(page.getByTestId('feed-caption-n-1')).toContainText('zeynep Kuyruk kapıya kadar.');
    await page.getByTestId('feed-card-n-1').getByTestId('card-media').dblclick();
    await expect(page.getByTestId('feed-card-n-1').getByRole('button', { name: 'Beğeniyi geri al' })).toBeVisible();
    await expect(page.getByTestId('feed-like-n-1')).toContainText('5');
    await page.getByTestId('feed-card-n-1').getByTestId('card-media').dblclick();
    await expect(page.getByTestId('feed-card-n-1').getByRole('button', { name: 'Beğeniyi geri al' })).toBeVisible(); // a second double tap never unlikes
    await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, 'discover-ig-card.png') });
    await page.getByTestId('feed-all-comments-n-1').click();
    await expect(page.getByRole('heading', { name: 'Yorumlar' })).toBeVisible();
    // V2-6 hashtag search: the # tab suggests tags as you type and opens a tag's feed.
    await page.goto(url + '?scene=discover');
    await page.getByRole('tab', { name: 'Etiketler' }).click();
    await expect(page.getByText('Bir etiket ara')).toBeVisible();
    await page.getByTestId('hashtag-search-input').fill('Ecz');
    await expect(page.getByTestId('hashtag-row-eczane')).toContainText('3 sinyal');
    await expect(page.getByTestId('hashtag-row-ecz')).toContainText('Bu etiketi aç');
    await page.waitForTimeout(200); await page.screenshot({ path: path.join(out, 'hashtag-search.png') });
    await page.getByTestId('hashtag-row-eczane').click();
    await expect(page.getByRole('heading', { name: 'eczane' })).toBeVisible();
    await page.getByTestId('hashtag-back').click();
    await expect(page.getByTestId('hashtag-search-input')).toBeVisible();
    // V2-4: a #tag opens its feed inside Keşfet; back returns to the tabs.
    await page.goto(url + '?scene=discover');
    await page.getByTestId('feed-card-n-1').getByRole('link', { name: '#eczane' }).click();
    await expect(page.getByRole('heading', { name: 'eczane' })).toBeVisible();
    await expect(page.getByTestId('feed-card-h-1')).toContainText('Nöbetçi açık');
    await expect(page.getByRole('heading', { name: 'Yorumlar' })).toHaveCount(0); // the tag did not also open the thread
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'hashtag-feed.png') });
    await page.getByTestId('hashtag-back').click();
    await expect(page.getByTestId('feed-card-n-1')).toBeVisible();
    await page.goto(url + '?scene=discover&nohashtag');
    await page.getByTestId('feed-card-n-1').getByRole('link', { name: '#eczane' }).click();
    await expect(page.getByText('#eczane ile paylaşım yok')).toBeVisible();
    await page.goto(url + '?scene=discover');
    await page.getByRole('tab', { name: 'Takip' }).click();
    await expect(page.getByTestId('feed-card-f-1')).toBeVisible();
    // Stories: the tray (unseen ring first), watching moves through the segments and marks them seen, a reply goes
    // as a DM, and my own story shows viewers and can be deleted.
    await page.goto(url + '?scene=discover');
    await expect(page.getByTestId('story-tray')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hikaye ekle' })).toBeVisible();
    await page.getByRole('button', { name: 'zeynep, yeni hikaye' }).click();
    await expect(page.getByTestId('story-viewer')).toBeVisible();
    await expect(page.getByText('Kuyruk kısa')).toBeVisible();
    await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, 'story-viewer.png') });
    await page.getByLabel('zeynep kişisine yanıt ver…').fill('Teşekkürler!');
    await page.getByRole('button', { name: 'Gönder' }).click();
    await expect(page.getByText('Yanıtın mesaj olarak gönderildi.')).toBeVisible();
    // V2-3: the heart (optimistic, pressed state), six quick emoji replies that go as a story reply DM.
    await page.getByRole('button', { name: 'Hikayeyi beğen' }).click();
    await expect(page.getByRole('button', { name: 'Beğeniyi geri al' })).toBeVisible();
    await expect(page.getByTestId('story-reactions').getByRole('button')).toHaveCount(6);
    await page.getByRole('button', { name: '🔥 ile yanıtla' }).click();
    await expect(page.getByText('🔥 mesaj olarak gönderildi.')).toBeVisible();
    if ((await page.evaluate(() => window.__lastText)) !== '↩ Hikayene yanıt: 🔥') throw new Error('emoji reply wrong');
    await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, 'story-viewer-liked.png') });
    await page.getByTestId('story-next').click();
    await page.getByTestId('story-next').click();
    await page.getByTestId('story-next').click();
    await expect(page.getByTestId('story-viewer')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'zeynep, izlendi' })).toBeVisible();
    await page.getByRole('button', { name: 'Hikaye ekle' }).click();
    await expect(page.getByRole('button', { name: 'Fotoğraf çek' })).toBeEnabled();
    await page.getByRole('button', { name: 'Fotoğraf çek' }).click();
    await page.getByRole('button', { name: 'Paylaş', exact: true }).click();
    await expect(page.getByText('Hikayen 24 saat takipçilerine görünür.')).toBeVisible();
    await page.getByRole('button', { name: 'Hikayen', exact: true }).click();
    await expect(page.getByText('2 görüntüleme')).toBeVisible();
    await expect(page.getByLabel('1 beğeni')).toBeVisible();
    await page.getByText('2 görüntüleme').click();
    await expect(page.getByText('Görüntüleyenler')).toBeVisible();
    await expect(page.getByTestId('viewer-liked-u-zeynep')).toBeVisible();
    await expect(page.getByTestId('viewer-liked-u-ece')).toHaveCount(0);
    await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, 'story-viewers-hearts.png') });
    await page.getByRole('button', { name: 'Vazgeç' }).click();
    await page.getByRole('button', { name: 'Hikayeyi sil' }).click();
    await page.getByRole('button', { name: 'Evet, sil' }).click();
    await expect(page.getByTestId('story-viewer')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Hikaye ekle' })).toBeVisible();
    // V2-3: swipe left turns to the next person (the release is not also a tap), swipe down closes.
    await page.goto(url + '?scene=discover');
    await page.getByRole('button', { name: /^zeynep, / }).click();
    await expect(page.getByTestId('story-viewer')).toBeVisible();
    await page.mouse.move(300, 400); await page.mouse.down();
    for (let x = 300; x >= 60; x -= 12) await page.mouse.move(x, 402);
    await page.mouse.up();
    await expect(page.getByTestId('story-viewer').getByText('ece', { exact: true })).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('story-viewer')).toBeVisible();
    await page.mouse.move(200, 300); await page.mouse.down();
    for (let y = 300; y <= 560; y += 12) await page.mouse.move(202, y);
    await page.mouse.up();
    await expect(page.getByTestId('story-viewer')).toHaveCount(0);
    // P8.7: send a feed signal to a friend in chat (link + summary, no author).
    await page.goto(url + '?scene=discover');
    await page.getByTestId('feed-share-n-1').click();
    await expect(page.getByRole('heading', { name: 'Sohbette paylaş' })).toBeVisible();
    // V2-7 share menu: copy the link (the app's own link, no author), other apps, then friends.
    await expect(page.getByRole('heading', { name: 'Paylaş', exact: true })).toBeVisible();
    await page.getByTestId('share-copy-link').click();
    await expect(page.getByText('Bağlantı kopyalandı.')).toBeVisible();
    await expect(page.getByTestId('share-elsewhere')).toBeVisible();
    await page.waitForTimeout(200); await page.screenshot({ path: path.join(out, 'share-menu.png') });
    await page.getByRole('button', { name: 'zeynep: Paylaş' }).click();
    await expect(page.getByText('zeynep kişisine gönderildi.')).toBeVisible();
    const lastShare = await page.evaluate(() => window.__lastShare);
    if (!lastShare || lastShare.postId !== 'n-1' || 'authorName' in lastShare || 'authorId' in lastShare) throw new Error('share payload wrong: ' + JSON.stringify(lastShare));
    // Faz 9: the bell shows unread; the list is grouped, a follow request can be answered inline, a like opens the signal.
    await page.goto(url + '?scene=discover');
    await expect(page.getByRole('button', { name: 'Bildirimler, 2 okunmamış' })).toBeVisible();
    await page.getByTestId('notifications-bell').click();
    await expect(page.getByRole('heading', { name: 'Bildirimler' })).toBeVisible();
    // V2-7: what was unread comes first as Yeni; a grouped row (reactions on one signal) shows two faces.
    await expect(page.getByRole('heading', { name: 'Yeni' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bugün' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Daha önce' })).toBeVisible();
    await expect(page.getByTestId('notification-faces-n4')).toBeVisible();
    await expect(page.getByText('ece, can ve 3 kişi daha gönderine tepki verdi.')).toBeVisible();
    await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, 'notifications.png') });
    await page.getByRole('button', { name: 'Onayla' }).click();
    await expect(page.getByText('Yanıtlandı')).toBeVisible();
    await page.getByTestId('notification-n1').click();
    await expect(page.getByRole('heading', { name: 'Yorumlar' })).toBeVisible();
    await page.getByRole('button', { name: 'Kapat' }).last().click();
    await page.getByRole('button', { name: 'Kapat' }).first().click();
    await expect(page.getByRole('button', { name: 'Bildirimler', exact: true })).toBeVisible();
    await page.goto(url + '?scene=discover&nonotifications');
    await page.getByTestId('notifications-bell').click();
    await expect(page.getByText('Henüz bildirim yok')).toBeVisible();
    await page.goto(url + '?scene=discover&nofollowing');
    await page.getByRole('tab', { name: 'Takip' }).click();
    await expect(page.getByText('Takip akışın boş')).toBeVisible();
    await page.getByRole('tab', { name: 'Yerler' }).click();
    await expect(page.getByText('Çevrendeki taze yer durumları').first()).toBeVisible();
    await page.goto(url + '?scene=discover&feedfail');
    await expect(page.getByText('Akış yüklenemedi. Tekrar dene.').first()).toBeVisible();
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    // Faz 4: likes and comments on a signal, inside the same sheet (no second sheet).
    await page.goto(url + '?scene=reportableDetail');
    await page.getByTestId('open-thread-post-a').click();
    await expect(page.getByRole('heading', { name: 'Yorumlar' })).toBeVisible();
    await expect(page.getByText('Sıra ne kadar?')).toBeVisible();
    await expect(page.getByText('5 dakika kadar')).toBeVisible();
    await expect(page.getByText('Teşekkürler')).toHaveCount(0); // second reply collapsed
    await page.getByText('1 yanıtı gör').click();
    await expect(page.getByText('Teşekkürler')).toBeVisible();
    await expect(page.getByText('Paylaşan').first()).toBeVisible();
    await expect(page.getByTestId('like-button')).toContainText('3');
    await page.getByTestId('like-button').click();
    await expect(page.getByTestId('like-button')).toContainText('4');
    await expect(page.getByRole('button', { name: 'Beğeniyi geri al' })).toBeVisible();
    // V2-4: a long press on the heart picks an emoji; comment likes; resolved mentions are links; "@" suggests people.
    await page.getByTestId('like-button').hover(); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
    await page.getByTestId('like-button-picker').getByRole('button', { name: '🔥 ile tepki ver' }).click();
    await expect(page.getByRole('button', { name: '🔥 tepkini geri al' })).toBeVisible();
    await expect(page.getByTestId('like-button')).toContainText('4');
    await expect(page.getByTestId('comment-like-c2')).toContainText('2');
    await page.getByTestId('comment-like-c2').click();
    await expect(page.getByTestId('comment-like-c2')).toContainText('3');
    await expect(page.getByRole('button', { name: 'Yorum beğenisini geri al' })).toBeVisible();
    await expect(page.getByTestId('comment-c2').getByRole('link', { name: '@zeynep' })).toBeVisible();
    await expect(page.getByTestId('comment-c2').getByRole('link', { name: '#eczane' })).toBeVisible();
    await page.getByTestId('comment-c2').getByRole('link', { name: '@zeynep' }).click();
    if ((await page.evaluate(() => window.__openedPerson)) !== 'u-zeynep') throw new Error('mention did not open the person');
    await page.goto(url + '?scene=reportableDetail');
    await page.getByTestId('open-thread-post-a').click();
    await page.getByTestId('comment-input').fill('Selam @ze');
    await expect(page.getByTestId('mention-suggestions')).toBeVisible();
    await page.waitForTimeout(200); await page.screenshot({ path: path.join(out, 'mention-suggestions.png') });
    await page.getByRole('button', { name: 'zeynep kişisini an' }).click();
    await expect(page.getByTestId('comment-input')).toHaveValue('Selam @zeynep ');
    await expect(page.getByTestId('mention-suggestions')).toHaveCount(0);
    // Faz 10: a plate in a comment warns (and says the server hides it); clearing it removes the warning.
    await page.getByTestId('comment-input').fill('34 ABC 123 kapıyı kapattı');
    await expect(page.getByTestId('personal-data-notice')).toContainText('otomatik gizlenir');
    await page.getByTestId('comment-input').fill('Ara 0532 123 45 67');
    await expect(page.getByTestId('personal-data-notice')).toContainText('herkese görünür');
    await page.getByTestId('comment-input').fill('Şimdi boş mu?');
    await expect(page.getByTestId('personal-data-notice')).toHaveCount(0);
    await page.getByTestId('comment-send').click();
    await expect(page.getByText('Şimdi boş mu?')).toBeVisible();
    await expect(page.getByTestId('comment-input')).toHaveValue('');
    await page.getByRole('button', { name: 'Yanıtla' }).first().click();
    await expect(page.getByText(/kişisine yanıt$/)).toBeVisible();
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'signal-thread.png') });
    await page.getByRole('button', { name: 'Yanıtı iptal et' }).click();
    await page.getByRole('button', { name: 'Yorum seçenekleri' }).first().click();
    await page.getByRole('button', { name: 'Sil', exact: true }).click();
    await expect(page.getByText('Yorumu sil?')).toBeVisible();
    await page.getByRole('button', { name: 'Sil', exact: true }).click();
    await expect(page.getByText('Şimdi boş mu?')).toHaveCount(0);
    await page.getByRole('button', { name: 'Geri', exact: true }).click();
    await expect(page.getByText('Son sinyaller')).toBeVisible();
    // A failed like rolls back and says so in plain words.
    await page.goto(url + '?scene=reportableDetail&likefail');
    await page.getByTestId('open-thread-post-a').click();
    await page.getByTestId('like-button').click();
    await expect(page.getByText('Beğeni kaydedilemedi. Tekrar dene.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Beğen', exact: true })).toBeVisible();
    // Faz 6 follows: counts on a profile, follow is immediate for a public account (count +1), unfollow asks first.
    await page.goto(url + '?scene=personProfile&who=u-arda');
    await expect(page.getByText('Takipçi', { exact: true })).toBeVisible();
    await expect(page.getByText('Seni takip ediyor')).toBeVisible();
    await page.getByRole('button', { name: 'Geri takip et' }).click();
    await expect(page.getByRole('button', { name: 'Takip ediliyor' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^4 Takipçi$/ })).toBeVisible();
    await page.getByRole('button', { name: 'Takip ediliyor' }).click();
    await page.getByRole('button', { name: 'Takibi bırak' }).click();
    await expect(page.getByRole('button', { name: 'Geri takip et' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^3 Takipçi$/ })).toBeVisible();
    // The follower list opens inside the same sheet and goes back to the profile.
    await page.getByRole('button', { name: /^3 Takipçi$/ }).click();
    await expect(page.getByRole('tab', { name: 'Takipçiler' })).toBeVisible();
    await expect(page.getByText('ece', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Kapat' }).first().click();
    await expect(page.getByRole('button', { name: 'Geri takip et' })).toBeVisible();
    // A private account: locked content, following sends a request.
    await page.goto(url + '?scene=personProfile&who=u-melis');
    await expect(page.getByTestId('private-lock')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sinyalleri' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Takip et', exact: true }).click();
    await expect(page.getByRole('button', { name: 'İstek gönderildi' })).toBeVisible();
    await expect(page.getByTestId('private-lock')).toBeVisible();
    // A failed follow rolls back and says so.
    await page.goto(url + '?scene=personProfile&who=u-ece&followfail');
    await page.getByRole('button', { name: 'Takip et', exact: true }).click();
    await expect(page.getByText('İşlem tamamlanamadı. Tekrar dene.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Takip et', exact: true })).toBeVisible();
    // Settings: the private-account switch.
    await page.goto(url + '?scene=settings');
    await expect(page.getByText('Gizli hesap', { exact: true })).toBeVisible();
    await page.getByRole('switch', { name: 'Gizli hesap' }).click();
    await expect(page.getByRole('switch', { name: 'Gizli hesap' })).toBeChecked();
    // Blocking a person: two-step confirm, the blocked profile offers only "unblock", and unblocking restores the normal buttons.
    await page.goto(url + '?scene=personProfile&who=u-melis');
    await page.getByRole('button', { name: 'Engelle', exact: true }).click();
    await expect(page.getByText(/Engellersen arkadaşlığınız biter/)).toBeVisible();
    await page.getByRole('button', { name: 'Vazgeç' }).click();
    await expect(page.getByText(/Engellersen arkadaşlığınız biter/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Engelle', exact: true }).click();
    await page.getByRole('button', { name: 'Evet, engelle' }).click();
    await expect(page.getByRole('button', { name: 'Engeli kaldır' })).toBeVisible();
    await expect(page.getByText('Engelli', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mesaj gönder' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Sinyalleri' })).toHaveCount(0);
    await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, 'person-blocked.png') });
    await page.getByRole('button', { name: 'Engeli kaldır' }).click();
    await expect(page.getByRole('button', { name: 'Arkadaş ekle' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mesaj gönder' })).toBeVisible();
    await page.goto(url + '?scene=personProfile&who=u-mert');
    await expect(page.getByRole('button', { name: 'Engeli kaldır' })).toBeVisible();
    await page.goto(url + '?scene=personProfile&who=u-arda&blockfail');
    await page.getByRole('button', { name: 'Engelle', exact: true }).click();
    await page.getByRole('button', { name: 'Evet, engelle' }).click();
    await expect(page.getByText('İşlem tamamlanamadı. Tekrar dene.')).toBeVisible();
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    // From a conversation: tap the name, block, and the conversation leaves the list.
    await page.goto(url + '?scene=chat');
    await page.getByLabel(/^arda, Buraya geldin mi\?/).click();
    await page.getByLabel('arda, profili aç').click();
    await page.getByRole('button', { name: 'Engelle', exact: true }).click();
    await page.getByRole('button', { name: 'Evet, engelle' }).click();
    await expect(page.getByRole('heading', { name: 'Sohbetler' })).toBeVisible();
    await expect(page.getByLabel(/^arda, /)).toHaveCount(0);
    await expect(page.getByLabel(/^zeynep, /)).toBeVisible();
    // Saved places show how they are doing right now: only fresh verified activity, live places first, failures change nothing.
    await page.goto(url + '?scene=profile');
    await expect(page.getByText(/^Canlı · Doluluk · Kalabalık/)).toBeVisible();
    await expect(page.getByText(/^Canlı · Bekleme · 15 dk üzeri/)).toBeVisible();
    await expect(page.getByText(/^Canlı · /)).toHaveCount(2);
    const savedOrder = await page.getByLabel(/haritada aç/).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label').split(',')[0]));
    if (savedOrder[savedOrder.length - 1] !== 'Kent Müzesi') throw new Error('The place with only a stale state should come last: ' + savedOrder.join('|'));
    await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, 'profile-live.png') });
    await page.goto(url + '?scene=profile&nolive');
    await expect(page.getByLabel(/haritada aç/)).toHaveCount(3);
    await expect(page.getByText(/^Canlı · /)).toHaveCount(0);
    await page.goto(url + '?scene=profile&livefail');
    await expect(page.getByLabel(/haritada aç/)).toHaveCount(3);
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    // Yakında: fresh, close, capped list of what is happening around the device; five-item bottom bar.
    await page.goto(url + '?scene=nearby');
    await expect(page.getByRole('heading', { name: 'Yakında' })).toBeVisible();
    await expect(page.getByLabel(/Kent Meydanı, .*Haritada aç/)).toBeVisible();
    // plan-devam A8: one freshness rule, so the header live count, the 'Canlı' chip and its rows always agree.
    await expect(page.getByText(/5 sinyal · \d+ canlı/)).toBeVisible();
    const liveInHeader = Number((await page.getByText(/5 sinyal · \d+ canlı/).textContent()).match(/· (\d+) canlı/)[1]);
    const rowLabels = await page.getByLabel(/Haritada aç/).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label').split(',')[0]));
    // Freshest bucket (< 15 min) by distance, then the older bucket by distance.
    if (rowLabels.join('|') !== 'Kent Meydanı|Yol çalışması|Masal Parkı|Yıldırım Beyazıt Kafe|Merkez Eczanesi') throw new Error('Yakında order wrong: ' + rowLabels.join('|'));
    await expect(page.getByText('Çok uzak yer')).toHaveCount(0);
    await expect(page.getByText('Sessiz Market')).toHaveCount(0);
    await expect(page.getByText('Eski gözlem')).toHaveCount(0);
    await expect(page.getByRole('tab')).toHaveCount(4);
    await expect(page.getByRole('tab', { name: 'Keşfet' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Harita' })).toHaveAttribute('aria-selected', 'false');
    await page.waitForTimeout(420); await page.screenshot({ path: path.join(out, 'nearby.png') });
    await page.getByRole('button', { name: /Tümü, 5 sonuç/ }).waitFor();
    await page.getByRole('button', { name: /Bekleme, 2 sonuç/ }).click();
    await expect(page.getByLabel(/Haritada aç/)).toHaveCount(2);
    await page.getByRole('button', { name: new RegExp(`Canlı, ${liveInHeader} sonuç`) }).click();
    await expect(page.getByLabel(/Haritada aç/)).toHaveCount(liveInHeader);
    if (liveInHeader < 1) throw new Error('stub should have at least one live place');
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
    // plan-devam Faz E: bubbles (mine right, theirs left), a day separator, "Görüldü" under my newest message only,
    // a quoted reply, a shared signal as a card that opens the Sinyal Kartı, and "yazıyor".
    await page.goto(url + '?scene=conversation');
    const mineBox = await page.getByTestId('message-m4').boundingBox();
    const theirsBox = await page.getByTestId('message-m3').boundingBox();
    if (!mineBox || !theirsBox || !(mineBox.x + mineBox.width > theirsBox.x + theirsBox.width) || !(mineBox.x > theirsBox.x)) throw new Error('bubbles are not on their sides');
    await expect(page.getByTestId('chat-day')).toHaveText(['Bugün', 'Dün']);
    await expect(page.getByTestId('chat-receipt')).toHaveCount(1);
    await expect(page.getByTestId('chat-receipt')).toContainText('Görüldü');
    await expect(page.getByTestId('quote-m3')).toContainText('Merhaba! Orada yer var mı?');
    await expect(page.getByText('Ben', { exact: true })).toHaveCount(0);
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'conversation-bubbles.png') });
    await page.getByTestId('message-share-1').click();
    await expect(page.getByTestId('signal-card-modal')).toBeVisible();
    await page.goto(url + '?scene=conversation&typing');
    await expect(page.getByTestId('chat-typing')).toHaveText('yazıyor…');
    // Long press: react, reply with a quote, copy; my own can be taken back, theirs reported.
    await page.goto(url + '?scene=conversation');
    await page.getByTestId('message-m3').hover();
    await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Bildir', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '❤️ tepkisi' }).click();
    await expect(page.getByText('❤️', { exact: true })).toBeVisible();
    await page.getByTestId('message-m3').hover();
    await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up();
    await page.getByRole('button', { name: 'Kopyala', exact: true }).click();
    await expect(page.getByText('Kopyalandı')).toBeVisible();
    if ((await page.evaluate(() => window.__clipboard)) !== 'Şu an burası baya canlı, gel istersen.') throw new Error('copy did not reach the clipboard');
    await page.waitForTimeout(500);
    await page.getByTestId('message-m3').hover();
    await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up();
    await page.getByRole('button', { name: 'Yanıtla', exact: true }).click();
    await expect(page.getByTestId('reply-bar')).toContainText('zeynep kişisine yanıt');
    await page.getByLabel('Mesaj yaz').fill('Geliyorum o zaman');
    if (!((await page.evaluate(() => window.__typingPings ?? 0)) >= 1)) throw new Error('typing was not sent');
    await page.getByRole('button', { name: 'Gönder' }).click();
    await expect(page.getByTestId('reply-bar')).toHaveCount(0);
    await expect(page.getByTestId('quote-sent-0')).toContainText('Şu an burası baya canlı');
    await page.getByTestId('message-m4').hover();
    await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up();
    await page.getByRole('button', { name: 'Geri al' }).click();
    await expect(page.getByText('Mesaj geri alındı')).toBeVisible();
    await expect(page.getByText('Tamam, geliyorum.')).toHaveCount(0);
    await page.goto(url + '?scene=conversation&sendfail');
    await page.getByLabel('Mesaj yaz').fill('Gitmeyecek');
    await page.getByRole('button', { name: 'Gönder' }).click();
    await expect(page.getByText('Mesaj gönderilemedi. Tekrar dene.')).toBeVisible();
    await expect(page.getByText('Network request failed')).toHaveCount(0);
    await expect(page.getByLabel('Mesaj yaz')).toHaveValue('Gitmeyecek');
    await page.goto(url + '?scene=conversation&emptychat');
    await expect(page.getByText('Henüz mesaj yok')).toBeVisible();

    // plan-devam Faz F: legal texts (draft note, two languages share the screen), data request, two-step deletion,
    // the pending-deletion screen, and the birth year at sign-up.
    await page.goto(url + '?scene=settings');
    await page.getByRole('button', { name: 'Topluluk kuralları' }).click();
    await expect(page.getByTestId('legal-community')).toBeVisible();
    await expect(page.getByTestId('legal-draft')).toContainText('taslaktır');
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'legal-community.png') });
    await page.getByLabel('Geri dön').click();
    await page.getByRole('button', { name: 'Gizlilik politikası' }).click();
    await expect(page.getByTestId('legal-privacy')).toContainText('Kesin cihaz konumun');
    await page.getByLabel('Geri dön').click();
    await page.getByRole('button', { name: 'Verilerimi iste' }).click();
    await page.getByRole('button', { name: 'Verilerimi iste' }).click();
    await expect(page.getByTestId('data-request-done')).toContainText('Talebin alındı');
    await page.getByLabel('Geri dön').click();
    await page.getByRole('button', { name: 'Hesabı sil' }).click();
    await expect(page.getByTestId('delete-account')).toContainText('30 gün');
    await page.getByRole('button', { name: 'Devam et' }).click();
    await expect(page.getByRole('button', { name: 'Hesabımı sil' })).toBeDisabled();
    await page.getByLabel('Şifre', { exact: true }).fill('yanlis');
    await page.getByRole('button', { name: 'Hesabımı sil' }).click();
    await expect(page.getByText('Şifre doğru değil.')).toBeVisible();
    await expect(page.getByLabel('chosen')).toHaveText('none');
    await page.getByLabel('Şifre', { exact: true }).fill('dogru-sifre');
    await page.getByRole('button', { name: 'Hesabımı sil' }).click();
    await expect(page.getByLabel('chosen')).toHaveText('logout');
    await page.goto(url + '?scene=pendingDeletion');
    await expect(page.getByTestId('pending-deletion')).toContainText('24 Ekim 2026');
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'pending-deletion.png') });
    await page.getByRole('button', { name: 'Silmeyi geri al' }).click();
    await expect(page.getByLabel('chosen')).toHaveText('cancelled:none');
    await page.goto(url + '?scene=auth');
    await page.getByTestId('birth-year').fill('2020');
    await expect(page.getByTestId('birth-year-hint')).toContainText('en az 13');
    await page.getByTestId('birth-year').fill('2011');
    await expect(page.getByTestId('birth-year-hint')).toContainText('gizli başlar');
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'auth-birth-year.png') });
    await expect(page.getByTestId('auth-terms')).toContainText('sıfır tolerans');
    // Passwords need at least 8 characters: the hint turns red and the button waits.
    await page.getByTestId('password-input').fill('kisa');
    await expect(page.getByTestId('password-hint')).toHaveText('En az 8 karakter');
    await page.getByTestId('password-input').fill('yeterince-uzun');
    await expect(page.getByTestId('password-hint')).toBeVisible();
    await page.getByRole('link', { name: 'Kullanım şartları' }).click();
    await expect(page.getByTestId('auth-legal')).toContainText('En az 13'.replace('En az', 'en az'));
    await page.getByRole('button', { name: 'Metni kapat' }).click();
    await expect(page.getByTestId('auth-legal')).toHaveCount(0);

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
    // "Hâlâ böyle mi?": offered for a fresh structured state; answers hand the current value to the composer.
    await expect(page.getByText('Hâlâ böyle mi?')).toBeVisible();
    await page.getByRole('button', { name: 'Evet, hâlâ böyle' }).click();
    await expect(page.getByLabel('answer')).toHaveText('confirm:Crowd:Busy');
    await page.getByRole('button', { name: 'Değişti' }).click();
    await expect(page.getByLabel('answer')).toHaveText('changed:Crowd:Busy');
    await page.goto(url + '?scene=detail&stale');
    await expect(page.getByText('Örnek Lokanta')).toBeVisible();
    await expect(page.getByText('Hâlâ böyle mi?')).toHaveCount(0);

    // P1.4 (sinyal-mvp-plan): i18n actually switches, not just "happens to already say the right thing in tr".
    // ?lang=en picks English (this is the *only* thing in the app that reads a translation key so far -
    // the bottom tab bar; everything else is still plain Turkish text, exactly as before this phase).
    await page.goto(url + '?scene=kit&lang=en');
    await expect(page.getByRole('tab', { name: 'Chat' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Explore' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Sohbet' })).toHaveCount(0);
    await page.goto(url + '?scene=kit&lang=de');
    await expect(page.getByRole('tab', { name: 'Chat' })).toBeVisible(); // unsupported device language falls back to en, not tr
    await page.goto(url + '?scene=kit');
    await expect(page.getByRole('tab', { name: 'Sohbet' })).toBeVisible(); // default (no ?lang) is the device's own tr

    // plan-devam Faz C: the Sinyal Kartı - centre card, place strip, on-site badge, uncropped media, pager,
    // verify near/far, like, comments, menu, close.
    await page.goto(url + '?scene=card');
    await expect(page.getByTestId('signal-card-modal')).toBeVisible();
    await expect(page.getByTestId('card-place-strip')).toContainText('BİM Merkez');
    await expect(page.getByTestId('card-pager')).toContainText('1 / 3');
    await expect(page.getByTestId('signal-card-card-1').getByTestId('card-on-site')).toContainText('Konumda');
    await expect(page.getByTestId('signal-card-card-1')).toContainText('1 sa 28 dk kaldı');
    await expect(page.getByTestId('card-gallery')).toHaveCount(0);
    // D10: an old gallery photo says so and is not 'Konumda'.
    await page.goto(url + '?scene=card&gallery');
    await expect(page.getByTestId('signal-card-card-1').getByTestId('card-gallery')).toContainText('Galeriden');
    await expect(page.getByTestId('signal-card-card-1').getByTestId('card-on-site')).toHaveCount(0);
    await page.goto(url + '?scene=card');
    await expect(page.getByTestId('signal-card-card-1').getByTestId('card-media')).toBeVisible();
    const media = await page.getByTestId('signal-card-card-1').getByTestId('card-media').boundingBox();
    if (Math.abs(media.width / media.height - 0.8) > 0.02) throw new Error('landscape photo should sit in a 4:5 frame, got ' + (media.width / media.height).toFixed(2));
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, 'signal-card.png') });
    await expect(page.getByTestId('signal-card-card-1').getByTestId('card-like')).toContainText('12');
    await page.getByTestId('signal-card-card-1').getByTestId('card-like').click();
    await expect(page.getByTestId('signal-card-card-1').getByTestId('card-like')).toContainText('13');
    await page.getByTestId('signal-card-card-1').getByTestId('card-verify-yes').click();
    await expect(page.getByTestId('signal-card-card-1').getByTestId('card-verify-yes')).toContainText('Onayladın');
    await page.getByRole('button', { name: 'Sonraki sinyal' }).click();
    await expect(page.getByTestId('card-pager')).toContainText('2 / 3');
    await page.getByRole('button', { name: 'Sonraki sinyal' }).click();
    await expect(page.getByTestId('card-pager')).toContainText('3 / 3');
    await expect(page.getByTestId('signal-card-card-3').getByTestId('card-text')).toContainText('Bugün erken kapattılar.');
    await expect(page.getByTestId('signal-card-card-3')).toContainText('Topluluk üyesi');
    await page.getByTestId('signal-card-card-3').getByTestId('card-menu').click();
    await expect(page.getByTestId('card-menu-sheet')).toContainText('Sinyali bildir');
    await expect(page.getByTestId('card-menu-sheet')).not.toContainText('Bu kişiyi engelle'); // anonymous: no author to block
    await page.getByLabel('Kapat', { exact: true }).last().click({ position: { x: 20, y: 20 } });
    // V2-2: comments open the full page (card grows to the whole screen); back returns to the card.
    await page.getByTestId('signal-card-card-3').getByTestId('card-comments').click();
    await expect(page.getByTestId('card-full')).toBeVisible();
    await expect(page.getByTestId('comment-input')).toBeVisible();
    await page.waitForTimeout(500);
    const full = await page.getByTestId('card-container').boundingBox();
    if (full.height < 800 || full.x > 1) throw new Error('full page should cover the screen, got ' + JSON.stringify(full));
    await page.screenshot({ path: path.join(out, 'signal-card-full.png') });
    await page.getByRole('button', { name: 'Geri' }).click();
    await expect(page.getByTestId('card-full')).toHaveCount(0);
    await expect(page.getByTestId('card-pager')).toContainText('3 / 3');
    await page.getByTestId('card-close').click();
    await expect(page.getByText('kapandı')).toBeVisible();
    // Far away: the verify buttons stay visible but disabled, with the reason.
    await page.goto(url + '?scene=card&far');
    await expect(page.getByTestId('signal-card-card-1').getByTestId('card-verify-hint')).toContainText('yakın olmalısın');
    await expect(page.getByTestId('signal-card-card-1').getByTestId('card-verify-yes')).toBeDisabled();
    // Own signal: views are shown to the author, delete is in the menu, verify says why not.
    await page.goto(url + '?scene=card&cardmine');
    await expect(page.getByTestId('signal-card-card-1')).toContainText('48');
    await expect(page.getByTestId('signal-card-card-1').getByTestId('card-verify-hint')).toContainText('Kendi sinyalini');
    await page.getByTestId('signal-card-card-1').getByTestId('card-menu').click();
    await expect(page.getByTestId('card-menu-sheet')).toContainText('Sinyali sil');
    await page.getByLabel('Kapat', { exact: true }).last().click({ position: { x: 20, y: 20 } });
    // A single signal has the expand button next to close.
    await page.goto(url + '?scene=card&one');
    await page.getByTestId('card-expand').click();
    await expect(page.getByTestId('card-full')).toBeVisible();
    await expect(page.getByTestId('card-full')).toContainText('BİM Merkez');
    await page.goto(url + '?scene=card&theme=dark');
    await page.waitForTimeout(500); await page.screenshot({ path: path.join(out, 'signal-card-dark.png') });

    if(errors.length) throw new Error(errors.join('\n'));
    console.log('PASS browser-rendered components: selection, collapse, nearby/coordinate publish, submitting lock, value selection, branch search, save, close, responsive detail. Native map/media/iOS gestures require physical retest.');
  } finally { await browser.close(); server.close(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
