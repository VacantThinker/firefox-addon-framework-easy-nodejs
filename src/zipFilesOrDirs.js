import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

/**
 * zip dist dir => output: current-project-name.zip
 * zipFilesOrDirectorys(null, 'dist');
 *
 * zip all files all dirs, ignore [.git, .idea, node_modules, dist]
 * => output: curret-project-name-ALL.zip
 * zipFilesOrDirectorys(
 * 'ALL',
 * null,
 * {
 * "exclude": ['.git', '.idea', 'node_modules', 'dist'],
 * "suffix": ['.zip']
 * }
 * );
 *
 * @param {string|null} outputAppendName
 * @param {string|null} oneDirectory
 * @param {Object|null} ignoreObj
 * @param {string[]} ignoreObj.exclude
 * @param {string[]} ignoreObj.suffix
 */
export function zipFilesOrDirectorys(
    outputAppendName,
    oneDirectory = null,
    ignoreObj = null,
) {
  // FIX: Use the execution root directory instead of the package directory
  const projectRootDir = process.cwd();
  const basename = path.basename(projectRootDir);

  const arrFilename = [basename];
  if (outputAppendName) {
    arrFilename.push(outputAppendName);
  }

  // Output the zip directly into your project root directory
  const outputPath = path.join(projectRootDir, `${arrFilename.join('-')}.zip`);
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', {
    zlib: {level: 9}, // Sets the compression level.
  });

  output.on('close', () => {
    console.info(`${outputAppendName ||
    'Directory'} zip finished! ${archive.pointer()} total bytes.`);
  });

  archive.on('error', (e) => {
    console.error('Archiver error:', e);
  });

  archive.pipe(output);

  if (oneDirectory) {
    // Zip specific directory
    archive.directory(`${oneDirectory}/`, false);
  }
  else if (ignoreObj) {
    // Scan the project root directory, applying filters
    const files = fs.readdirSync(projectRootDir);
    const {exclude, suffix} = ignoreObj;

    const arrFilter = files
        .filter(name => !exclude.includes(name))
        .filter(name => !suffix.some(value => name.endsWith(value)));

    console.info('Files to zip:', arrFilter);

    arrFilter.forEach(filename => {
      const pathFile = path.join(projectRootDir, filename);
      const stats = fs.lstatSync(pathFile);
      if (stats.isDirectory()) {
        archive.directory(pathFile, filename);
      }
      else if (stats.isFile()) {
        archive.file(pathFile, {name: filename});
      }
    });
  }

  archive.finalize();
  console.info(`${outputAppendName || 'Process'} zip starting...`);
}

/**
 * Zip dist folder
 */
export function zipDist() {
  zipFilesOrDirectorys(null, 'dist');
}

/**
 * Zip all files with default excludes
 *
 *         'exclude': ['.git', '.idea', 'node_modules', 'dist'],
 *         'suffix': ['.zip'],
 */
export function zipALL() {
  zipFilesOrDirectorys(
      'ALL',
      null,
      {
        'exclude': ['.git', '.idea', 'node_modules', 'dist'],
        'suffix': ['.zip'],
      },
  );
}