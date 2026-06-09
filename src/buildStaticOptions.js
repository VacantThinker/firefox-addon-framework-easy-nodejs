import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

/**
 * Build-time generator by parsing text file
 * @param {string} filePath - Path to userSettings.js
 * @param {string} outputDir - Output directory
 */
export function buildStaticOptions(filePath, outputDir = './dist') {
  const rawContent = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf-8');

  const match = rawContent.match(/export const userSettings\s*=\s*({[\s\S]*?});/);
  if (!match) throw new Error("Could not find userSettings object in the file.");

  const objectString = match[1];

  const sandbox = {
    userSettings: {},
    browserRuntimeManifestVersion: () => '1.0.0'
  };

  vm.createContext(sandbox);
  vm.runInContext(`userSettings = ${objectString}`, sandbox);

  const userSettings = sandbox.userSettings;

  // 4. Generate Files / 生成文件 (逻辑同前)
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const htmlContent = `<!DOCTYPE html>
<html>
<body>
    <div id="app">${generateHtmlMarkup(userSettings)}</div>
    <script src="options.js" type="module"></script>
</body>
</html>`;
  fs.writeFileSync(path.join(outputDir, 'options.html'), htmlContent);

  const jsContent = generateBindingLogic(userSettings);
  fs.writeFileSync(path.join(outputDir, 'options.js'), jsContent);

  console.log('✅ Success: Static files generated from raw text parsing.');
}

function generateHtmlMarkup(settings) {
  return Object.keys(settings).map(key => {
    const config = settings[key];
    const type = config.type || 'text';
    let inputs = '';
    if (type === 'checkbox' || type === 'radio') {
      inputs = (config.options || []).map(opt => `
                <label><input type="${type}" name="${key}" value="${opt}"> ${opt}</label>
            `).join('');
    } else if (type === 'button') {
      inputs = `<button id="btn_${key}">Toggle</button>`;
    } else if (type === 'span') {
      inputs = `<span id="val_${key}"></span>`;
    } else {
      inputs = `<input type="${type}" name="${key}" id="input_${key}">`;
    }
    return `<fieldset id="wrap_${key}"><legend>${key}</legend>${inputs}</fieldset>`;
  }).join('');
}

function generateBindingLogic(settings) {
  return `
async function init() {
    const schema = ${JSON.stringify(settings)};
    
    document.addEventListener('change', async (e) => {
        const el = e.target;
        if (!el.name) return;
        
        const config = schema[el.name];
        if (!config) return;

        const isRadio = config.type === 'radio';
        const actName = isRadio ? 'actOptionPageRadioItemClicked' : 'actOptionPageCheckItemClicked';
        
        await browser.runtime.sendMessage({
            act: actName,
            radioItem: { storageKey: el.name, option: el.value }
        });
    });

}
document.addEventListener('DOMContentLoaded', ()=>{
  init().then();
})
    `;
}