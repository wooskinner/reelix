import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';
import { minify as htmlMinify } from 'html-minifier-terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, 'dist');

// Helper to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function build() {
  console.log('🚀 Starting optimized production build...');

  // 1. Clean and recreate dist folder
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR);

  // 2. Copy directories
  const dirsToCopy = ['icons', 'downloads', '.well-known'];
  for (const dir of dirsToCopy) {
    const srcPath = path.join(__dirname, dir);
    const destPath = path.join(DIST_DIR, dir);
    if (fs.existsSync(srcPath)) {
      copyDir(srcPath, destPath);
      console.log(`📁 Copied directory: ${dir}`);
    }
  }

  // 3. Copy other necessary static assets
  const filesToCopy = ['manifest.json'];
  for (const file of filesToCopy) {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(DIST_DIR, file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`📄 Copied asset: ${file}`);
    }
  }

  // 4. Minify Javascript with esbuild
  const jsFiles = ['app-main.js', 'firebase-init.js', 'subscription-cache.js', 'sw.js'];
  for (const file of jsFiles) {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(DIST_DIR, file);
    if (fs.existsSync(srcPath)) {
      await esbuild.build({
        entryPoints: [srcPath],
        outfile: destPath,
        minify: true,
        bundle: false,
        format: 'esm',
        target: 'es2020',
        allowOverwrite: true,
      });
      const origSize = fs.statSync(srcPath).size;
      const minSize = fs.statSync(destPath).size;
      const savings = ((origSize - minSize) / origSize * 100).toFixed(1);
      console.log(`⚡ Minified JS: ${file} (${(origSize / 1024).toFixed(1)} KB -> ${(minSize / 1024).toFixed(1)} KB, -${savings}%)`);
    }
  }

  // 5. Minify CSS with esbuild
  const cssFiles = ['styles.css'];
  for (const file of cssFiles) {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(DIST_DIR, file);
    if (fs.existsSync(srcPath)) {
      await esbuild.build({
        entryPoints: [srcPath],
        outfile: destPath,
        minify: true,
        allowOverwrite: true,
      });
      const origSize = fs.statSync(srcPath).size;
      const minSize = fs.statSync(destPath).size;
      const savings = ((origSize - minSize) / origSize * 100).toFixed(1);
      console.log(`🎨 Minified CSS: ${file} (${(origSize / 1024).toFixed(1)} KB -> ${(minSize / 1024).toFixed(1)} KB, -${savings}%)`);
    }
  }

  // 6. Minify HTML files with html-minifier-terser
  const htmlFiles = [
    'index.html',
    'browse.html',
    'signup.html',
    'pricing.html',
    'watch.html',
    'activate.html',
    'download.html'
  ];

  for (const file of htmlFiles) {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(DIST_DIR, file);
    if (fs.existsSync(srcPath)) {
      const htmlContent = fs.readFileSync(srcPath, 'utf8');
      try {
        const minifiedHtml = await htmlMinify(htmlContent, {
          collapseWhitespace: true,
          removeComments: true,
          minifyCSS: true,
          minifyJS: true,
          removeAttributeQuotes: false, // keep attribute quotes for standard conformity
          removeRedundantAttributes: true,
          useShortDoctype: true,
        });
        fs.writeFileSync(destPath, minifiedHtml, 'utf8');
        const origSize = fs.statSync(srcPath).size;
        const minSize = fs.statSync(destPath).size;
        const savings = ((origSize - minSize) / origSize * 100).toFixed(1);
        console.log(`📝 Minified HTML: ${file} (${(origSize / 1024).toFixed(1)} KB -> ${(minSize / 1024).toFixed(1)} KB, -${savings}%)`);
      } catch (err) {
        console.warn(`⚠️ HTML Minification failed for ${file}, falling back to direct copy. Error:`, err.message);
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  console.log('✨ Optimized production build completed successfully!');
}

build().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
