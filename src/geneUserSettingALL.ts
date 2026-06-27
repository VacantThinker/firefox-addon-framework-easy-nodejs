import fs from 'fs/promises';
import path from 'path';

export interface VisibilityControl {
  targetField: string;
  expectedValue: string | boolean;
}

export type TypeUserSetting =
  | 'radio' | 'checkbox' | 'text' | 'number'
  | 'button' | 'toggleButton' | 'buttonToDo' | 'span'
  | 'textarea'

export interface UserSettingItem {
  type: TypeUserSetting;
  selected?: string[] | string | boolean | number;
  options?: string[] | number[] | boolean[];
  skipThis?: boolean;
  visibilityControl?: VisibilityControl;
  validationRegex?: string; // <-- 加上正則驗證屬性
}

export type UserSettingsInput = Record<string, UserSettingItem>;

export interface BuildSettingOptions {
  inputPath?: string;
  manifestPath?: string;
  outDir?: string;
}

export interface ManifestInput {
  name?: string;
  description?: string;

  [key: string]: any;
}

/**
 * Generates the UI files (options.html, options.ts) for the
 * extension.
 */
export async function genePagesDirOptionsUIHTMLTS(
  options: BuildSettingOptions = {}): Promise<void> {
  const inputPath: string = options.inputPath ||
    path.resolve(process.cwd(), 'addons/userSettings.json');
  const manifestPath: string = options.manifestPath ||
    path.resolve(process.cwd(), 'addons/manifest.json');
  const outDir: string = options.outDir ||
    path.resolve(process.cwd(), 'addons/pages');

  try {
    const data: string = await fs.readFile(inputPath, 'utf8');
    const userSettings: UserSettingsInput = JSON.parse(data);

    let manifest: ManifestInput = {
      name: 'Extension Options',
      description: 'Configuration deck.',
    };
    try {
      const manifestData: string = await fs.readFile(manifestPath, 'utf8');
      manifest = JSON.parse(manifestData);
    } catch (e) {
      console.warn(
        `[Framework] ⚠️ Could not read manifest.json at ${manifestPath}, using fallbacks.`
      );
    }

    await fs.mkdir(outDir, {recursive: true});

    await fs.writeFile(
      path.join(outDir, 'options.html'),
      generateOptionsHtml(userSettings, manifest)
    );

    await fs.writeFile(
      path.join(outDir, 'options.ts'),
      generateOptionsTs(userSettings)
    );

    console.log(`[Framework] ✅ Successfully built UI files to ${outDir}`);
  } catch (error) {
    console.error(`[Framework] ❌ Failed to build UI files:`, error);
  }
}

/**
 * Generates the background service file (serviceUserSettings.ts)
 * for the extension.
 */
export async function geneServiceUserSettingsTS(
  options: BuildSettingOptions = {}): Promise<void> {
  const inputPath: string = options.inputPath ||
    path.resolve(process.cwd(), 'addons/userSettings.json');
  const outDir: string = options.outDir ||
    path.resolve(process.cwd(), 'addons/services');

  try {
    const data: string = await fs.readFile(inputPath, 'utf8');
    const userSettings: UserSettingsInput = JSON.parse(data);

    await fs.mkdir(outDir, {recursive: true});

    await fs.writeFile(
      path.join(outDir, 'serviceUserSettings.ts'),
      generateServiceUserSettingsTs(userSettings)
    );

    console.log(`[Framework] ✅ Successfully built Service file to ${outDir}`);
  } catch (error) {
    console.error(`[Framework] ❌ Failed to build Service file:`, error);
  }
}

/**
 * Wrapper to run both generators simultaneously.
 */
export async function geneUserSettingALL(options: BuildSettingOptions = {}): Promise<void> {
  await Promise.all([
    genePagesDirOptionsUIHTMLTS(options),
    geneServiceUserSettingsTS(options),
  ]);
}

// ---------------- Internal Generation Logic ----------------

