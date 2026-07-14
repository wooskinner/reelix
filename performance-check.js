// performance-check.js - Local performance monitoring
const fs = require('fs');
const path = require('path');

// Performance Budgets (in milliseconds)
const BUDGETS = {
  lcp: 2500,        // Largest Contentful Paint
  fcp: 1800,        // First Contentful Paint
  tti: 3500,        // Time to Interactive
  tbt: 300,         // Total Blocking Time
  cls: 0.1,         // Cumulative Layout Shift
  bundleSize: {
    css: 50000,     // 50KB
    js: 200000,     // 200KB
    html: 40000,    // 40KB
  }
};

// Check file sizes
function checkBundleSizes() {
  console.log('\n📦 Checking bundle sizes...');
  
  const files = [
    { path: 'styles.css', max: BUDGETS.bundleSize.css },
    { path: 'app-main.js', max: BUDGETS.bundleSize.js },
    { path: 'firebase-init.js', max: BUDGETS.bundleSize.js },
    { path: 'index.html', max: BUDGETS.bundleSize.html },
  ];
  
  let passed = true;
  for (const file of files) {
    try {
      const stats = fs.statSync(path.join(__dirname, file.path));
      const sizeKB = (stats.size / 1024).toFixed(2);
      const maxKB = (file.max / 1024).toFixed(2);
      
      if (stats.size > file.max) {
        console.log(`❌ ${file.path}: ${sizeKB}KB (exceeds ${maxKB}KB)`);
        passed = false;
      } else {
        console.log(`✅ ${file.path}: ${sizeKB}KB (budget: ${maxKB}KB)`);
      }
    } catch (e) {
      console.log(`⚠️ ${file.path}: not found`);
    }
  }
  
  return passed;
}

// Generate performance report
function generateReport() {
  const report = {
    timestamp: new Date().toISOString(),
    budgets: BUDGETS,
    checks: {
      bundleSizes: checkBundleSizes(),
    }
  };
  
  fs.writeFileSync(
    path.join(__dirname, 'performance-report.json'),
    JSON.stringify(report
