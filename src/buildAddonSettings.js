import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Generates the UI files (options.html, options.js) for the extension.
 * @param {Object} options
 * @param {string} [options.inputPath] - Path to userSettings.json.
 * @param {string} [options.manifestPath] - Path to manifest.json.
 * @param {string} [options.outDir] - Output directory for UI files.
 */
export async function buildAddonOptionsUIFile(options = {}) {
  const inputPath = options.inputPath || path.resolve(process.cwd(), 'addons/userSettings.json');
  const manifestPath = options.manifestPath || path.resolve(process.cwd(), 'addons/manifest.json');
  // Default UI output directory: addons/options
  const outDir = options.outDir || path.resolve(process.cwd(), 'addons/options');

  try {
    const data = await fs.readFile(inputPath, 'utf8');
    const userSettings = JSON.parse(data);

    // Read and parse manifest.json to get extension name and description
    let manifest = { name: 'Extension Options', description: 'Configuration deck.' };
    try {
      const manifestData = await fs.readFile(manifestPath, 'utf8');
      manifest = JSON.parse(manifestData);
    } catch (e) {
      console.warn(`[Framework] ⚠️ Could not read manifest.json at ${manifestPath}, using fallbacks.`);
    }

    await fs.mkdir(outDir, { recursive: true });

    await fs.writeFile(
        path.join(outDir, 'options.html'),
        generateOptionsHtml(userSettings, manifest)
    );

    await fs.writeFile(
        path.join(outDir, 'options.js'),
        generateOptionsJs(userSettings)
    );

    console.log(`[Framework] ✅ Successfully built UI files to ${outDir}`);
  } catch (error) {
    console.error(`[Framework] ❌ Failed to build UI files:`, error);
  }
}

/**
 * Generates the background service file (serviceUserSettings.js) for the extension.
 * @param {Object} options
 * @param {string} [options.inputPath] - Path to userSettings.json.
 * @param {string} [options.outDir] - Output directory for the service file.
 */
export async function buildAddonServiceUserSettingsJSFile(options = {}) {
  const inputPath = options.inputPath || path.resolve(process.cwd(), 'addons/userSettings.json');
  // Default Service output directory: addons/src
  const outDir = options.outDir || path.resolve(process.cwd(), 'addons/src');

  try {
    const data = await fs.readFile(inputPath, 'utf8');
    const userSettings = JSON.parse(data);

    await fs.mkdir(outDir, { recursive: true });

    await fs.writeFile(
        path.join(outDir, 'serviceUserSettings.js'),
        generateServiceUserSettings(userSettings)
    );

    console.log(`[Framework] ✅ Successfully built Service file to ${outDir}`);
  } catch (error) {
    console.error(`[Framework] ❌ Failed to build Service file:`, error);
  }
}

/**
 * Legacy wrapper to run both generators simultaneously if needed.
 */
export async function buildAddonSettings(options = {}) {
  await Promise.all([
    buildAddonOptionsUIFile(options),
    buildAddonServiceUserSettingsJSFile(options)
  ]);
}

// ---------------- Internal Generation Logic ----------------

function generateServiceUserSettings(settings) {
  const defaultValues = {};
  const keys = Object.keys(settings);
  const typeLines = [];

  for (const [key, config] of Object.entries(settings)) {
    defaultValues[key] = config.selected;

    let jsdocType = 'string';
    if (config.type === 'checkbox') jsdocType = 'string[]';
    else if (config.type === 'radio') jsdocType = typeof config.selected;
    else if (config.type === 'number') jsdocType = 'number';
    else if (config.type === 'button') jsdocType = 'boolean';
    else jsdocType = typeof config.selected;

    typeLines.push(` * ${key}: ${jsdocType}`);
  }

  const formattedJSDocType = `{\n${typeLines.join(',\n')}\n * }`;

  return `import { stoOpGet, stoOpSet } from '@vacantthinker/firefox-addon-framework-easy';

export async function serviceInitUserSettings() {
  // Placed inside the function to avoid global scope pollution.
  const defaultSettings = ${JSON.stringify(defaultValues, null, 2)};

  const initPromises = Object.entries(defaultSettings)
      .map(async ([key, defaultValue]) => {
        const oldValue = await stoOpGet(key);
        if (oldValue === null || oldValue === undefined) {
          await stoOpSet(key, defaultValue);
        }
      });

  await Promise.all(initPromises);
}

/**
 * Retrieves the current user settings object.
 * @returns {Promise<${formattedJSDocType}>}
 */
export async function serviceGetUserSettings() {
  const keys = ${JSON.stringify(keys)};
  const red = {};
  for (let k of keys) {
    red[k] = await stoOpGet(k);
  }
  return red;
}
`;
}

