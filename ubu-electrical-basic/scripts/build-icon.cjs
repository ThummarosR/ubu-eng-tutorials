/**
 * Render public/icon.svg into build/icon.ico (Windows multi-resolution).
 * Sizes follow the Windows convention: 16, 24, 32, 48, 64, 128, 256.
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;

const ROOT = path.resolve(__dirname, '..');
const SVG = path.join(ROOT, 'public', 'icon.svg');
const OUT_DIR = path.join(ROOT, 'build');
const OUT_ICO = path.join(OUT_DIR, 'icon.ico');
const OUT_PNG_256 = path.join(OUT_DIR, 'icon-256.png');

const SIZES = [16, 24, 32, 48, 64, 128, 256];

async function main() {
  if (!fs.existsSync(SVG)) throw new Error(`Missing ${SVG}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const svg = fs.readFileSync(SVG);
  const buffers = await Promise.all(
    SIZES.map((s) =>
      sharp(svg, { density: 384 })
        .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    ),
  );

  const ico = await pngToIco(buffers);
  fs.writeFileSync(OUT_ICO, ico);
  fs.writeFileSync(OUT_PNG_256, buffers[buffers.length - 1]);
  console.log(`wrote ${OUT_ICO} (${ico.length} bytes, sizes ${SIZES.join(',')})`);
  console.log(`wrote ${OUT_PNG_256}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
