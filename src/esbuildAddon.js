import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import { minify as minifyHtml } from 'html-minifier-terser';

/**
 * addons => dist. Builds the Firefox Addon.
 * @param {Object} options
 * @param {boolean} [options.debug=false]
 * @param {string[]} [options.ENTRY_POINTS=[]]
 * @param {string[]} [options.EXCLUDE_LIST=[]]
 */
export async function buildAddon(
  {
    debug = false,
    ENTRY_POINTS: inputEntryPoints = [],
    EXCLUDE_LIST: inputExcludeList = [],
  } = {}) {
  // 1. Process Configuration
  const minify = !debug;
  const sourcemap = debug;

  const srcDir = path.join(process.cwd(), 'addons');
  const distDir = path.join(process.cwd(), 'dist');

  // Normalize paths to ensure cross-platform compatibility (e.g., Windows '\\' to '/')
  const normalizePath = (p) => p.replace(/\\/g, '/');

  // 2. Determine Entry Points & Exclude List
  let ENTRY_POINTS = inputEntryPoints.map(normalizePath);
  let EXCLUDE_LIST = inputExcludeList.map(normalizePath);

  if (EXCLUDE_LIST.length === 0) {
    EXCLUDE_LIST = ['src', 'userSettings.json'];
    console.log('🔍 EXCLUDE_LIST is empty. Using default exclusions:', EXCLUDE_LIST);
  }

  if (ENTRY_POINTS.length === 0 && fs.existsSync(srcDir)) {
    console.log('🔍 ENTRY_POINTS is empty. Using default entry points...');

    if (fs.existsSync(path.join(srcDir, 'background.js'))) {
      ENTRY_POINTS.push('background.js');
    }

    const pagesDir = path.join(srcDir, 'pages');
    if (fs.existsSync(pagesDir)) {
      const scanPages = (dir, prefix) => {
        let results = [];
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            results = results.concat(scanPages(fullPath, `${prefix}${item}/`));
          } else if (/\.(js|ts|tsx)$/.test(item)) {
            results.push(`${prefix}${item}`);
          }
        }
        return results;
      };

      const pageFiles = scanPages(pagesDir, 'pages/');
      ENTRY_POINTS = ENTRY_POINTS.concat(pageFiles);
    }

    console.log(`✨ Found ${ENTRY_POINTS.length} default entry points:`, ENTRY_POINTS);
  }

  // 3. Unify Exclusions (Crucial step: Add entry points to exclude list)
  // This prevents the static file copier from overwriting the esbuild bundles with raw source files.
  EXCLUDE_LIST = [...new Set([...EXCLUDE_LIST, ...ENTRY_POINTS])];

  // 4. Clear the old dist directory
  if (fs.existsSync(distDir)) {
    console.log('🗑️  Clearing old dist directory...');
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // 5. Filter valid Entry Points
  const validEntryPoints = [];

  ENTRY_POINTS.forEach(entry => {
    // Join with standard path resolving
    const fullPath = path.join(srcDir, entry);
    if (fs.existsSync(fullPath)) {
      validEntryPoints.push(fullPath);
    } else {
      console.error(`⚠️  Warning: Entry point file not found and will be skipped: "${entry}"`);
    }
  });

  // 6. Run Esbuild
  if (validEntryPoints.length > 0) {
    console.log('📦 Bundling TypeScript/JavaScript modules with esbuild...');
    esbuild.buildSync({
      entryPoints: validEntryPoints,
      bundle: true,
      minify: minify,
      sourcemap: sourcemap,
      outdir: distDir,
      outbase: srcDir, // CRITICAL FIX: Preserves strict folder structure even if all entry points are deep in subfolders
      target: ['firefox100'],
      format: 'esm',
    });
  } else {
    console.log('⏭️  No valid ENTRY_POINTS found. Skipping Esbuild bundling...');
  }

  // 7. Recursively copy and optionally minify non-JS/TS static assets
  async function copyStaticFiles(src, dest) {
    const exists = fs.existsSync(src);
    if (!exists) return;

    const stats = fs.statSync(src);
    const isDirectory = stats.isDirectory();

    const relativePath = normalizePath(path.relative(srcDir, src));
    const topLevelName = relativePath.split('/')[0];

    // Unified Exclude logic (Now includes ENTRY_POINTS automatically)
    if (relativePath && (EXCLUDE_LIST.includes(relativePath) || EXCLUDE_LIST.includes(topLevelName))) {
      return;
    }

    if (isDirectory) {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      const items = fs.readdirSync(src);
      for (const childItemName of items) {
        await copyStaticFiles(
          path.join(src, childItemName),
          path.join(dest, childItemName)
        );
      }
    } else {
      // Still prevent copying raw uncompiled TS files globally
      if (src.endsWith('.ts') || src.endsWith('.tsx')) {
        return;
      }

      // Process HTML and JSON minification if debug is false
      if (minify) {
        if (src.endsWith('.json')) {
          try {
            const content = fs.readFileSync(src, 'utf-8');
            const minifiedJSON = JSON.stringify(JSON.parse(content));
            fs.writeFileSync(dest, minifiedJSON, 'utf-8');
            return;
          } catch (err) {
            console.error(`⚠️  Failed to minify JSON: ${relativePath}`, err.message);
          }
        } else if (src.endsWith('.html') || src.endsWith('.htm')) {
          try {
            const content = fs.readFileSync(src, 'utf-8');
            const minifiedHTML = await minifyHtml(content, {
              collapseWhitespace: true,
              removeComments: true,
              minifyCSS: true,
              minifyJS: true,
              removeRedundantAttributes: true,
              removeScriptTypeAttributes: true,
              removeStyleLinkTypeAttributes: true,
              useShortDoctype: true
            });
            fs.writeFileSync(dest, minifiedHTML, 'utf-8');
            return;
          } catch (err) {
            console.error(`⚠️  Failed to minify HTML: ${relativePath}`, err.message);
          }
        }
      }

      // Direct copy for CSS, images, and unminified environments
      fs.copyFileSync(src, dest);
    }
  }

  console.log('🔄 Synchronizing and processing HTML/CSS/Manifest static assets...');
  await copyStaticFiles(srcDir, distDir);

  console.log('🚀 Firefox Addon built successfully!');
}