/**
 * Generates the HTML string for the options page, applying the Matrix-style theme.
 * @param {Object} settings - The user settings schema parsed from JSON.
 * @param {Object} manifest - The manifest object containing extension details.
 * @returns {string} The complete HTML string.
 */
function generateOptionsHtml(settings, manifest) {
  const extensionName = manifest.name || 'Extension Options';
  const extensionDesc = manifest.description || 'Configuration deck for extension parameters.';

  let html = `<!DOCTYPE html>
<html>
<head>
  <style>
    /* Base Matrix Theme applied to form elements */
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      padding: 12px;
      background-color: #121212;
      color: #00ff00;
      margin: 0;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    h1 {
      font-size: 24px;
      color: #00ff00;
      margin-top: 0;
      margin-bottom: 4px;
      font-weight: bold;
    }
    .subtitle {
      font-size: 14px;
      color: #00aa00;
      margin-bottom: 12px;
    }
    /* Form specific styling adapting the provided color palette */
    fieldset {
      border: 1px solid #005500;
      margin-bottom: 10px;
      padding: 10px;
      border-radius: 4px;
      background-color: rgba(0, 20, 0, 0.3);
    }
    legend {
      font-weight: bold;
      color: #00ff00;
      padding: 0 6px;
      font-size: 14px;
    }
    .option-item {
      margin-bottom: 8px;
      font-size: 13px;
      color: #00cc00;
    }
    /* Layout row container for horizontal checkboxes and radio buttons */
    .options-row {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
    }
    .options-row .option-item {
      margin-bottom: 0;
    }
    /* Input fields styling */
    input[type="text"], input[type="number"] {
      background-color: #1a1a1a;
      border: 1px solid #005500;
      color: #00ff00;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: inherit;
    }
    input[type="text"]:focus, input[type="number"]:focus {
      outline: none;
      border-color: #00ff00;
    }
    /* Checkbox and Radio styling tweaks for dark mode */
    input[type="checkbox"], input[type="radio"] {
      accent-color: #00ff00;
      margin-right: 6px;
      cursor: pointer;
    }
    label {
      cursor: pointer;
    }
    /* Button styling strictly adhering to the provided CSS */
    button {
      background-color: #2a2a2a;
      color: #ffffff;
      border: 1px solid #444444;
      padding: 4px 12px;
      font-size: 12px;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 6px;
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }
    button:hover {
      background-color: #3a3a3a;
      border-color: #00ff00;
    }
    span.display-value {
      color: #008800;
      font-size: 13px;
    }
  </style>
</head>
<body>
<div class="container">
  <h1>${extensionName}</h1>
  <div class="subtitle">${extensionDesc}</div>
  <div id="app">
`;

  // Iterate over the schema to generate form fields
  for (const [key, config] of Object.entries(settings)) {
    const type = config.type || 'text';
    html += `    <fieldset id="fieldset-${key}">\n`;
    html += `      <legend>${key}</legend>\n`;

    if (type === 'checkbox' || type === 'radio') {
      const options = config.options || [];
      html += `      <div class="options-row">\n`;
      options.forEach(option => {
        const id = `input-${key}-${option}`;
        html += `        <div class="option-item">\n`;
        html += `          <label for="${id}">\n`;
        html += `            <input type="${type}" id="${id}" name="${key}" value="${option}"> ${option}\n`;
        html += `          </label>\n`;
        html += `        </div>\n`;
      });
      html += `      </div>\n`;
    } else if (type === 'button') {
      html += `      <div class="option-item">\n`;
      html += `        <button type="button" id="btn-${key}"></button>\n`;
      html += `      </div>\n`;
    } else if (type === 'number' || type === 'text') {
      html += `      <div class="option-item">\n`;
      html += `        <input type="${type}" id="input-${key}" name="${key}">\n`;
      html += `      </div>\n`;
    } else if (type === 'span') {
      html += `      <div class="option-item">\n`;
      html += `        <span id="span-${key}" class="display-value"></span>\n`;
      html += `      </div>\n`;
    }

    html += `    </fieldset>\n`;
  }

  html += `  </div>\n</div>\n<script src="options.js" type="module"></script>\n</body>\n</html>`;
  return html;
}