function generateServiceUserSettingsTs(settings: UserSettingsInput): string {
  const defaultValues: Record<string, any> = {};
  const serviceKeys: string[] = [];
  const individualGetters: string[] = [];

  for (const [key, config] of Object.entries(settings)) {
    if (config.skipThis === true) {
      continue;
    }

    serviceKeys.push(key);
    defaultValues[key] = config.selected;

    let returnType: string = 'any';
    if (config.type === 'checkbox') returnType = 'string[]';
    else if (config.type === 'radio') returnType = typeof config.selected;
    else if (config.type === 'number') returnType = 'number';
    else if (config.type === 'toggleButton' || config.type === 'button') returnType = 'boolean';
    else returnType = typeof config.selected;

    const capitalizedKey: string = key.charAt(0).toUpperCase() + key.slice(1);

    individualGetters.push(`export async function serviceGetUserSetting${capitalizedKey}(): Promise<${returnType} | null> {
  return await syncStoOpGet("${key}");
}`);
  }

  const defaultSettingsStr: string = JSON.stringify(defaultValues, null, 2).replace(/\n/g, '\n  ');

  return `import {
  syncStoOpGet,
  syncStoOpSet
} from '@vacantthinker/firefox-addon-framework-easy';
import {UserSettings} from "../types";

export async function serviceInitUserSettings() {
  const defaultSettings = ${defaultSettingsStr};

  const initPromises = Object.entries(defaultSettings)
    .map(async ([key, defaultValue]) => {
      const oldValue = await syncStoOpGet(key);
      if (oldValue === null || oldValue === undefined) {
        await syncStoOpSet(key, defaultValue);
      }
    });

  await Promise.all(initPromises);
}

export async function serviceGetUserSettingALL(): Promise<UserSettings> {
  const keys: (keyof UserSettings)[] = ${JSON.stringify(serviceKeys, null, 4).replace(/]$/, '  ]')};

  const values = await Promise.all(
    keys.map(k => syncStoOpGet(k as string))
  );

  const settings = {} as UserSettings;
  keys.forEach((key, index) => {
    (settings as any)[key] = values[index];
  });

  return settings;
}

${individualGetters.join('\n\n')}
`;
}

