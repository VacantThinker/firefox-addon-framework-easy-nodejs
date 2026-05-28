
import {createRequire} from 'module';
import path from 'path';

/**
 * addons => dist. Builds the Firefox Addon.
 * * @param {Object} options
 * @param {boolean} options.debug - If true, enables sourcemaps and disables minification.
 * @param {string[]} options.ENTRY_POINTS - Array of entry points relative to the source directory.
 * @param {string[]} options.EXCLUDE_LIST - Array of top-level directories/files to exclude.
 */
export function buildAddon(options = {}) {
  const require = createRequire(import.meta.url);
  const fs = require('fs');
  const esbuild = require('esbuild');

  // 1. Process Parameters
  const debug = options.debug || false; // Defaults to false [cite: 4]
  const ENTRY_POINTS = options.ENTRY_POINTS || [];
  const EXCLUDE_LIST = options.EXCLUDE_LIST || [];

  const minify = !debug;
  const sourcemap = debug;

  // Resolve directories based on the caller's working directory, not the package's directory
  const srcDir = path.join(process.cwd(), 'addons');
  const distDir = path.join(process.cwd(), 'dist');

  // 2. Clear the old dist directory before each build [cite: 6]
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // 3. Run Esbuild only if ENTRY_POINTS exist
  if (ENTRY_POINTS.length > 0) {
    console.log('⚡ Bundling JavaScript modules...');
    esbuild.buildSync({
      entryPoints: ENTRY_POINTS.map(entry => path.join(srcDir, entry)),
      bundle: true,
      minify: minify,
      sourcemap: sourcemap,
      outdir: distDir,
      target: ['firefox100'],
    }); // [cite: 8]
  } else {
    console.log('⚡ No ENTRY_POINTS provided. Skipping Esbuild bundling...');
  }

  // 4. Recursively copy non-JS static assets (HTML, CSS, JSON, Images) [cite: 9]
  function copyStaticFiles(src, dest) {
    const exists = fs.existsSync(src);
    if (!exists) return;

    const stats = fs.statSync(src); // [cite: 10]
    const isDirectory = stats.isDirectory();

    // Normalize the current relative path from 'addons' root [cite: 11]
    const relativePath = path.relative(srcDir, src).replace(/\\/g, '/');
    const topLevelName = relativePath.split('/')[0];

    // Rule A: Skip if the path belongs to an item in the EXCLUDE_LIST [cite: 12]
    if (relativePath && EXCLUDE_LIST.includes(topLevelName)) {
      return;
    }

    if (isDirectory) {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true }); // [cite: 13]
      fs.readdirSync(src).forEach((childItemName) => {
        copyStaticFiles(
            path.join(src, childItemName),
            path.join(dest, childItemName)
        );
      }); // [cite: 14]
    } else {
      // Rule B: Skip if the file matches one of your ENTRY_POINTS to protect Esbuild output [cite: 15]
      if (ENTRY_POINTS.includes(relativePath)) {
        return;
      }
      fs.copyFileSync(src, dest); // [cite: 16]
    }
  }

  console.log('📂 Synchronizing HTML/CSS/Manifest static assets...');
  copyStaticFiles(srcDir, distDir);

  console.log('✨ Firefox Addon built successfully! Load the "/dist" directory in Firefox to test.'); // [cite: 17]
}
