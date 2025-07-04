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

type RoleSelectionStrategy = "current" | "default" | "account-map";

interface AccountRoleMap {
  [accountId: string]: string;
}

/**
 * Extract AWS Account ID from the console DOM
 * Looks for the account ID in the global navigation area with multiple fallback strategies
 */
function extractAccountId(): string | null {
  try {
    // Strategy 1: Primary selector for account ID copy button (most reliable)
    const primarySelectors = [
      '[data-testid="awsc-copy-accountid"] + span',
      '[data-testid="awsc-copy-accountid"]',
      '[data-testid="account-detail-menu"] [data-testid="awsc-copy-accountid"]',
    ];

    for (const selector of primarySelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        const accountId = element.textContent.trim();
        // Validate account ID format (6-12 digits for flexibility)
        if (/^\d{6,12}$/.test(accountId)) {
          return accountId;
        }
      }
    }

    // Strategy 2: Look in account detail menu and navigation areas
    const navigationSelectors = [
      '[data-testid="account-detail-menu"] span',
      ".awsui-util-f-l span[title]",
      ".globalNav-22142 span",
      '[data-testid="awsc-username-display"]',
      ".awsc-username-display",
      "#nav-usernameMenu span",
      ".nav-elt-label span",
    ];

    for (const selector of navigationSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (element?.textContent) {
          const text = element.textContent.trim();
          // Look for account ID pattern in text
          const accountMatch = text.match(/\b(\d{6,12})\b/);
          if (accountMatch && /^\d{6,12}$/.test(accountMatch[1])) {
            return accountMatch[1];
          }
        }
      }
    }

    // Strategy 3: Look in page title or meta information
    const titleElement = document.querySelector("title");
    if (titleElement?.textContent) {
      const titleMatch = titleElement.textContent.match(/\b(\d{6,12})\b/);
      if (titleMatch && /^\d{6,12}$/.test(titleMatch[1])) {
        return titleMatch[1];
      }
    }

    // Strategy 4: Extract from URL if it's a multi-account URL
    const currentUrl = window.location.href;
    const urlMatch = currentUrl.match(/https:\/\/(\d{6,12})-[a-z0-9]+\./);
    if (urlMatch && /^\d{6,12}$/.test(urlMatch[1])) {
      return urlMatch[1];
    }

    // Strategy 5: Look in any element containing account-like numbers (limited search)
    const candidateElements = document.querySelectorAll(
      '[class*="account"], [id*="account"], [data-account]'
    );
    for (const element of candidateElements) {
      if (element.textContent && element.textContent.length < 50) {
        // Avoid large text blocks
        const text = element.textContent.trim();
        const accountMatch = text.match(/^\d{6,12}$/);
        if (accountMatch) {
          return accountMatch[0];
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting account ID:", error);
    return null;
  }
}

/**
 * Extract role name from federated user string
 * Parses role name from various AWS SSO and federated user formats with multiple fallback strategies
 */
function extractRoleName(): string | null {
  try {
    // Strategy 1: Look for the role in data-testid attribute (most reliable)
    // Format: data-testid="RoleName/email@domain.com"
    const roleElements = document.querySelectorAll('[data-testid*="/"]');
    for (const element of roleElements) {
      const testId = element.getAttribute("data-testid");
      if (testId && testId.includes("/") && testId.includes("@")) {
        // Extract role name before the slash
        const roleName = testId.split("/")[0].trim();
        if (roleName && roleName.length > 0) {
          console.log("Found role name from data-testid:", roleName);
          return roleName;
        }
      }
    }

    // Strategy 2: Look for role in span text content with email pattern
    // Format: "RoleName/email@domain.com"
    const spanElements = document.querySelectorAll("span");
    for (const span of spanElements) {
      if (span.textContent) {
        const text = span.textContent.trim();
        // Look for pattern: RoleName/email@domain.com
        const roleEmailMatch = text.match(
          /^([^/\s]+)\/[^@\s]+@[^@\s]+\.[^@\s]+$/
        );
        if (roleEmailMatch && roleEmailMatch[1]) {
          console.log("Found role name from span text:", roleEmailMatch[1]);
          return roleEmailMatch[1];
        }
      }
    }

    // Strategy 3: Fallback to original complex patterns for other AWS setups
    const primarySelectors = [
      '[data-testid="awsc-username-display"]',
      ".awsc-username-display",
      ".globalNav-22142",
      ".awsui-util-f-l",
      '[data-testid="account-detail-menu"]',
      "#nav-usernameMenu",
      ".nav-elt-label",
    ];

    for (const selector of primarySelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (element?.textContent) {
          const text = element.textContent.trim();

          // Pattern 1: AWSReservedSSO_RoleName_randomstring/email
          const ssoRoleMatch = text.match(
            /AWSReservedSSO_([^_\s]+)_[^/\s]+(?:\/|$)/
          );
          if (ssoRoleMatch && ssoRoleMatch[1]) {
            return ssoRoleMatch[1];
          }

          // Pattern 2: arn:aws:sts::account:assumed-role/RoleName/session
          const arnRoleMatch = text.match(/assumed-role\/([^/\s]+)(?:\/|$)/);
          if (arnRoleMatch && arnRoleMatch[1]) {
            return arnRoleMatch[1];
          }

          // Pattern 3: Direct role name patterns (common role naming conventions)
          const rolePatterns = [
            /\b([A-Za-z][A-Za-z0-9]*(?:Access|Role|Admin|User|Manager|Developer|ReadOnly|FullAccess))\b/,
            /\b(Admin|Developer|ReadOnly|PowerUser|ViewOnly|Billing|Support)\b/,
            /\b([A-Z][a-zA-Z0-9]*(?:Access|Role))\b/,
          ];

          for (const pattern of rolePatterns) {
            const roleMatch = text.match(pattern);
            if (roleMatch && roleMatch[1] && roleMatch[1].length > 2) {
              return roleMatch[1];
            }
          }
        }
      }
    }

    // Strategy 2: Look in page source for role information
    const scriptTags = document.querySelectorAll("script");
    for (const script of scriptTags) {
      if (script.textContent) {
        const text = script.textContent;

        // Look for role in JSON configurations
        const jsonRoleMatch = text.match(
          /"(?:role|roleName|assumedRole)":\s*"([^"]+)"/i
        );
        if (jsonRoleMatch && jsonRoleMatch[1]) {
          return jsonRoleMatch[1];
        }

        // Look for SSO role patterns in scripts
        const scriptSsoMatch = text.match(/AWSReservedSSO_([^_\s"]+)_/);
        if (scriptSsoMatch && scriptSsoMatch[1]) {
          return scriptSsoMatch[1];
        }
      }
    }

    // Strategy 3: Look in meta tags or data attributes
    const metaElements = document.querySelectorAll(
      'meta[name*="role"], meta[property*="role"], [data-role], [data-user-role]'
    );
    for (const meta of metaElements) {
      const content =
        meta.getAttribute("content") ||
        meta.getAttribute("data-role") ||
        meta.getAttribute("data-user-role");
      if (content && content.trim().length > 0) {
        // Clean and validate role name
        const cleanRole = content.trim().replace(/[^a-zA-Z0-9+=,.@_-]/g, "");
        if (cleanRole.length > 2 && /^[a-zA-Z]/.test(cleanRole)) {
          return cleanRole;
        }
      }
    }

    // Strategy 4: Look for role in URL parameters or fragments
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam =
      urlParams.get("role") ||
      urlParams.get("roleName") ||
      urlParams.get("assumedRole");
    if (roleParam && roleParam.trim().length > 0) {
      return roleParam.trim();
    }

    // Strategy 5: Extract from session storage or local storage (if accessible)
    try {
      const sessionKeys = [
        "aws-console-session",
        "awsConsoleSession",
        "aws-role",
        "awsRole",
      ];
      for (const key of sessionKeys) {
        const sessionData =
          sessionStorage.getItem(key) || localStorage.getItem(key);
        if (sessionData) {
          const roleMatch = sessionData.match(
            /"(?:role|roleName)":\s*"([^"]+)"/
          );
          if (roleMatch && roleMatch[1]) {
            return roleMatch[1];
          }
        }
      }
    } catch (storageError) {
      // Storage access might be restricted, continue with other strategies
      console.warn("Storage access restricted:", storageError);
    }

    return null;
  } catch (error) {
    console.error("Error extracting role name:", error);
    return null;
  }
}

