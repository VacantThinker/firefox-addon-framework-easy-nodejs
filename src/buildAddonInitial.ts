import fs from 'fs/promises';
import path from 'path';

export interface BuildAddonInitialOptions {
  outDir?: string;
}

/**
 * Checks for the existence of initialRuntimeOnMessage.js in the addons directory.
 * If it does not exist, creates it with optimized content; otherwise, skips creation.
 */
export async function buildAddonInitialRuntimeOnMessageFile(options: BuildAddonInitialOptions = {}): Promise<void> {
  // Default output directory: addons
  const outDir: string = options.outDir || path.resolve(process.cwd(), 'addons/src');
  const targetFilePath: string = path.join(outDir, 'initialRuntimeOnMessage.js');

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

    const fileContent: string = generateInitialRuntimeOnMessageContent();
    await fs.writeFile(targetFilePath, fileContent, 'utf8');
    console.log(`[Framework] ✅ Successfully created: ${targetFilePath}`);
  } catch (error) {
    console.error(`[Framework] ❌ Failed to manage initial file:`, error);
  }
}

/**
 * Generates the optimized string content for initialRuntimeOnMessage.js.
 */
function generateInitialRuntimeOnMessageContent(): string {
  return `
import { aCustomActionHandleOnMessage } from './aCustomActionHandleOnMessage.js';
import {
  browserNotificationCreate,
  browserTabSendMessage,
  serviceDownloadByDownlink,
  tabOpFocus,
  tabOpRemove,
} from '@vacantthinker/firefox-addon-framework-easy';

export function initialRuntimeOnMessage() {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.act) {
      return false;
    }

    const { act, ...rest } = message;
    if (sender.tab) {
      Object.assign(rest, { tabId: sender.tab.id });
    }

    switch (act) {
      case 'actLog': {
        console.log('act', act, 'rest', rest);
        sendResponse({ status: 'ok' });
        return false;
      }

      case 'actMarco': {
        sendResponse({ status: 'Polo' });
        return false;
      }

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
        return false;
      }

      case 'actNotification': {
        browserNotificationCreate(rest.content).then()
        sendResponse({ status: 'ok' });
        return false;
      }

      case 'actRemoveTab': {
        tabOpRemove(rest.tabId).then()
        sendResponse({ status: 'ok' });
        return false;
      }

      case 'actFocusTab': {
        tabOpFocus(rest.tabId).then()
        sendResponse({ status: 'ok' });
        return false;
      }

      case 'actFocusCurrentTab': {
        tabOpFocus(rest.tabId).then()
        sendResponse({ status: 'ok' });
        return false;
      }

      case 'actFocusTargetTab': {
        tabOpFocus(rest['targetTabId']).then()
        sendResponse({ status: 'ok' });
        return false;
      }

      case 'actDownloadFile': {
        serviceDownloadByDownlink(rest).then()
        sendResponse({ status: 'ok' });
        return false;
      }

      case 'actSendMessageToCurrentTab': {
        browserTabSendMessage(rest.tabId, rest).then()
        sendResponse({ status: 'ok' });
        return false;
      }

      default: {
        const isAsync = aCustomActionHandleOnMessage(act, rest, sendResponse);
        return isAsync === true;
      }
    }
  });
}
`;
}