function generateOptionsTs(settings: UserSettingsInput): string {
  const schemaStr: string = JSON.stringify(settings, null, 2);

  return `
import {
  syncStoOpGet,
  syncStoOpSet
} from '@vacantthinker/firefox-addon-framework-easy';
import {UserSettings} from '../types';

interface VisibilityControl {
  targetField: keyof UserSettings;
  expectedValue: string | boolean;
}
type TypeUserSetting =
  | 'radio' | 'checkbox' | 'text' | 'number'
  | 'button' | 'toggleButton' | 'buttonToDo' | 'span'
  | 'textarea'

interface BaseSettingConfig {
  type: TypeUserSetting;
  options?: (string | boolean | number)[];
  selected?: string | boolean | string[] | number;
  visibilityControl?: VisibilityControl;
  skipThis?: boolean;
  validationRegex?: string;
}

interface RadioSettingConfig extends BaseSettingConfig {
  type: 'radio';
  options: (string | boolean)[];
  selected: string | boolean;
}

interface CheckboxSettingConfig extends BaseSettingConfig {
  type: 'checkbox';
  options: string[];
  selected: string[];
}

type UserSettingsSchema = {
  [K in keyof UserSettings]: RadioSettingConfig | CheckboxSettingConfig | BaseSettingConfig;
};

const userSettings: UserSettingsSchema = ${schemaStr};

function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function triggerVisibility(sourceKey: keyof UserSettings, currentValue: unknown): void {
  const config = userSettings[sourceKey];
  if (config && config.visibilityControl) {
    const {targetField, expectedValue} = config.visibilityControl;
    const targetElement = document.getElementById('fieldset-' + (targetField as string));
    if (targetElement) {
      const shouldBeVisible = String(currentValue) === String(expectedValue);
      targetElement.style.display = shouldBeVisible ? '' : 'none';
    }
  }
}

async function initOptions(): Promise<void> {
  const keys = Object.keys(userSettings) as (keyof UserSettings)[];

  const valuesArray = await Promise.all(keys.map((key) => syncStoOpGet(key as string)));
  const storageData: Record<string, unknown> = {};
  keys.forEach((key, index) => {
    storageData[key as string] = valuesArray[index];
  });

  keys.forEach((storageKey) => {
    const config = userSettings[storageKey];
    if (config.skipThis) return;

    const type = config.type || 'text';
    const storedValue = storageData[storageKey as string];
    const initialValue = storedValue !== undefined && storedValue !== null ? storedValue : config.selected;

    if (type === 'checkbox') {
      const initialArray = Array.from((initialValue as string[]) || []);
      const activeSet = new Set(initialArray);
      const wrapper = document.getElementById('fieldset-' + (storageKey as string));

      if (!wrapper) return;

      const checkboxes = wrapper.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
      checkboxes.forEach(el => {
        el.checked = activeSet.has(el.value);
        el.addEventListener('change', async () => {
          const allChecked = Array.from(wrapper.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'))
            .map(cb => cb.value);

          await syncStoOpSet(storageKey as string, allChecked);

          browser.runtime.sendMessage({
            act: 'actOptionPageCheckItemClicked',
            radioItem: {storageKey, option: el.value}
          }).catch(() => {});

          triggerVisibility(storageKey, allChecked);
        });
      });
      triggerVisibility(storageKey, initialArray);
    }

    else if (type === 'radio') {
      const initialRadioEl = document.getElementById('input-' + (storageKey as string) + '-' + String(initialValue)) as HTMLInputElement | null;
      if (initialRadioEl) initialRadioEl.checked = true;

      const groupWrapper = document.getElementById('fieldset-' + (storageKey as string)) || document;
      const radios = groupWrapper.querySelectorAll<HTMLInputElement>('input[name="' + (storageKey as string) + '"]');

      radios.forEach(el => {
        el.addEventListener('change', async (e) => {
          const target = e.currentTarget as HTMLInputElement;
          let optVal: string | boolean = target.value;

          if (optVal === 'true') optVal = true;
          if (optVal === 'false') optVal = false;

          await syncStoOpSet(storageKey as string, optVal);

          browser.runtime.sendMessage({
            act: 'actOptionPageRadioItemClicked',
            radioItem: {storageKey, option: optVal}
          }).catch(() => {});

          triggerVisibility(storageKey, optVal);
        });
      });
      triggerVisibility(storageKey, initialValue);
    }

    else if (type === 'button' || type === 'toggleButton') {
      const btn = document.getElementById('btn-' + (storageKey as string)) as HTMLButtonElement | null;
      if (!btn) return;

      let currentStatus = initialValue === true || initialValue === 'true';
      btn.textContent = String(currentStatus);

      btn.addEventListener('click', async () => {
        currentStatus = !currentStatus;
        btn.textContent = String(currentStatus);
        await syncStoOpSet(storageKey as string, currentStatus);
        triggerVisibility(storageKey, currentStatus);
      });
      triggerVisibility(storageKey, currentStatus);
    }

    else if (type === 'number' || type === 'text') {
      const input = document.getElementById('input-' + (storageKey as string)) as HTMLInputElement | null;
      if (!input) return;

      input.value = initialValue !== undefined ? String(initialValue) : '';

      const debouncedSave = debounce(async (val: string) => {
        const finalizedValue = type === 'number' ? Number(val) : val;
        await syncStoOpSet(storageKey as string, finalizedValue);
      }, 500);

      input.addEventListener('input', (e) => {
        const target = e.currentTarget as HTMLInputElement;
        const rawValue = target.value;
        debouncedSave(rawValue);
        triggerVisibility(storageKey, rawValue);
      });
      triggerVisibility(storageKey, initialValue);
    }

    else if (type === 'span') {
      const span = document.getElementById('span-' + (storageKey as string));
      if (span) {
        span.textContent = String(initialValue);
      }
      triggerVisibility(storageKey, initialValue);
    }
    
    else if (type === 'textarea') {
      const textarea = document.getElementById('input-' + (storageKey as string)) as HTMLTextAreaElement | null;
      const toggleBtn = document.getElementById('toggle-' + (storageKey as string)) as HTMLButtonElement | null;
      const errorMsg = document.getElementById('error-' + (storageKey as string)) as HTMLDivElement | null;
      
      if (!textarea) return;

      textarea.value = initialValue !== undefined && initialValue !== null ? String(initialValue) : '';

      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          if (textarea.classList.contains('collapsed')) {
            textarea.classList.remove('collapsed');
            textarea.classList.add('expanded');
            toggleBtn.textContent = 'Collapse';
          } else {
            textarea.classList.remove('expanded');
            textarea.classList.add('collapsed');
            toggleBtn.textContent = 'Expand';
          }
        });
      }

      const regexStr = config.validationRegex;
      let regex: RegExp | null = null;
      if (regexStr) {
         try { regex = new RegExp(regexStr); } catch(e) {}
      }

      const debouncedSave = debounce(async (val: string) => {
        await syncStoOpSet(storageKey as string, val);
      }, 500);

      textarea.addEventListener('input', (e) => {
        const target = e.currentTarget as HTMLTextAreaElement;
        const rawValue = target.value;

        let isValid = true;
        if (regex && rawValue.trim() !== '') {
           const lines = rawValue.split('\\\\n');
           isValid = lines.every(line => {
             const trimmedLine = line.trim();
             return trimmedLine === '' || regex!.test(trimmedLine); 
           });
        }

        if (!isValid) {
           textarea.style.borderColor = '#ff5555';
           if(errorMsg) errorMsg.style.display = 'block';
           return;
        } else {
           textarea.style.borderColor = '#005500';
           if(errorMsg) errorMsg.style.display = 'none';
        }

        debouncedSave(rawValue);
        triggerVisibility(storageKey, rawValue);
      });
      triggerVisibility(storageKey, initialValue);
    }
  });
}

document.addEventListener('DOMContentLoaded', initOptions);
`;
}

