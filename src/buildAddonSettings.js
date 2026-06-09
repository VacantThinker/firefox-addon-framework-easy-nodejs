import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Automatically generates extension UI and Service files based on user configuration.
 * @param {Object} options
 * @param {string} [options.inputPath] - Path to userSettings.json.
 * @param {string} [options.outDir] - Output directory for generated files.
 */
export async function buildAddonSettings(options = {}) {
  // Default values: Set to the 'addons' folder under the project root.
  const defaultInputPath = path.resolve(process.cwd(), 'addons/userSettings.json');
  const defaultOutDir = path.resolve(process.cwd(), 'addons');

  const inputPath = options.inputPath || defaultInputPath;
  const outDir = options.outDir || defaultOutDir;

  try {
    const data = await fs.readFile(inputPath, 'utf8');
    const userSettings = JSON.parse(data);

    // Ensure the output directory exists.
    await fs.mkdir(outDir, { recursive: true });

    // 1. Generate the Service file (includes precise JSDoc return type declarations).
    await fs.writeFile(
        path.join(outDir, 'serviceUserSettings.js'),
        generateServiceUserSettings(userSettings)
    );

    // 2. Generate the static HTML file.
    await fs.writeFile(
        path.join(outDir, 'options.html'),
        generateOptionsHtml(userSettings)
    );

    // 3. Generate the Options JS file.
    await fs.writeFile(
        path.join(outDir, 'options.js'),
        generateOptionsJs(userSettings)
    );

    console.log(`[Framework] ✅ Successfully built settings files to ${outDir}`);
  } catch (error) {
    console.error(`[Framework] ❌ Failed to build settings:`, error);
  }
}

// ---------------- Internal Generation Logic ----------------

function generateServiceUserSettings(settings) {
  const defaultValues = {};
  const keys = Object.keys(settings);
  const typeLines = [];

  for (const [key, config] of Object.entries(settings)) {
    defaultValues[key] = config.selected;

    // Dynamically infer standard JSDoc/TypeScript types.
    let jsdocType = 'string';
    if (config.type === 'checkbox') {
      jsdocType = 'string[]';
    } else if (config.type === 'radio') {
      // Determine if it is boolean or string based on the actual data type of 'selected'.
      jsdocType = typeof config.selected;
    } else if (config.type === 'number') {
      jsdocType = 'number';
    } else if (config.type === 'button') {
      jsdocType = 'boolean';
    } else {
      jsdocType = typeof config.selected;
    }

    typeLines.push(` * ${key}: ${jsdocType}`);
  }

  // Concatenate into the expected multi-line Object declaration format.
  const formattedJSDocType = `{\n${typeLines.join(',\n')}\n * }`;

  return `import { stoOpGet, stoOpSet } from '@vacantthinker/firefox-addon-framework-easy';

// Removed 'options', keeping only default values for initialization purposes.
const defaultSettings = ${JSON.stringify(defaultValues, null, 2)};

export async function serviceInitUserSettings() {
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

function generateOptionsHtml(settings) {
  let html = `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>Options</title>\n</head>\n<body>\n<div id="app">\n`;

  for (const [key, config] of Object.entries(settings)) {
    const type = config.type || 'text';
    html += `  <fieldset id="fieldset-${key}">\n`;
    html += `    <legend>${key}</legend>\n`;

    if (type === 'checkbox' || type === 'radio') {
      const options = config.options || [];
      options.forEach(option => {
        const id = `input-${key}-${option}`;
        html += `    <div class="option-item">\n`;
        html += `      <label for="${id}">\n`;
        html += `        <input type="${type}" id="${id}" name="${key}" value="${option}"> ${option}\n`;
        html += `      </label>\n`;
        html += `    </div>\n`;
      });
    } else if (type === 'button') {
      html += `    <button type="button" id="btn-${key}"></button>\n`;
    } else if (type === 'number' || type === 'text') {
      html += `    <input type="${type}" id="input-${key}" name="${key}">\n`;
    } else if (type === 'span') {
      html += `    <span id="span-${key}"></span>\n`;
    }

    html += `  </fieldset>\n`;
  }

  html += `</div>\n<script src="options.js" type="module"></script>\n</body>\n</html>`;
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