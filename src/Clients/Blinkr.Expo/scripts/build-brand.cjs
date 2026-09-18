const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
async function main() {
  const assets = path.resolve(__dirname, '../assets');
  const mark = await fs.readFile(path.join(assets, 'brand/mark.svg'));
  const mono = await fs.readFile(path.join(assets, 'brand/monochrome.svg'));
  const icon = await sharp(mark).resize(620, 620).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#D8F65A' } }).composite([{ input: icon, gravity: 'centre' }]).png().toFile(path.join(assets, 'blinkr-icon.png'));
  const foreground = await sharp(mark).resize(420, 420).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#00000000' } }).composite([{ input: foreground, gravity: 'centre' }]).png().toFile(path.join(assets, 'android-icon-foreground.png'));
  const silhouette = await sharp(mono).resize(420,420).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#00000000' } }).composite([{ input: silhouette, gravity: 'centre' }]).png().toFile(path.join(assets, 'android-icon-monochrome.png'));
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#D8F65A' } }).png().toFile(path.join(assets, 'android-icon-background.png'));
  await sharp(mark).resize(48, 48).png().toFile(path.join(assets, 'favicon.png'));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
