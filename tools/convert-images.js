#!/usr/bin/env node
/**
 * tools/convert-images.js
 *
 * Simple Node script (uses sharp) to generate responsive WebP/AVIF/JPEG images
 * for each input file. Usage:
 *   npm install --save-dev sharp
 *   node tools/convert-images.js path/to/image1.jpg path/to/image2.png
 *
 * Output: input directory /optimized/ with files like image-320.webp, image-768.avif, etc.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sizes = [320, 480, 768, 1024, 1366, 1920];
const formats = ['avif', 'webp', 'jpeg']; // order matters: avif preferred, then webp, then jpeg

async function processFile(file) {
  const input = file;
  if (!fs.existsSync(input)) {
    console.error(`File not found: ${input}`);
    return;
  }
  const dir = path.dirname(input);
  const base = path.basename(input, path.extname(input)).replace(/\s+/g, '-').toLowerCase();
  const outdir = path.join(dir, 'optimized');
  if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true });

  for (const w of sizes) {
    for (const fmt of formats) {
      const out = path.join(outdir, `${base}-${w}.${fmt}`);
      try {
        const pipeline = sharp(input).resize({ width: w, withoutEnlargement: true });
        if (fmt === 'webp') {
          await pipeline.webp({ quality: 80 }).toFile(out);
        } else if (fmt === 'avif') {
          await pipeline.avif({ quality: 50 }).toFile(out);
        } else if (fmt === 'jpeg') {
          await pipeline.jpeg({ quality: 82 }).toFile(out);
        }
        console.log(`Wrote ${out}`);
      } catch (err) {
        console.error(`Error processing ${input} -> ${out}:`, err.message || err);
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Usage: node tools/convert-images.js file1.jpg [file2.png ...]');
    process.exit(1);
  }
  for (const f of args) {
    // expand directories (process all common image extensions inside)
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
      const files = fs.readdirSync(f).filter(fn => /\.(jpe?g|png|tiff?|webp|avif)$/i.test(fn));
      for (const fn of files) await processFile(path.join(f, fn));
    } else {
      await processFile(f);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
