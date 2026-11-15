import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'public');
const rounded = await readFile(path.join(outDir, 'icon.svg'));
const fullBleed = await readFile(path.join(outDir, 'icon-maskable.svg'));

// iOS masks its own corners, so Apple icons and the maskable icon use the full-bleed art.
const outputs = [
  { name: 'favicon-32.png', size: 32, source: rounded },
  { name: 'icon-192x192.png', size: 192, source: rounded },
  { name: 'icon-256x256.png', size: 256, source: rounded },
  { name: 'icon-384x384.png', size: 384, source: rounded },
  { name: 'icon-512x512.png', size: 512, source: rounded },
  { name: 'icon-maskable-512x512.png', size: 512, source: fullBleed },
  { name: 'apple-touch-icon-120.png', size: 120, source: fullBleed },
  { name: 'apple-touch-icon-152.png', size: 152, source: fullBleed },
  { name: 'apple-touch-icon-167.png', size: 167, source: fullBleed },
  { name: 'apple-touch-icon-180.png', size: 180, source: fullBleed },
];

await mkdir(outDir, { recursive: true });

function render(source, size) {
  return sharp(source, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
}

for (const { name, size, source } of outputs) {
  await writeFile(path.join(outDir, name), await render(source, size));
  console.log(`wrote ${name}`);
}

const favicon = await render(rounded, 48);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(48, 6);
header.writeUInt8(48, 7);
header.writeUInt8(0, 8);
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(favicon.length, 14);
header.writeUInt32LE(22, 18);
await writeFile(path.join(outDir, 'favicon.ico'), Buffer.concat([header, favicon]));
console.log('wrote favicon.ico');
