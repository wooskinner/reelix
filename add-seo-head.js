// add-seo-head.js - Add SEO head to all HTML files
const fs = require('fs');
const path = require('path');

const SEO_HEAD = `
    <!-- SEO HEAD -->
    <title>Reelix - Stream Movies, TV Shows & African Originals</title>
    <meta name="title" content="Reelix - Stream Movies, TV Shows & African Originals">
    <meta name="description" content="Watch unlimited movies, TV shows, and African originals. Start your 7-day free trial. No credit card required.">
    <meta name="keywords" content="movies, streaming, TV shows, African movies, Nollywood, watch online, free trial">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://reelix.2bd.net/">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://reelix.2bd.net/">
    <meta property="og:title" content="Reelix - Stream Movies, TV Shows & African Originals">
    <meta property="og:description" content="Watch unlimited movies, TV shows, and African originals. Start your 7-day free trial.">
    <meta property="og:image" content="https://reelix.2bd.net/icons/og-image.jpg">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="https://reelix.2bd.net/">
    <meta name="twitter:title" content="Reelix - Stream Movies, TV Shows & African Originals">
    <meta name="twitter:description" content="Watch unlimited movies, TV shows, and African originals. Start your 7-day free trial.">
    <meta name="twitter:image" content="https://reelix.2bd.net/icons/og-image.jpg">
    <!-- END SEO HEAD -->
`;

const pages = [
    'index.html',
    'browse.html',
    'watch.html',
    'pricing.html',
    'signup.html',
    'download.html',
    'activate.html'
];

for (const page of pages) {
    const filepath = path.join(__dirname, page);
    if (!fs.existsSync(filepath)) {
        console.log(`⚠️ ${page} not found, skipping...`);
        continue;
    }
    
    let content = fs.readFileSync(filepath, 'utf8');
    
    // Check if SEO head already exists
    if (content.includes('<!-- SEO HEAD -->')) {
        console.log(`✅ ${page} already has SEO head`);
        continue;
    }
    
    // Insert after <head> tag
    content = content.replace(
        /<head>/,
        `<head>\n${SEO_HEAD}`
    );
    
    fs.writeFileSync(filepath, content);
    console.log(`✅ Added SEO head to ${page}`);
}
