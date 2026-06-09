import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

/**
 * Build-time generator that dynamically reads userSettings.js
 * @param {string} userSettingsPath - Path to the userSettings.js file
 * @param userSettingsPath
 * @param {string} outputDir - Directory to output options.html/js
 */
export async function buildStaticOptions(
    userSettingsPath = 'addons/src/userSettings.js',
    outputDir = './addons',
) {
  // 1. Dynamic Import: Load userSettings from your project file
  const absolutePath = path.resolve(process.cwd(), userSettingsPath);
  const module = await import(pathToFileURL(absolutePath).href);
  const userSettings = module.userSettings;

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, {recursive: true});

  // 2. Generate HTML
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body>
    <div id="app">${generateHtmlMarkup(userSettings)}</div>
    <script src="options.js" type="module"></script>
</body>
</html>`;
  fs.writeFileSync(path.join(outputDir, 'options.html'), htmlContent);

  // 3. Generate JS
  const jsContent = generateBindingLogic(userSettings);
  fs.writeFileSync(path.join(outputDir, 'options.js'), jsContent);

  console.log(
      `✅ Successfully generated from ${userSettingsPath} `);
}

function generateHtmlMarkup(settings) {
  return Object.keys(settings).map(key => {
    const config = settings[key];
    const type = config.type || 'text';
    let inputs;

    if (type === 'checkbox' || type === 'radio') {
      inputs = (config.options || []).map(opt => `
                <label>
                    <input type="${type}" name="${key}" value="${opt}"> ${opt}
                </label>
            `).join('');
    }
    else if (type === 'button') {
      inputs = `<button id="btn_${key}">Click</button>`;
    }
    else if (type === 'span') {
      inputs = `<span id="val_${key}"></span>`;
    }
    else {
      inputs = `<input type="${type}" name="${key}" id="input_${key}">`;
    }
    return `<fieldset id="wrap_${key}"><legend>${key}</legend>${inputs}</fieldset>`;
  }).join('');
}

function generateBindingLogic(settings) {
  return `
    async function init() {
        const schema = ${JSON.stringify(settings)};
        const keys = Object.keys(schema);

        // Binding logic for callbacks 
        keys.forEach((key) => {
            const elements = document.querySelectorAll('[name="' + key + '"]');
            const config = schema[key];

            elements.forEach(el => {
                el.addEventListener('change', async (e) => {
                    const isRadio = config.type === 'radio';
                    const actName = isRadio ? 'actOptionPageRadioItemClicked' : 'actOptionPageCheckItemClicked';
                    
                    // Callback logic: Send message to background  
                    await browser.runtime.sendMessage({
                        act: actName,
                        radioItem: {
                            storageKey: key,
                            option: e.target.value
                        }
                    });
                });
            });
        });

        // Initialize values from storage 
        const values = await Promise.all(keys.map(k => stoOpGet(k)));
        keys.forEach((key, index) => {
            const val = values[index] ?? schema[key].selected;
            const elements = document.querySelectorAll('[name="' + key + '"]');
            elements.forEach(el => {
                if (el.type === 'checkbox') el.checked = val.includes(el.value);
                else if (el.type === 'radio') el.checked = (String(el.value) === String(val));
                else el.value = val;
            });
        });
    }
    init();
    `;
}