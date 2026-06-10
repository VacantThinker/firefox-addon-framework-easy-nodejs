import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Checks for the existence of initialRuntimeOnMessage.js in the addons directory.
 * If it does not exist, creates it with optimized content; otherwise, skips creation.
 * @param {Object} options
 * @param {string} [options.outDir] - Output directory for the file.
 */
export async function buildAddonInitialRuntimeOnMessageFile(options = {}) {
  // Default output directory: addons
  const outDir = options.outDir || path.resolve(process.cwd(), 'addons');
  const targetFilePath = path.join(outDir, 'initialRuntimeOnMessage.js');

  try {
    // Ensure directory exists
    await fs.mkdir(outDir, { recursive: true });

    // Check file existence
    try {
      await fs.access(targetFilePath);
      console.log(`[Framework] File already exists, skipping creation: ${targetFilePath}`);
      return;
    } catch {
      // File does not exist, proceed to create
      console.log(`[Framework] File does not exist, creating: ${targetFilePath}`);
    }

    const fileContent = generateInitialRuntimeOnMessageContent();
    await fs.writeFile(targetFilePath, fileContent, 'utf8');
    console.log(`[Framework] ✅ Successfully created: ${targetFilePath}`);
  } catch (error) {
    console.error(`[Framework] ❌ Failed to manage initial file:`, error);
  }
}

/**
 * Generates the optimized string content for initialRuntimeOnMessage.js.
 * @returns {string} Optimized JS file content.
 */
function generateInitialRuntimeOnMessageContent() {
  return `import { aCustomActionHandleOnMessage } from './aCustomActionHandleOnMessage.js';
import {
  browserNotificationCreate,
  browserTabSendMessage,
  serviceDownloadByDownlink,
  tabOpFocus,
  tabOpRemove,
} from '@vacantthinker/firefox-addon-framework-easy';

export function initialRuntimeOnMessage() {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Prevent errors if message is null or undefined
    if (!message || !message.act) {
      return;
    }

    const { act, ...rest } = message;

    switch (act) {
      case 'actLog':
        console.log('act', act, 'rest', rest);
        break;

      case 'actMarco': // Marco Polo pool game
        sendResponse({ status: 'Polo' });
        break;

      case 'actRequestTabIdTabUrl': {
        const tab = sender.tab;
        if (tab) {
          sendResponse({
            tabId: tab.id,
            tabUrl: tab.url,
          });
        } else {
          sendResponse(null);
        }
        break;
      }

      case 'actNotification':
        browserNotificationCreate(rest.content);
        break;

      case 'actRemoveTab':
        tabOpRemove(rest.tabId);
        break;

      case 'actFocusTab':
        tabOpFocus(rest.tabId);
        break;

      case 'actDownloadFile':
        serviceDownloadByDownlink(rest);
        break;

      case 'actSendMessageToTab':
        browserTabSendMessage(rest.tabId, rest);
        break;

      default:
        // Optional: handle unrecognized internal framework messages
        break;
    }

    // Pass down to the custom action handler for extension-specific overrides
    const handled = aCustomActionHandleOnMessage(act, rest, sendResponse);
    
    // Return true if the custom handler returns true to signify asynchronous response
    if (handled === true) {
      return true;
    }
  });
}
`;
}