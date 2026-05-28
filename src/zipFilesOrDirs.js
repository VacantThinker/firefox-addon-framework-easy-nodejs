/**
 *
 * // zip dist dir => output: current-project-name.zip
 * zipFilesOrDirectorys(null, 'dist');
 *
 *
 *
 * // zip all files all dirs , ignore [.git, .idea, node_modules, dist]
 *      => output: curret-project-name-ALL.zip
 * zipFilesOrDirectorys(
 *     'ALL',
 *     null,
 *     {
 *         "exclude": ['.git', '.idea', 'node_modules', 'dist'],
 *         "suffix": ['.zip']
 *     }
 * );
 *
 * @param outputAppendName{string|null}
 * @param oneDirecoty{string|null}
 * @param ignoreObj{{
 *   exclude: [string],
 *   suffix: [string]
 * }|null}
 */

import {createRequire} from 'module';
import path from 'path';

export function zipFilesOrDirectorys(
    outputAppendName,
    oneDirecoty = null,
    ignoreObj = null) {

    const require = createRequire(import.meta.url);
    const fs = require('fs');
    const archiver = require('archiver');

    // FIX: Use the execution root directory instead of the package directory
    const projectRootDir = process.cwd();
    const basename = path.basename(projectRootDir);

    const arrFilename = Array.from([basename]);
    if (outputAppendName) {
        arrFilename.push(outputAppendName);
    }

    // Output the zip directly into your project root directory
    const output = fs.createWriteStream(path.join(projectRootDir, `${arrFilename.join('-')}.zip`));
    const archive = archiver('zip');

    output.on('close', () => {
        console.info(`${outputAppendName} zip finish!`);
    });
    archive.on('error', (e) => {
        console.info('e=', e);
    });

    archive.pipe(output);

    if (oneDirecoty) {
        archive.directory(`${oneDirecoty}/`, false);
    } else if (ignoreObj) {
        // Scan the project root directory, not node_modules
        let strings = fs.readdirSync(projectRootDir);

        let {exclude, suffix} = ignoreObj;
        let arrFilter = strings
            .filter(name => !exclude.includes(name))
            .filter(name => !suffix.some(value => name.endsWith(value)));

        console.info('arrFilter=', arrFilter);

        arrFilter.forEach(filename => {
            let pathFile = path.join(projectRootDir, filename);
            let stats = fs.lstatSync(pathFile);
            if (stats.isDirectory()) {
                archive.directory(pathFile, filename);
            } else if (stats.isFile()) {
                archive.file(pathFile, {name: filename});
            }
        });
    }

    archive.finalize();
    console.info(`${outputAppendName} zip starting`);
}


/**
 * zipFilesOrDirectorys(null, 'dist');
 *
 */
export function zipDist() {
    zipFilesOrDirectorys(null, 'dist');

}

/**
 * zipFilesOrDirectorys(
 *         'ALL',
 *         null,
 *         {
 *             "exclude": ['.git', '.idea', 'node_modules', 'dist'],
 *             "suffix": ['.zip']
 *         }
 *     );
 */
export function zipALL() {
    zipFilesOrDirectorys(
        'ALL',
        null,
        {
            "exclude": ['.git', '.idea', 'node_modules', 'dist'],
            "suffix": ['.zip']
        }
    );
}