function generateOptionsHtml(settings: UserSettingsInput, manifest: ManifestInput): string {
  const extensionName: string = manifest.name || 'Extension Options';
  const extensionDesc: string = manifest.description || 'Configuration deck for extension parameters.';

  let html: string = '<!DOCTYPE html>\n<html>\n<head>\n  <style>\n' +
    '    body {\n' +
    '      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;\n' +
    '      padding: 12px;\n' +
    '      background-color: #121212;\n' +
    '      color: #00ff00;\n' +
    '      margin: 0;\n' +
    '    }\n' +
    '    .container {\n' +
    '      max-width: 1400px;\n' +
    '      margin: 0 auto;\n' +
    '    }\n' +
    '    h1 {\n' +
    '      font-size: 24px;\n' +
    '      color: #00ff00;\n' +
    '      margin-top: 0;\n' +
    '      margin-bottom: 4px;\n' +
    '      font-weight: bold;\n' +
    '    }\n' +
    '    .subtitle {\n' +
    '      font-size: 14px;\n' +
    '      color: #00aa00;\n' +
    '      margin-bottom: 12px;\n' +
    '    }\n' +
    '    fieldset {\n' +
    '      border: 1px solid #005500;\n' +
    '      margin-bottom: 10px;\n' +
    '      padding: 10px;\n' +
    '      border-radius: 4px;\n' +
    '      background-color: rgba(0, 20, 0, 0.3);\n' +
    '    }\n' +
    '    legend {\n' +
    '      font-weight: bold;\n' +
    '      color: #00ff00;\n' +
    '      padding: 0 6px;\n' +
    '      font-size: 14px;\n' +
    '    }\n' +
    '    .option-item {\n' +
    '      margin-bottom: 8px;\n' +
    '      font-size: 13px;\n' +
    '      color: #00cc00;\n' +
    '    }\n' +
    '    .options-row {\n' +
    '      display: flex;\n' +
    '      flex-wrap: wrap;\n' +
    '      gap: 15px;\n' +
    '    }\n' +
    '    .options-row .option-item {\n' +
    '      margin-bottom: 0;\n' +
    '    }\n' +
    '    input[type="text"], input[type="number"] {\n' +
    '      background-color: #1a1a1a;\n' +
    '      border: 1px solid #005500;\n' +
    '      color: #00ff00;\n' +
    '      padding: 4px 8px;\n' +
    '      border-radius: 4px;\n' +
    '      font-family: inherit;\n' +
    '    }\n' +
    '    input[type="text"]:focus, input[type="number"]:focus {\n' +
    '      outline: none;\n' +
    '      border-color: #00ff00;\n' +
    '    }\n' +
    '    input[type="checkbox"], input[type="radio"] {\n' +
    '      accent-color: #00ff00;\n' +
    '      margin-right: 6px;\n' +
    '      cursor: pointer;\n' +
    '    }\n' +
    '    label {\n' +
    '      cursor: pointer;\n' +
    '    }\n' +
    '    button {\n' +
    '      background-color: #2a2a2a;\n' +
    '      color: #ffffff;\n' +
    '      border: 1px solid #444444;\n' +
    '      padding: 4px 12px;\n' +
    '      font-size: 12px;\n' +
    '      border-radius: 4px;\n' +
    '      cursor: pointer;\n' +
    '      margin-right: 6px;\n' +
    '      transition: background-color 0.15s ease, border-color 0.15s ease;\n' +
    '    }\n' +
    '    button:hover {\n' +
    '      background-color: #3a3a3a;\n' +
    '      border-color: #00ff00;\n' +
    '    }\n' +
    '    span.display-value {\n' +
    '      color: #008800;\n' +
    '      font-size: 13px;\n' +
    '      color: #008800;\n' +
    '    }\n' +
    '    textarea {\n' +
    '      width: 100%;\n' +
    '      background-color: #1a1a1a;\n' +
    '      border: 1px solid #005500;\n' +
    '      color: #00ff00;\n' +
    '      padding: 8px;\n' +
    '      border-radius: 4px;\n' +
    '      font-family: inherit;\n' +
    '      resize: vertical;\n' +
    '      box-sizing: border-box;\n' +
    '      transition: height 0.2s ease;\n' +
    '      white-space: pre;\n' +
    '      overflow-wrap: normal;\n' +
    '      overflow-x: auto;\n' +
    '    }\n' +
    '    textarea:focus {\n' +
    '      outline: none;\n' +
    '      border-color: #00ff00;\n' +
    '    }\n' +
    '    textarea.collapsed {\n' +
    '      height: 80px;\n' +
    '    }\n' +
    '    textarea.expanded {\n' +
    '      height: 350px;\n' +
    '    }\n' +
    '    .toggle-btn {\n' +
    '      margin-bottom: 6px;\n' +
    '      background-color: transparent;\n' +
    '      border: 1px solid #005500;\n' +
    '      color: #00aa00;\n' +
    '    }\n' +
    '  </style>\n' +
    '</head>\n' +
    '<body>\n' +
    '<div class="container">\n' +
    '  <h1>' + extensionName + '</h1>\n' +
    '  <div class="subtitle">' + extensionDesc + '</div>\n' +
    '  <div id="app">\n';

  for (const [key, config] of Object.entries(settings)) {
    const type: string = config.type || 'text';
    html += '    <fieldset id="fieldset-' + key + '">\n';
    html += '      <legend>' + key + '</legend>\n';

    if (type === 'checkbox' || type === 'radio') {
      const options: any[] = config.options || [];
      html += '      <div class="options-row">\n';
      options.forEach(option => {
        const id: string = 'input-' + key + '-' + option;
        html += '        <div class="option-item">\n';
        html += '          <label for="' + id + '">\n';
        html += '            <input type="' + type + '" id="' + id + '" name="' + key + '" value="' + option + '"> ' + option + '\n';
        html += '          </label>\n';
        html += '        </div>\n';
      });
      html += '      </div>\n';
    } else if (type === 'toggleButton' || type === 'button' || type === 'buttonToDo') {
      html += '        <div class="option-item">\n';
      html += '          <button type="button" id="btn-' + key + '"></button>\n';
      html += '        </div>\n';
    } else if (type === 'number' || type === 'text') {
      html += '        <div class="option-item">\n';
      html += '          <input type="' + type + '" id="input-' + key + '" name="' + key + '">\n';
      html += '        </div>\n';
    } else if (type === 'span') {
      html += '        <div class="option-item">\n';
      html += '          <span id="span-' + key + '" class="display-value"></span>\n';
      html += '        </div>\n';
    } else if (type === 'textarea') {
      html += '        <div class="option-item" style="width: 100%;">\n';
      html += '          <div style="display: flex; justify-content: space-between; align-items: center;">\n';
      html += '            <label for="input-' + key + '">List Data</label>\n';
      html += '            <button type="button" id="toggle-' + key + '" class="toggle-btn">Expand</button>\n';
      html += '          </div>\n';
      html += '          <textarea id="input-' + key + '" name="' + key + '" class="collapsed"></textarea>\n';
      html += '          <div id="error-' + key + '" style="display: none; color: #ff5555; font-size: 12px; margin-top: 4px;">must match to https://www.youtube.com/@*/videos</div>\n';
      html += '        </div>\n';
    }

    html += '    </fieldset>\n';
  }

  html += '  </div>\n</div>\n<script src="options.js" type="module"></script>\n</body>\n</html>';
  return html;
}