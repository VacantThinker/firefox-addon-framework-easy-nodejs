import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import { minify as minifyHtml } from 'html-minifier-terser';

/**
 * Builds the Firefox Addon.
 * Source: addons/ => Target: dist/
 * @param {Object} options
 * @param {boolean} [options.debug=false]
 */
export async function buildAddon({ debug = false } = {}) {
  const minify = !debug;
  const sourcemap = debug;

  const srcDir = path.join(process.cwd(), 'addons');
  const distDir = path.join(process.cwd(), 'dist');

  // Normalize paths for cross-platform compatibility
  const normalizePath = (p) => p.replace(/\\/g, '/');

  let ENTRY_POINTS = [];
  let EXCLUDE_LIST = ['userSettings.json'];

  // 1. Scan all files recursively to map the structure
  const scanDirectory = (dir) => {
    let results = [];
    if (!fs.existsSync(dir)) return results;

    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        results = results.concat(scanDirectory(fullPath));
      } else {
        results.push(fullPath);
      }
    }
    return results;
  };

  const allFiles = scanDirectory(srcDir);

  // 2. Classify entry points and exclude internal source files
  allFiles.forEach(fullPath => {
    const relativePath = normalizePath(path.relative(srcDir, fullPath));
    const isCodeFile = /\.(js|ts|tsx)$/.test(relativePath);

    if (isCodeFile) {
      // Only background.js and items under pages/ are entry points
      if (relativePath === 'background.js' || relativePath.startsWith('pages/')) {
        ENTRY_POINTS.push(fullPath);
      }
      // All raw source files are excluded from static copying
      EXCLUDE_LIST.push(relativePath);
    }
  });

  EXCLUDE_LIST = [...new Set(EXCLUDE_LIST)];

  // 3. Clean up old build artifacts
  if (fs.existsSync(distDir)) {
    console.log('Cleaning old dist directory...');
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // 4. Run Esbuild bundling
  if (ENTRY_POINTS.length > 0) {
    console.log(`Found ${ENTRY_POINTS.length} entry points. Bundling with esbuild...`);
    esbuild.buildSync({
      entryPoints: ENTRY_POINTS,
      bundle: true,
      minify: minify,
      sourcemap: sourcemap,
      outdir: distDir,
      outbase: srcDir,
      target: ['firefox100'],
      format: 'esm',
    });
  } else {
    console.log('Warning: No valid entry points found for bundling.');
  }

  // 5. Sync static assets safely without leaving empty directories
  async function copyStaticFiles(src, dest) {
    if (!fs.existsSync(src)) return;

    const stats = fs.statSync(src);
    const isDirectory = stats.isDirectory();
    const relativePath = normalizePath(path.relative(srcDir, src));

    if (relativePath && EXCLUDE_LIST.includes(relativePath)) {
      return;
    }

    if (isDirectory) {
      const items = fs.readdirSync(src);
      for (const childItemName of items) {
        await copyStaticFiles(
          path.join(src, childItemName),
          path.join(dest, childItemName)
        );
      }
    } else {
      // CRITICAL FIX: Create the destination directory strictly on-demand
      // right before writing an actual valid asset file.
      const parentDir = path.dirname(dest);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      if (minify) {
        if (src.endsWith('.json')) {
          try {
            const content = fs.readFileSync(src, 'utf-8');
            const minifiedJSON = JSON.stringify(JSON.parse(content));
            fs.writeFileSync(dest, minifiedJSON, 'utf-8');
            return;
          } catch (err) {
            console.error(`Failed to minify JSON: ${relativePath}`, err.message);
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
            console.error(`Failed to minify HTML: ${relativePath}`, err.message);
          }
        }
      }

      fs.copyFileSync(src, dest);
    }
  }

  console.log('Synchronizing static assets...');
  await copyStaticFiles(srcDir, distDir);

  console.log('Firefox Addon build completed successfully.');
}