/**
 * Get the current page URL
 */
function getCurrentUrl(): string {
  return window.location.href;
}

/**
 * Check if the current URL is a multi-account URL format
 * Multi-account URLs have format: https://123456-randomchars.region.console.aws.amazon.com/
 */
function isMultiAccountUrl(url: string): boolean {
  try {
    if (!url || typeof url !== "string") {
      return false;
    }

    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Pattern: accountid-randomchars.region.console.aws.amazon.com
    const multiAccountPattern =
      /^\d{6,12}-[a-z0-9]+\.[a-z0-9-]+\.console\.aws\.amazon\.com$/;
    return multiAccountPattern.test(hostname);
  } catch (error) {
    console.error("Error checking multi-account URL:", error);
    return false;
  }
}

/**
 * Extract AWS region from the current URL with enhanced error handling
 */
function extractRegion(): string {
  try {
    const url = getCurrentUrl();

    if (!url || typeof url !== "string") {
      console.warn("Invalid URL for region extraction, using default");
      return "us-east-1";
    }

    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Pattern: *.region.console.aws.amazon.com
    const regionMatch = hostname.match(
      /\.([a-z0-9-]+)\.console\.aws\.amazon\.com$/
    );
    if (regionMatch && regionMatch[1]) {
      // Validate region format
      const region = regionMatch[1];
      if (/^[a-z]{2}-[a-z]+-\d+$/.test(region)) {
        return region;
      }
    }

    // Fallback: look for region in URL path or query params
    const pathRegionMatch = url.match(/[?&]region=([a-z0-9-]+)/);
    if (pathRegionMatch && pathRegionMatch[1]) {
      const region = pathRegionMatch[1];
      if (/^[a-z]{2}-[a-z]+-\d+$/.test(region)) {
        return region;
      }
    }

    // Additional fallback: check for region in hash
    const hashRegionMatch = url.match(/#.*region[=:]([a-z0-9-]+)/);
    if (hashRegionMatch && hashRegionMatch[1]) {
      const region = hashRegionMatch[1];
      if (/^[a-z]{2}-[a-z]+-\d+$/.test(region)) {
        return region;
      }
    }

    console.warn("Could not extract valid region from URL, using default");
    return "us-east-1"; // Default region
  } catch (error) {
    console.error("Error extracting region:", error);
    return "us-east-1";
  }
}

/**
 * Validate extracted session information
 */
function validateSessionData(
  accountId: string | null,
  roleName: string | null,
  currentUrl: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!accountId) {
    errors.push("Account ID could not be extracted from the page");
  } else if (!/^\d{6,12}$/.test(accountId)) {
    errors.push("Account ID format is invalid");
  }

  if (!roleName) {
    errors.push("Role name could not be extracted from the page");
  } else if (roleName.trim().length === 0) {
    errors.push("Role name is empty");
  } else if (!/^[a-zA-Z0-9+=,.@_-]+$/.test(roleName)) {
    errors.push("Role name contains invalid characters");
  }

  if (!currentUrl || !currentUrl.includes("console.aws.amazon.com")) {
    errors.push("Current page is not a valid AWS Console page");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Aggregate all session information from the AWS Console page with comprehensive error handling
 */
async function getSessionInfo(): Promise<SessionInfo> {
  try {
    const currentUrl = getCurrentUrl();

    // Validate we're on an AWS Console page
    if (!currentUrl.includes("console.aws.amazon.com")) {
      throw new Error(
        "This extension only works on AWS Console pages. Current page: " +
          window.location.hostname
      );
    }

    const accountId = extractAccountId();
    const roleName = extractRoleName();
    const region = extractRegion();
    const isMultiAccount = isMultiAccountUrl(currentUrl);

    // Validate extracted information
    const validation = validateSessionData(accountId, roleName, currentUrl);
    if (!validation.valid) {
      const errorMessage =
        "Session extraction failed: " + validation.errors.join("; ");

      // Provide helpful guidance based on the type of error
      if (validation.errors.some((e) => e.includes("Account ID"))) {
        throw new Error(
          errorMessage +
            ". Please ensure you are logged into the AWS Console and the page has fully loaded."
        );
      } else if (validation.errors.some((e) => e.includes("Role name"))) {
        throw new Error(
          errorMessage +
            ". This may occur if you are not using AWS SSO or federated access. Deep link generation requires SSO authentication."
        );
      } else {
        throw new Error(errorMessage);
      }
    }

    return {
      accountId: accountId!,
      roleName: roleName!,
      currentUrl,
      isMultiAccount,
      region,
    };
  } catch (error) {
    console.error("Error getting session info:", error);

    // Enhance error message with context
    if (error instanceof Error) {
      throw new Error(`Session extraction failed: ${error.message}`);
    } else {
      throw new Error("Session extraction failed due to an unknown error");
    }
  }
}

/**
 * Handle messages from popup/background script with comprehensive error handling
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    // Validate message structure
    if (!message || typeof message !== "object" || !message.action) {
      sendResponse({
        success: false,
        error: "Invalid message format - action is required",
      });
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
            const errorMessage =
              error instanceof Error
                ? error.message
                : "Failed to extract session information";
            console.error("Session info extraction error:", errorMessage);
            sendResponse({
              success: false,
              error: errorMessage,
            });
          });
        return true; // Keep message channel open for async response

      case "getCurrentUrl":
        try {
          const currentUrl = getCurrentUrl();
          if (!currentUrl || !currentUrl.includes("console.aws.amazon.com")) {
            sendResponse({
              success: false,
              error: "Current page is not an AWS Console page",
            });
          } else {
            sendResponse({
              success: true,
              data: { currentUrl },
            });
          }
        } catch (error) {
          sendResponse({
            success: false,
            error:
              "Failed to get current URL: " +
              (error instanceof Error ? error.message : "Unknown error"),
          });
        }
        return false;

      default:
        sendResponse({
          success: false,
          error: `Unknown action: ${message.action}. Supported actions: getSessionInfo, getCurrentUrl`,
        });
        return false;
    }
  } catch (error) {
    console.error("Error handling message:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error occurred in content script";
    sendResponse({
      success: false,
      error: `Message handling failed: ${errorMessage}`,
    });
    return false;
  }
});

// Initialize content script with error handling
try {
  console.log(
    "AWS Console Link Sharer content script loaded on:",
    window.location.hostname
  );

  // Validate we're on the right domain
  if (!window.location.hostname.includes("console.aws.amazon.com")) {
    console.warn("AWS Console Link Sharer: Not on AWS Console domain");
  }
} catch (error) {
  console.error("AWS Console Link Sharer: Initialization error:", error);
}
