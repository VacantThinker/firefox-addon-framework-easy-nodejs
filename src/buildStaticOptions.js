import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

/**
 * Build-time generator by parsing text file
 * 通过解析文本文件生成 options.html/js
 * @param {string} filePath - Path to userSettings.js
 * @param {string} outputDir - Output directory
 */
export function buildStaticOptions(filePath, outputDir = './dist') {
  // 1. Read file as plain text / 读取文件为纯文本
  const rawContent = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf-8');

  // 2. Extract the userSettings object using Regex / 使用正则提取 userSettings 对象
  // 匹配 export const userSettings = { ... }; 结构
  const match = rawContent.match(/export const userSettings\s*=\s*({[\s\S]*?});/);
  if (!match) throw new Error("Could not find userSettings object in the file.");

  const objectString = match[1];

  // 3. Evaluate the object safely in a sandbox / 在沙箱中安全求值
  // 使用 vm 模块，模拟依赖，避免真实导入导致崩溃
  const sandbox = {
    userSettings: {},
    // 模拟 userSettings.js 内部使用的函数，防止报错
    browserRuntimeManifestVersion: () => '1.0.0'
  };

  // 把对象字符串包装一下，变成可执行的 JS 语句
  vm.createContext(sandbox);
  vm.runInContext(`userSettings = ${objectString}`, sandbox);

  const userSettings = sandbox.userSettings;

  // 4. Generate Files / 生成文件 (逻辑同前)
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // 生成 HTML
  const htmlContent = `<!DOCTYPE html>
<html>
<body>
    <div id="app">${generateHtmlMarkup(userSettings)}</div>
    <script src="options.js" type="module"></script>
</body>
</html>`;
  fs.writeFileSync(path.join(outputDir, 'options.html'), htmlContent);

  // 生成 JS
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
  // 注意：这里生成的代码是字符串，它包含了 browser.runtime.sendMessage
  // 在 build 阶段，这段代码不会运行，Node.js 只是把它写入 options.js 文件
  return `
    import { stoOpGet } from './opStorage.js'; 

    async function init() {
        const schema = ${JSON.stringify(settings)};
        
        // 这里的点击事件回调是写在文件里的，浏览器运行 options.js 时才会执行
        document.addEventListener('change', async (e) => {
            const el = e.target;
            if (!el.name) return;
            
            const config = schema[el.name];
            if (!config) return;

            const isRadio = config.type === 'radio';
            const actName = isRadio ? 'actOptionPageRadioItemClicked' : 'actOptionPageCheckItemClicked';
            
            // 此处是浏览器运行时的代码，完全合法
            await browser.runtime.sendMessage({
                act: actName,
                radioItem: { storageKey: el.name, option: el.value }
            });
        });

        // 初始化逻辑...
    }
    init();
    `;
}