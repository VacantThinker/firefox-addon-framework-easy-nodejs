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
export function zipFilesOrDirectorys(
    outputAppendName,
    oneDirecoty = null,
    ignoreObj = null) {

    const archiver = require('archiver')
    const fs = require('fs')
    const path = require('path')
    const basename = path.basename(__dirname)

    const arrFilename = Array.from([basename])
    if (outputAppendName) {
        arrFilename.push(outputAppendName)
    }
    const output = fs.createWriteStream(path.join(__dirname, `${arrFilename.join('-')}.zip`))
    const archive = archiver('zip')
    output.on('close', () => {
        console.info(`${outputAppendName} zip finish!`)
    })
    archive.on('error', (e) => {
        console.info('e=');
        console.info(e);
    })

    archive.pipe(output)

    if (oneDirecoty) {
        // todo one dir
        archive.directory(`${oneDirecoty}/`, false)
    } else if (ignoreObj) {
        let strings = fs.readdirSync(__dirname);

        let {exclude, suffix} = ignoreObj
        let arrFilter = strings
            .filter(name => !exclude.includes(name))
            .filter(name => !suffix.some(value => name.endsWith(value)))
        console.info('arrFilter=');
        console.info(arrFilter);

        arrFilter.forEach(filename => {
            let pathFile = path.join(__dirname, filename);
            let stats = fs.lstatSync(pathFile);
            if (stats.isDirectory()) {
                archive.directory(`${filename}/`)
            } else if (stats.isFile()) {
                archive.file(pathFile, {name: filename})
            }
        })
    } else {

    }

    archive.finalize();
    console.info(`${outputAppendName} zip starting`)
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

