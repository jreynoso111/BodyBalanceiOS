const fs = require('fs');
const path = require('path');

const distRoot = path.join(__dirname, '..', 'dist');

function shouldSkip(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  const baseName = path.basename(normalized);

  if (!normalized.endsWith('.html')) return true;
  if (baseName === 'index.html') return true;
  if (baseName.startsWith('+') || baseName.startsWith('_')) return true;
  if (normalized.includes('[') || normalized.includes(']')) return true;

  return false;
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const relativePath = path.relative(distRoot, fullPath);
    if (shouldSkip(relativePath)) continue;

    const targetDir = fullPath.slice(0, -'.html'.length);
    const targetFile = path.join(targetDir, 'index.html');

    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(fullPath, targetFile);
  }
}

if (fs.existsSync(distRoot)) {
  walk(distRoot);
}
