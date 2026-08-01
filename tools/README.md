# Image optimization tool

This directory contains a small Node.js utility and guidance for generating responsive, modern-format images for the repo.

Files added in this branch:

- `tools/convert-images.js` — Node script that produces AVIF / WebP / JPEG variants at multiple widths. The script writes output to an `optimized/` folder next to each processed image.

Quick usage

1. Install dev dependencies (sharp):

   ```bash
   npm ci
   # or if you prefer npm install
   npm install --save-dev sharp
   ```

2. Run the optimizer on a file or directory:

   ```bash
   # single file
   npm run optimize:images -- path/to/poster.jpg

   # directory (processes all .jpg/.png/.webp/.avif files inside)
   npm run optimize:images -- icons
   ```

3. The script will create an `optimized/` folder next to the input with files named like `poster-768.webp`, `poster-768.avif`, `poster-768.jpeg`.

Notes and recommendations

- `sharp` is a native module that depends on libvips. Most environments download a prebuilt binary, but some CI systems may require additional build tools.
- After generating images, update markup to use `<picture>` + `srcset` for best browser support and to prefer AVIF/WebP.
- Consider adding a Cloudflare Worker or edge transform to proxy/resize external images (e.g., TMDB) so you can cache and convert them to WebP/AVIF at the edge.

Demo

- A small demo optimized image has been added at `tools/demo/optimized/sample-768.svg` to demonstrate the `optimized/` layout used by the script. This is an SVG placeholder (text-based) included for review; for real optimizations, run the script on your raster images.
