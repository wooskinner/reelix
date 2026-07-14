// generate-sitemap.js - Run before deployment
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://reelix.2bd.net';

// Static pages (always indexed)
const staticPages = [
  { url: '/', priority: 1.0, changefreq: 'daily' },
  { url: '/index.html', priority: 1.0, changefreq: 'daily' },
  { url: '/browse.html', priority: 0.9, changefreq: 'daily' },
  { url: '/watch.html', priority: 0.8, changefreq: 'weekly' },
  { url: '/pricing.html', priority: 0.9, changefreq: 'weekly' },
  { url: '/signup.html', priority: 0.9, changefreq: 'weekly' },
  { url: '/activate.html', priority: 0.7, changefreq: 'monthly' },
  { url: '/download.html', priority: 0.7, changefreq: 'monthly' },
];

// Generate sitemap XML
function generateSitemap(pages) {
  const now = new Date().toISOString().split('T')[0];
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">`;

  for (const page of pages) {
    xml += `
  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  }

  // Add dynamic movie/show URLs (from TMDB - example)
  // In production, you'd fetch popular movies from TMDB
  const popularIds = [278, 238, 155, 680, 13, 550, 597, 769];
  for (const id of popularIds) {
    xml += `
  <url>
    <loc>${BASE_URL}/watch.html?id=${id}&type=movie</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
  }

  xml += '\n</urlset>';
  return xml;
}

// Generate sitemap
const sitemap = generateSitemap(staticPages);
fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap);
console.log('✅ Sitemap generated: sitemap.xml');

// Generate robots.txt
const robots = `# https://reelix.2bd.net/robots.txt
User-agent: *
Allow: /
Allow: /index.html
Allow: /browse.html
Allow: /watch.html
Allow: /pricing.html
Allow: /signup.html
Allow: /download.html
Disallow: /activate.html
Disallow: /api/
Disallow: /admin/

Sitemap: ${BASE_URL}/sitemap.xml

# Crawl-delay: 1
Host: ${BASE_URL}
`;

fs.writeFileSync(path.join(__dirname, 'robots.txt'), robots);
console.log('✅ Robots.txt generated: robots.txt');
