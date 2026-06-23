import fs from 'fs';
import path from 'path';
import { ZipArchive } from 'archiver';

export interface ZipIgnoreOptions {
  exclude: string[];
  suffix: string[];
}

/**
 * Compresses directories or files into a production zip package.
 */
export function zipFilesOrDirectorys(
  outputAppendName: string | null,
  oneDirectory: string | null = null,
  ignoreObj: ZipIgnoreOptions | null = null,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const projectRootDir: string = process.cwd();
    const basename: string = path.basename(projectRootDir);

    const arrFilename: string[] = [basename];
    if (outputAppendName) {
      arrFilename.push(outputAppendName);
    }

    const outputPath: string = path.join(projectRootDir, `${arrFilename.join('-')}.zip`);
    const output: fs.WriteStream = fs.createWriteStream(outputPath);

    const archive = new ZipArchive({
      zlib: { level: 9 },
    });

    output.on('close', () => {
      console.info(`${outputAppendName || 'Directory'} zip finished! ${archive.pointer()} total bytes.`);
      resolve();
    });

    archive.on('error', (e: Error) => {
      console.error('Archiver error:', e);
      reject(e);
    });

    archive.pipe(output);

    if (oneDirectory) {
      archive.directory(`${oneDirectory}/`, false);
    }
    else if (ignoreObj) {
      const files: string[] = fs.readdirSync(projectRootDir);
      const { exclude, suffix } = ignoreObj;

      const arrFilter: string[] = files
        .filter(name => !exclude.includes(name))
        .filter(name => !suffix.some(value => name.endsWith(value)));

      console.info('Files to zip:', arrFilter);

      arrFilter.forEach(filename => {
        const pathFile: string = path.join(projectRootDir, filename);
        const stats: fs.Stats = fs.lstatSync(pathFile);
        if (stats.isDirectory()) {
          archive.directory(pathFile, filename);
        }
        else if (stats.isFile()) {
          archive.file(pathFile, { name: filename });
        }
      });
    }

    archive.finalize();
    console.info(`${outputAppendName || 'Process'} zip starting...`);
  });
}

/**
 * Packages the build distribution artifacts.
 */
export function zipDist(): Promise<void> {
  return zipFilesOrDirectorys(null, 'dist');
}

/**
 * Packages the whole workspace excluding system/environment files.
 */
export function zipALL(): Promise<void> {
  return zipFilesOrDirectorys(
    'ALL',
    null,
    {
      exclude: ['.git', '.idea', 'node_modules', 'dist'],
      suffix: ['.zip'],
    },
  );
}