function generateOptionsJs(settings) {
  const schemaStr = JSON.stringify(settings, null, 2);

  return `import { stoOpGet, stoOpSet } from '@vacantthinker/firefox-addon-framework-easy';

const userSettings = ${schemaStr};

// [Optimization 1] Debounce function to prevent excessive storage writes.
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// [Optimization 2] Visibility control mechanism.
function triggerVisibility(sourceKey, currentValue) {
  const config = userSettings[sourceKey];
  if (config && config.visibilityControl) {
    const { targetField, expectedValue } = config.visibilityControl;
    const targetElement = document.getElementById('fieldset-' + targetField);
    if (targetElement) {
      const shouldBeVisible = String(currentValue) === String(expectedValue);
      targetElement.style.display = shouldBeVisible ? '' : 'none';
    }
  }
}

async function initOptions() {
  const keys = Object.keys(userSettings);
  
  // [Optimization 3] Batch prefetch storage values to prevent async blocking.
  const valuesArray = await Promise.all(keys.map((key) => stoOpGet(key)));
  const storageData = {};
  keys.forEach((key, index) => { storageData[key] = valuesArray[index]; });

  // Bind events and assign initial values.
  keys.forEach((storageKey) => {
    const config = userSettings[storageKey];
    const type = config.type || 'text';
    const storedValue = storageData[storageKey];
    const initialValue = storedValue !== undefined && storedValue !== null
      ? storedValue
      : config.selected;

    // --- CONDITION 1: CHECKBOX ---
    if (type === 'checkbox') {
      const initialArray = Array.from(initialValue || []);
      const set = new Set(initialArray);
      const wrapper = document.getElementById('fieldset-' + storageKey);
      
      wrapper.querySelectorAll('input[type="checkbox"]').forEach(el => {
        el.checked = set.has(el.value);
        el.addEventListener('change', async () => {
          const allChecked = Array.from(wrapper.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
          await stoOpSet(storageKey, allChecked);
          
          browser.runtime.sendMessage({
            act: 'actOptionPageCheckItemClicked',
            radioItem: { storageKey, option: el.value }
          }).catch(() => {});
          
          triggerVisibility(storageKey, allChecked);
        });
      });
      triggerVisibility(storageKey, initialArray);
    }
    
    // --- CONDITION 2: RADIO ---
    else if (type === 'radio') {
      const el = document.getElementById(\`input-\${storageKey}-\${initialValue}\`);
      if (el) el.checked = true;

      document.querySelectorAll(\`input[name="\${storageKey}"]\`).forEach(el => {
        el.addEventListener('change', async (e) => {
          let optVal = e.target.value;
          if (optVal === 'true') optVal = true;
          if (optVal === 'false') optVal = false;

          await stoOpSet(storageKey, optVal);
          
          browser.runtime.sendMessage({
            act: 'actOptionPageRadioItemClicked',
            radioItem: { storageKey, option: optVal }
          }).catch(() => {});
          
          triggerVisibility(storageKey, optVal);
        });
      });
      triggerVisibility(storageKey, initialValue);
    }

    // --- CONDITION 3: TOGGLE BUTTON ---
    else if (type === 'button') {
      const btn = document.getElementById('btn-' + storageKey);
      let currentStatus = initialValue === true || initialValue === 'true';
      btn.textContent = String(currentStatus);

      btn.addEventListener('click', async () => {
        currentStatus = !currentStatus;
        btn.textContent = String(currentStatus);
        await stoOpSet(storageKey, currentStatus);
        triggerVisibility(storageKey, currentStatus);
      });
      triggerVisibility(storageKey, currentStatus);
    }

    // --- CONDITION 4: NUMBER & TEXT INPUTS ---
    else if (type === 'number' || type === 'text') {
      const input = document.getElementById('input-' + storageKey);
      input.value = initialValue !== undefined ? initialValue : '';

      const debouncedSave = debounce(async (val) => {
        const finalizedValue = type === 'number' ? Number(val) : val;
        await stoOpSet(storageKey, finalizedValue);
      }, 500);

      input.addEventListener('input', (e) => {
        const rawValue = e.target.value;
        debouncedSave(rawValue);
        triggerVisibility(storageKey, rawValue); // Visual updates without delay.
      });
      triggerVisibility(storageKey, initialValue);
    }

    // --- CONDITION 5: SPAN ---
    else if (type === 'span') {
      const span = document.getElementById('span-' + storageKey);
      span.textContent = String(initialValue);
      triggerVisibility(storageKey, initialValue);
    }
  });
}

document.addEventListener('DOMContentLoaded', initOptions);
`;
}