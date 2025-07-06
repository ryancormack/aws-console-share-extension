import { PopupMessage, ContentResponse, ExtensionError, SessionInfo, ExtensionConfig, UrlResult } from './types/index.js';
import { cleanUrl, generateDeepLink, validateAwsConsoleUrl } from './url-processor.js';
export async function handleMessage(
  message: PopupMessage | any,
  sender: chrome.runtime.MessageSender
): Promise<ContentResponse | ExtensionError | UrlResult> {
  try {
    if (message.action === "cleanUrl") {
      if (!message.url) {
        return { type: "url", message: "URL is required for cleaning" } as ExtensionError;
      }
      return cleanUrl(message.url);
    }

    if (message.action === "generateDeepLink") {
      if (!message.sessionInfo || !message.config) {
        return { type: "url", message: "Session info and config are required" } as ExtensionError;
      }
      return generateDeepLink(message.sessionInfo as SessionInfo, message.config as ExtensionConfig);
    }

    if (message.action === "getSessionInfo" || message.action === "getCurrentUrl") {
      const tabId = message.tabId || sender.tab?.id;
      
      if (!tabId) {
        return { type: "permission", message: "Unable to identify current tab" } as ExtensionError;
      }

      const isValidTab = await validateAwsConsoleTab(tabId);
      if (!isValidTab) {
        return { type: "permission", message: "Extension only works on AWS Console pages" } as ExtensionError;
      }
      try {
        const response = await chrome.tabs.sendMessage(tabId, { action: message.action });
        
        if (!response?.success) {
          return { type: "session", message: response?.error || "Content script error" } as ExtensionError;
        }

        return response.data as ContentResponse;
      } catch (error) {
        const errorMessage = error instanceof Error && error.message.includes('Could not establish connection')
          ? "Content script not loaded. Please refresh the page."
          : error instanceof Error && error.message.includes('receiving end does not exist')
          ? "Content script disconnected. Please refresh the page."
          : "Failed to communicate with content script";

        return { type: "session", message: errorMessage } as ExtensionError;
      }
    }

    return { type: "permission", message: "Unknown message action" } as ExtensionError;
  } catch (error) {
    return { type: "session", message: "Background script error" } as ExtensionError;
  }
}

export async function validateAwsConsoleTab(tabId: number): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab?.url ? validateAwsConsoleUrl(tab.url) : false;
  } catch (error) {
    console.error('Error validating AWS Console tab:', error);
    return false;
  }
}

export function initializeExtension(): void {
  console.log('AWS Console Link Sharer extension initialized');
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({
        type: "session",
        message: "Message handling failed",
        details: error instanceof Error ? error.message : "Unknown error"
      } as ExtensionError));
    
    return true;
  });

  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      console.log('AWS Console Link Sharer extension installed');
    } else if (details.reason === 'update') {
      console.log('AWS Console Link Sharer extension updated');
    }
  });
}

initializeExtension();