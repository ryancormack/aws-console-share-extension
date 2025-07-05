/**
 * Background service worker for AWS Console Link Sharer extension
 * Handles message routing between popup and content scripts
 */

import { PopupMessage, ContentResponse, ExtensionError, SessionInfo, ExtensionConfig, UrlResult } from './types/index.js';
import { cleanUrl, generateDeepLink, validateAwsConsoleUrl } from './url-processor.js';

/**
 * Handle messages from popup and route them to content scripts
 */
export async function handleMessage(
  message: PopupMessage | any,
  sender: chrome.runtime.MessageSender
): Promise<ContentResponse | ExtensionError | UrlResult> {
  try {
    // Handle URL processing requests
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

    // Handle messages requesting session info or current URL
    if (message.action === "getSessionInfo" || message.action === "getCurrentUrl") {
      const tabId = message.tabId || sender.tab?.id;
      
      if (!tabId) {
        return { type: "permission", message: "Unable to identify current tab" } as ExtensionError;
      }

      // Validate that the tab is an AWS Console page
      const isValidTab = await validateAwsConsoleTab(tabId);
      if (!isValidTab) {
        return { type: "permission", message: "Extension only works on AWS Console pages" } as ExtensionError;
      }

      // Forward message to content script
      try {
        const response = await chrome.tabs.sendMessage(tabId, { action: message.action });
        
        if (!response?.success) {
          return { type: "session", message: response?.error || "Content script error" } as ExtensionError;
        }

        return response.data as ContentResponse;
      } catch (error) {
        let errorMessage = "Failed to communicate with content script";
        
        if (error instanceof Error) {
          if (error.message.includes('Could not establish connection')) {
            errorMessage = "Content script not loaded. Please refresh the page.";
          } else if (error.message.includes('receiving end does not exist')) {
            errorMessage = "Content script disconnected. Please refresh the page.";
          }
        }

        return { type: "session", message: errorMessage } as ExtensionError;
      }
    }

    return { type: "permission", message: "Unknown message action" } as ExtensionError;
  } catch (error) {
    return { type: "session", message: "Background script error" } as ExtensionError;
  }
}

/**
 * Validate that a tab is an AWS Console page
 */
export async function validateAwsConsoleTab(tabId: number): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab?.url ? validateAwsConsoleUrl(tab.url) : false;
  } catch (error) {
    console.error('Error validating AWS Console tab:', error);
    return false;
  }
}

/**
 * Initialize extension on install/startup
 */
export function initializeExtension(): void {
  console.log('AWS Console Link Sharer extension initialized');
  
  // Set up message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({
        type: "session",
        message: "Message handling failed",
        details: error instanceof Error ? error.message : "Unknown error"
      } as ExtensionError));
    
    return true; // Keep message channel open for async response
  });

  // Set up extension lifecycle events
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      console.log('AWS Console Link Sharer extension installed');
    } else if (details.reason === 'update') {
      console.log('AWS Console Link Sharer extension updated');
    }
  });
}

// Initialize the extension when the service worker starts
initializeExtension();