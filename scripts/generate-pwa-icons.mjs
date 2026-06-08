import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const source = path.join(root, 'xd-logo.png');
const outDir = path.join(root, 'public');

const sizes = [
  { name: 'favicon-32.png', size: 32 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-256x256.png', size: 256 },
  { name: 'icon-384x384.png', size: 384 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'apple-touch-icon-120.png', size: 120 },
  { name: 'apple-touch-icon-152.png', size: 152 },
  { name: 'apple-touch-icon-167.png', size: 167 },
  { name: 'apple-touch-icon-180.png', size: 180 },
];

await mkdir(outDir, { recursive: true });

for (const { name, size } of sizes) {
  const target = path.join(outDir, name);
  await sharp(source)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 9 })
    .toFile(target);
  console.log(`wrote ${name}`);
}

// Multi-size favicon.ico substitute: keep a copy of the source in public for reference
await sharp(source)
  .resize(512, 512, { fit: 'cover', position: 'centre' })
  .png({ compressionLevel: 9 })
  .toFile(path.join(outDir, 'xd-logo.png'));

console.log('PWA icons generated from xd-logo.png');
