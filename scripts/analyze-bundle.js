#!/usr/bin/env node

/**
 * Bundle analysis script for performance optimization
 */

const fs = require('fs');
const path = require('path');

// Simple bundle analyzer
function analyzeBundleSize() {
  const distPath = path.join(__dirname, '../dist');
  
  if (!fs.existsSync(distPath)) {
    console.log('❌ No dist folder found. Run `npm run build` first.');
    return;
  }

  console.log('📊 Bundle Analysis Report\n');
  console.log('=' .repeat(50));

  const files = fs.readdirSync(distPath, { recursive: true });
  const jsFiles = files.filter(file => file.endsWith('.js'));
  const cssFiles = files.filter(file => file.endsWith('.css'));
  
  let totalSize = 0;
  const chunks = [];

  // Analyze JavaScript files
  console.log('\n📦 JavaScript Chunks:');
  jsFiles.forEach(file => {
    const filePath = path.join(distPath, file);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    totalSize += stats.size;
    
    chunks.push({
      name: file,
      size: stats.size,
      sizeKB: parseFloat(sizeKB),
      type: 'js'
    });
    
    console.log(`  ${file}: ${sizeKB} KB`);
  });

  // Analyze CSS files
  console.log('\n🎨 CSS Files:');
  cssFiles.forEach(file => {
    const filePath = path.join(distPath, file);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    totalSize += stats.size;
    
    chunks.push({
      name: file,
      size: stats.size,
      sizeKB: parseFloat(sizeKB),
      type: 'css'
    });
    
    console.log(`  ${file}: ${sizeKB} KB`);
  });

  // Summary
  console.log('\n📈 Summary:');
  console.log(`  Total Bundle Size: ${(totalSize / 1024).toFixed(2)} KB`);
  console.log(`  JavaScript: ${chunks.filter(c => c.type === 'js').reduce((sum, c) => sum + c.sizeKB, 0).toFixed(2)} KB`);
  console.log(`  CSS: ${chunks.filter(c => c.type === 'css').reduce((sum, c) => sum + c.sizeKB, 0).toFixed(2)} KB`);

  // Recommendations
  console.log('\n💡 Optimization Recommendations:');
  
  const largeChunks = chunks.filter(c => c.sizeKB > 500);
  if (largeChunks.length > 0) {
    console.log('  ⚠️  Large chunks detected (>500KB):');
    largeChunks.forEach(chunk => {
      console.log(`    - ${chunk.name}: ${chunk.sizeKB} KB`);
    });
    console.log('    Consider code splitting or lazy loading');
  }

  if (totalSize > 1024 * 1024) { // 1MB
    console.log('  ⚠️  Total bundle size is large (>1MB)');
    console.log('    Consider implementing more aggressive code splitting');
  }

  const vendorChunks = chunks.filter(c => c.name.includes('vendor'));
  if (vendorChunks.length === 0) {
    console.log('  ✅ Consider creating vendor chunks for better caching');
  }

  console.log('\n🚀 Performance Tips:');
  console.log('  - Use lazy loading for non-critical components');
  console.log('  - Implement code splitting at route level');
  console.log('  - Optimize images and assets');
  console.log('  - Enable gzip compression on server');
  console.log('  - Use tree shaking to remove unused code');
}

// Run analysis
analyzeBundleSize();