// Type definitions (inlined to avoid ES module issues in content scripts)
interface SessionInfo {
  accountId: string;
  roleName: string;
  currentUrl: string;
  isMultiAccount: boolean;
  region: string;
}

interface ContentResponse {
  accountId: string;
  roleName: string;
  currentUrl: string;
  isMultiAccount: boolean;
  region: string;
}



/**
 * Extract AWS Account ID from the console DOM
 */
export function extractAccountId(): string | null {
  try {
    // Primary strategy: Look for account ID copy button
    const copyButton = document.querySelector('[data-testid="awsc-copy-accountid"]');
    if (copyButton?.textContent) {
      const accountId = copyButton.textContent.trim();
      if (/^\d{12}$/.test(accountId)) {
        return accountId;
      }
    }

    // Fallback: Look in navigation elements
    const navElements = document.querySelectorAll('[data-testid="account-detail-menu"] span, .awsc-username-display span');
    for (const element of navElements) {
      if (element?.textContent) {
        const match = element.textContent.match(/\b(\d{12})\b/);
        if (match) return match[1];
      }
    }

    // Last resort: Extract from multi-account URL
    const urlMatch = window.location.href.match(/https:\/\/(\d{12})-[a-z0-9]+\./);
    return urlMatch ? urlMatch[1] : null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract role name from federated user string
 */
export function extractRoleName(): string | null {
  try {
    // Strategy 1: Look for role/email pattern in data-testid or text
    const elements = document.querySelectorAll('[data-testid*="/"], span');
    for (const element of elements) {
      const text = element.getAttribute('data-testid') || element.textContent || '';
      const roleMatch = text.match(/^([^/\s]+)\/[^@\s]+@[^@\s]+\.[^@\s]+$/);
      if (roleMatch && roleMatch[1]) {
        return roleMatch[1];
      }
    }

    // Strategy 2: Look for AWS SSO role pattern
    const navElements = document.querySelectorAll('.awsc-username-display, [data-testid="awsc-username-display"]');
    for (const element of navElements) {
      if (element?.textContent) {
        const ssoMatch = element.textContent.match(/AWSReservedSSO_([^_\s]+)_/);
        if (ssoMatch && ssoMatch[1]) {
          return ssoMatch[1];
        }

        const arnMatch = element.textContent.match(/assumed-role\/([^/\s]+)/);
        if (arnMatch && arnMatch[1]) {
          return arnMatch[1];
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get the current page URL
 */
export function getCurrentUrl(): string {
  return window.location.href;
}

/**
 * Check if the current URL is a multi-account URL format
 */
export function isMultiAccountUrl(url: string): boolean {
  try {
    return /^\d{12}-[a-z0-9]+\./.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Extract AWS region from the current URL
 */
export function extractRegion(): string {
  try {
    const url = getCurrentUrl();
    const match = new URL(url).hostname.match(/([a-z]{2}-[a-z]+-\d+)\.console\.aws\.amazon\.com/);
    return match ? match[1] : "us-east-1";
  } catch {
    return "us-east-1";
  }
}

/**
 * Validate extracted session information
 */
export function validateSessionData(
  accountId: string | null,
  roleName: string | null,
  currentUrl: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!accountId || !/^\d{12}$/.test(accountId)) {
    errors.push("Could not extract valid account ID");
  }

  if (!roleName || roleName.trim().length === 0) {
    errors.push("Could not extract valid role name");
  }

  if (!currentUrl.includes("console.aws.amazon.com")) {
    errors.push("Not on AWS Console page");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Aggregate all session information from the AWS Console page
 */
export async function getSessionInfo(): Promise<SessionInfo> {
  const currentUrl = getCurrentUrl();

  if (!currentUrl.includes("console.aws.amazon.com")) {
    throw new Error("This extension only works on AWS Console pages");
  }

  const accountId = extractAccountId();
  const roleName = extractRoleName();
  const region = extractRegion();
  const isMultiAccount = isMultiAccountUrl(currentUrl);

  const validation = validateSessionData(accountId, roleName, currentUrl);
  if (!validation.valid) {
    throw new Error("Session extraction failed: " + validation.errors.join("; "));
  }

  return {
    accountId: accountId!,
    roleName: roleName!,
    currentUrl,
    isMultiAccount,
    region,
  };
}

/**
 * Handle messages from popup/background script
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.action) {
    sendResponse({ success: false, error: "Invalid message format" });
    return false;
  }

  switch (message.action) {
    case "getSessionInfo":
      getSessionInfo()
        .then((sessionInfo) => {
          const response: ContentResponse = {
            accountId: sessionInfo.accountId,
            roleName: sessionInfo.roleName,
            currentUrl: sessionInfo.currentUrl,
            isMultiAccount: sessionInfo.isMultiAccount,
            region: sessionInfo.region,
          };
          sendResponse({ success: true, data: response });
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Session extraction failed",
          });
        });
      return true; // Keep message channel open for async response

    case "getCurrentUrl":
      const currentUrl = getCurrentUrl();
      if (currentUrl.includes("console.aws.amazon.com")) {
        sendResponse({ success: true, data: { currentUrl } });
      } else {
        sendResponse({ success: false, error: "Not on AWS Console page" });
      }
      return false;

    default:
      sendResponse({ success: false, error: `Unknown action: ${message.action}` });
      return false;
  }
});

// Content script initialized and ready
