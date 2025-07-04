/**
 * Background service worker for AWS Console Link Sharer extension
 * Handles message routing between popup and content scripts
 */

import { PopupMessage, ContentResponse, ExtensionError, SessionInfo, ExtensionConfig, UrlResult } from './types/index.js';
import { cleanUrl, generateDeepLink, validateAwsConsoleUrl } from './url-processor.js';

/**
 * Handle messages from popup and route them to content scripts
 * @param message - Message from popup or content script
 * @param sender - Message sender information
 * @returns Promise with response data
 */
async function handleMessage(
  message: PopupMessage | any,
  sender: chrome.runtime.MessageSender
): Promise<ContentResponse | ExtensionError | UrlResult> {
  try {
    // Handle URL processing requests
    if (message.action === "cleanUrl") {
      const url = message.url;
      if (!url) {
        return {
          type: "url",
          message: "URL is required for cleaning",
          details: "No URL provided in message"
        } as ExtensionError;
      }

      return cleanUrl(url);
    }

    if (message.action === "generateDeepLink") {
      const { sessionInfo, config } = message;
      if (!sessionInfo || !config) {
        return {
          type: "url",
          message: "Session info and config are required for deep link generation",
          details: "Missing sessionInfo or config in message"
        } as ExtensionError;
      }

      return generateDeepLink(sessionInfo as SessionInfo, config as ExtensionConfig);
    }

    // Handle messages from popup requesting session info or current URL
    if (message.action === "getSessionInfo" || message.action === "getCurrentUrl") {
      const tabId = message.tabId || sender.tab?.id;
      
      if (!tabId) {
        return {
          type: "permission",
          message: "Unable to identify current tab",
          details: "Tab ID not available in message or sender"
        } as ExtensionError;
      }

      // Validate that the tab is an AWS Console page
      const isValidTab = await validateAwsConsoleTab(tabId);
      if (!isValidTab) {
        return {
          type: "permission",
          message: "Extension only works on AWS Console pages",
          details: "Current tab is not an AWS Console page"
        } as ExtensionError;
      }

      // Forward message to content script with enhanced error handling
      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          action: message.action
        });
        
        // Validate response from content script
        if (!response) {
          return {
            type: "session",
            message: "No response received from content script",
            details: "Content script may not be loaded or page may need refresh"
          } as ExtensionError;
        }

        if (!response.success) {
          return {
            type: "session",
            message: "Content script reported an error",
            details: response.error || "Unknown content script error"
          } as ExtensionError;
        }

        if (!response.data) {
          return {
            type: "session",
            message: "Content script returned no data",
            details: "Session information extraction failed"
          } as ExtensionError;
        }
        
        return response.data as ContentResponse;
      } catch (error) {
        let errorMessage = "Failed to communicate with content script";
        let errorDetails = "Unknown error";

        if (error instanceof Error) {
          if (error.message.includes('Could not establish connection')) {
            errorMessage = "Content script not loaded";
            errorDetails = "Please refresh the AWS Console page and try again";
          } else if (error.message.includes('receiving end does not exist')) {
            errorMessage = "Content script disconnected";
            errorDetails = "Page may have been refreshed or navigated away";
          } else if (error.message.includes('message port closed')) {
            errorMessage = "Communication channel closed";
            errorDetails = "Please try again or refresh the page";
          } else {
            errorDetails = error.message;
          }
        }

        return {
          type: "session",
          message: errorMessage,
          details: errorDetails
        } as ExtensionError;
      }
    }

    // Unknown message type
    return {
      type: "permission",
      message: "Unknown message action",
      details: `Received action: ${message.action}`
    } as ExtensionError;

  } catch (error) {
    return {
      type: "session",
      message: "Background script error",
      details: error instanceof Error ? error.message : "Unknown error"
    } as ExtensionError;
  }
}

/**
 * Validate that a tab is an AWS Console page with comprehensive error handling
 * @param tabId - Chrome tab ID to validate
 * @returns Promise<boolean> - True if tab is AWS Console page
 */
async function validateAwsConsoleTab(tabId: number): Promise<boolean> {
  try {
    if (!tabId || typeof tabId !== 'number' || tabId < 0) {
      console.error('Invalid tab ID provided:', tabId);
      return false;
    }

    const tab = await chrome.tabs.get(tabId);
    
    if (!tab) {
      console.error('Tab not found:', tabId);
      return false;
    }

    if (!tab.url) {
      console.error('Tab URL not accessible:', tabId);
      return false;
    }

    // Check if tab is still active and not closed
    if (tab.status === 'unloaded') {
      console.error('Tab is unloaded:', tabId);
      return false;
    }

    // Use the URL validation function from url-processor
    const isValid = validateAwsConsoleUrl(tab.url);
    
    if (!isValid) {
      console.warn('Tab is not an AWS Console page:', tab.url);
    }

    return isValid;
    
  } catch (error) {
    console.error('Error validating AWS Console tab:', error);
    
    // Handle specific Chrome API errors
    if (error instanceof Error) {
      if (error.message.includes('No tab with id')) {
        console.error('Tab does not exist:', tabId);
      } else if (error.message.includes('Cannot access')) {
        console.error('Permission denied accessing tab:', tabId);
      }
    }
    
    return false;
  }
}

/**
 * Initialize extension on install/startup
 * Sets up event listeners and default configuration
 */
function initializeExtension(): void {
  console.log('AWS Console Link Sharer extension initialized');
  
  // Set up message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle async message processing
    handleMessage(message, sender)
      .then(response => {
        sendResponse(response);
      })
      .catch(error => {
        sendResponse({
          type: "session",
          message: "Message handling failed",
          details: error instanceof Error ? error.message : "Unknown error"
        } as ExtensionError);
      });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  });

  // Set up extension lifecycle events
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      console.log('AWS Console Link Sharer extension installed');
      // Could open options page on first install if needed
    } else if (details.reason === 'update') {
      console.log('AWS Console Link Sharer extension updated');
    }
  });
}

// Initialize the extension when the service worker starts
initializeExtension();