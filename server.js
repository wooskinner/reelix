import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import compression from 'compression';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Enable gzip/deflate compression for responses
app.use(compression());

// Determine the public directory to serve (prefer 'dist' if it exists)
const publicDir = fs.existsSync(path.join(__dirname, 'dist')) 
  ? path.join(__dirname, 'dist') 
  : __dirname;

console.log(`Serving static files from: ${publicDir}`);

// Serve static assets with optimized caching headers
app.use(express.static(publicDir, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.includes('/icons/') || filePath.endsWith('.woff2')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Fallback to index.html for root path or single-page-like behavior
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start the server binding on host 0.0.0.0 and port 3000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
