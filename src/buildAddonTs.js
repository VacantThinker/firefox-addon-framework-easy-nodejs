import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import esbuild from 'esbuild';
import { minify as minifyHtml } from 'html-minifier-terser';

/**
 * Builds the Firefox Addon with TypeScript support.
 * Source: addons/ => Target: dist/
 * @param {Object} options
 * @param {boolean} [options.debug=false]
 */
export async function buildAddonTs({ debug = false } = {}) {
  const minify = !debug;
  const sourcemap = debug;

  const srcDir = path.join(process.cwd(), 'addons');
  const distDir = path.join(process.cwd(), 'dist');
  const normalizePath = (p) => p.replace(/\\/g, '/');

  let ENTRY_POINTS = [];
  let EXCLUDE_LIST = ['userSettings.json'];

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

  const hasTsFiles = allFiles.some(fullPath => /\.(ts|tsx)$/.test(fullPath));

  if (hasTsFiles) {
    console.log('Running TypeScript type check (tsc --noEmit)...');
    try {
      execSync('npx tsc --noEmit', { stdio: 'inherit' });
    } catch (err) {
      console.error('TypeScript compilation or type safety check failed. Aborting build.');
      process.exit(1);
    }
  } else {
    console.log('No TypeScript files detected. Skipping type check.');
  }

  allFiles.forEach(fullPath => {
    const relativePath = normalizePath(path.relative(srcDir, fullPath));
    const isCodeFile = /\.(js|jsx|ts|tsx)$/.test(relativePath);

    if (isCodeFile) {
      const isBackground = /^background\.(js|ts)$/.test(relativePath);
      const isPages = relativePath.startsWith('pages/');
      const isContentJs = relativePath.startsWith('contentjs/');

      if (isBackground || isPages || isContentJs) {
        ENTRY_POINTS.push(fullPath);
      }
      EXCLUDE_LIST.push(relativePath);
    }
  });

  EXCLUDE_LIST = [...new Set(EXCLUDE_LIST)];

  if (fs.existsSync(distDir)) {
    console.log('Cleaning old dist directory...');
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

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
    console.log('No JS/TS entry points found. Proceeding with static assets only.');
  }

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
  console.log('Firefox Addon TS build completed successfully.');
}