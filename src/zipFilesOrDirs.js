import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

/**
 */
export function zipFilesOrDirectorys(
  outputAppendName,
  oneDirectory = null,
  ignoreObj = null,
) {
  return new Promise((resolve, reject) => {
    const projectRootDir = process.cwd();
    const basename = path.basename(projectRootDir);

    const arrFilename = [basename];
    if (outputAppendName) {
      arrFilename.push(outputAppendName);
    }

    const outputPath = path.join(projectRootDir, `${arrFilename.join('-')}.zip`);
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    output.on('close', () => {
      console.info(`${outputAppendName || 'Directory'} zip finished! ${archive.pointer()} total bytes.`);
      resolve();
    });

    archive.on('error', (e) => {
      console.error('Archiver error:', e);
      reject(e);
    });

    archive.pipe(output);

    if (oneDirectory) {
      archive.directory(`${oneDirectory}/`, false);
    }
    else if (ignoreObj) {
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
  });
}

/**
 */
export function zipDist() {
  return zipFilesOrDirectorys(null, 'dist');
}

/**
 */
export function zipALL() {
  return zipFilesOrDirectorys(
    'ALL',
    null,
    {
      'exclude': ['.git', '.idea', 'node_modules', 'dist'],
      'suffix': ['.zip'],
    },
  );
}