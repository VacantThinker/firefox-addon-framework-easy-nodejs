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

  // 2. Determine Entry Points & Exclude List
  let ENTRY_POINTS = [...inputEntryPoints];
  let EXCLUDE_LIST = [...inputExcludeList];

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

    // TODO: Add other future default entry points here.
    console.log(`✨ Found ${ENTRY_POINTS.length} default entry points:`, ENTRY_POINTS);
  }

  // 3. Clear the old dist directory
  if (fs.existsSync(distDir)) {
    console.log('🗑️  Clearing old dist directory...');
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // 4. Filter valid Entry Points
  const validEntryPoints = [];

  ENTRY_POINTS.forEach(entry => {
    const fullPath = path.join(srcDir, entry);
    if (fs.existsSync(fullPath)) {
      validEntryPoints.push(fullPath);
    } else {
      console.error(`⚠️  Warning: Entry point file not found and will be skipped: "${entry}"`);
    }
  });

  // 5. Run Esbuild
  if (validEntryPoints.length > 0) {
    console.log('📦 Bundling TypeScript/JavaScript modules with esbuild...');
    esbuild.buildSync({
      entryPoints: validEntryPoints,
      bundle: true,
      minify: minify,
      sourcemap: sourcemap,
      outdir: distDir,
      target: ['firefox100'],
      format: 'esm',
    });
  } else {
    console.log('⏭️  No valid ENTRY_POINTS found. Skipping Esbuild bundling...');
  }

  // 6. Recursively copy and optionally minify non-JS/TS static assets
  async function copyStaticFiles(src, dest) {
    const exists = fs.existsSync(src);
    if (!exists) return;

    const stats = fs.statSync(src);
    const isDirectory = stats.isDirectory();

    const relativePath = path.relative(srcDir, src).replace(/\\/g, '/');
    const topLevelName = relativePath.split('/')[0];

    // Exclude logic
    if (relativePath && (EXCLUDE_LIST.includes(relativePath) || EXCLUDE_LIST.includes(topLevelName))) {
      return;
    }

    if (isDirectory) {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      const items = fs.readdirSync(src);
      // Use for...of to handle async/await properly in loops
      for (const childItemName of items) {
        await copyStaticFiles(
          path.join(src, childItemName),
          path.join(dest, childItemName)
        );
      }
    } else {
      // Do not copy raw TS files to dist
      if (src.endsWith('.ts') || src.endsWith('.tsx')) {
        return;
      }

      // Do not copy JS files that have already been bundled by esbuild
      if (ENTRY_POINTS.includes(relativePath)) {
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
            // Use professional HTML minifier
            const minifiedHTML = await minifyHtml(content, {
              collapseWhitespace: true,
              removeComments: true,
              minifyCSS: true, // Compress inline CSS (<style>)
              minifyJS: true,  // Compress inline JS (<script>)
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