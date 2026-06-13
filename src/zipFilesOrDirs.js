import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

/**
 * 核心改造：包装成 Promise，交由外部 await 控制流
 */
export function zipFilesOrDirectorys(
  outputAppendName,
  oneDirectory = null,
  ignoreObj = null,
) {
  // 🔥 1. 返回一个 Promise
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

    // 🔥 2. 当文件流真正关闭（硬盘写入完成）时，才触发 resolve()
    output.on('close', () => {
      console.info(`${outputAppendName || 'Directory'} zip finished! ${archive.pointer()} total bytes.`);
      resolve();
    });

    // 🔥 3. 发生错误时触发 reject
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
 * 🔥 4. 关键：必须加上 return 关键字！
 */
export function zipDist() {
  return zipFilesOrDirectorys(null, 'dist');
}

/**
 * 🔥 5. 关键：必须加上 return 关键字！
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