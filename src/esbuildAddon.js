import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';

/**
 * addons => dist. Builds the Firefox Addon.
 * @param {Object} options
 * @param {boolean} [options.debug=false]
 * @param {string[]} [options.ENTRY_POINTS=[]]
 * @param {string[]} [options.EXCLUDE_LIST=[]]
 */
export function buildAddon({
                             debug = false,
                             ENTRY_POINTS = [],
                             EXCLUDE_LIST = [],
                           } = {}) {
  // 1. Process Configuration
  const minify = !debug;
  const sourcemap = debug;

  const srcDir = path.join(process.cwd(), 'addons');
  const distDir = path.join(process.cwd(), 'dist');

  // 2. Clear the old dist directory
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, {recursive: true, force: true});
  }
  fs.mkdirSync(distDir, {recursive: true});

  // 3. Filter valid Entry Points
  const validEntryPoints = [];

  ENTRY_POINTS.forEach(entry => {
    const fullPath = path.join(srcDir, entry);
    if (fs.existsSync(fullPath)) {
      validEntryPoints.push(fullPath);
    }
    else {
      console.error(
          `⚠️  Warning: Entry point file not found and will be skipped: "${entry}"`);
    }
  });

  // 4. Run Esbuild
  if (validEntryPoints.length > 0) {
    console.log('⚡ Bundling TypeScript/JavaScript modules...');
    esbuild.buildSync({
      entryPoints: validEntryPoints,
      bundle: true,
      minify: minify,
      sourcemap: sourcemap,
      outdir: distDir,
      target: ['firefox100'],
      format: 'esm',
    });
  }
  else {
    console.log('⚡ No valid ENTRY_POINTS found. Skipping Esbuild bundling...');
  }

  // 5. Recursively copy non-JS/TS static assets
  function copyStaticFiles(
      src,
      dest,
  ) {
    const exists = fs.existsSync(src);
    if (!exists) return;

    const stats = fs.statSync(src);
    const isDirectory = stats.isDirectory();

    const relativePath = path.relative(srcDir, src).replace(/\\/g, '/');
    const topLevelName = relativePath.split('/')[0];

    // Exclude logic
    if (relativePath && (EXCLUDE_LIST.includes(relativePath) ||
        EXCLUDE_LIST.includes(topLevelName))) {
      return;
    }

    if (isDirectory) {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, {recursive: true});
      fs.readdirSync(src).forEach((childItemName) => {
        copyStaticFiles(
            path.join(src, childItemName),
            path.join(dest, childItemName),
        );
      });
    }
    else {
      if (src.endsWith('.ts') || src.endsWith('.tsx')) {
        return;
      }

      if (ENTRY_POINTS.includes(relativePath)) {
        return;
      }

      fs.copyFileSync(src, dest);
    }
  }

  console.log('📂 Synchronizing HTML/CSS/Manifest static assets...');
  copyStaticFiles(srcDir, distDir);

  console.log('✨ Firefox Addon built successfully!');
}