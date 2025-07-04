/**
 * URL processing logic for AWS Console Link Sharer extension
 * Handles URL cleaning and deep link generation
 */

import { SessionInfo, ExtensionConfig, UrlResult } from './types/index.js';

/**
 * Clean URL by removing account ID and random character prefix
 * @param url - Original AWS Console URL
 * @returns Cleaned URL without account prefix
 */
export function cleanUrl(url: string): UrlResult {
  try {
    // Validate input URL
    if (!url || typeof url !== 'string') {
      return {
        success: false,
        error: "Invalid URL provided - URL cannot be empty or null",
        type: "clean"
      };
    }

    if (url.trim().length === 0) {
      return {
        success: false,
        error: "Invalid URL provided - URL cannot be empty",
        type: "clean"
      };
    }

    // Parse the URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      return {
        success: false,
        error: `Invalid URL format: ${error instanceof Error ? error.message : 'Unable to parse URL'}`,
        type: "clean"
      };
    }

    // Validate protocol
    if (parsedUrl.protocol !== 'https:') {
      return {
        success: false,
        error: "AWS Console URLs must use HTTPS protocol",
        type: "clean"
      };
    }

    // Check if it's an AWS Console URL with comprehensive validation
    if (!validateAwsConsoleUrl(url)) {
      return {
        success: false,
        error: "URL is not a valid AWS Console URL. Expected format: https://*.console.aws.amazon.com/*",
        type: "clean"
      };
    }

    // Check if URL has multi-account format (account ID and random chars prefix)
    const multiAccountPattern = /^(\d{6,12})-([a-z0-9]+)\.(.+)$/;
    const match = parsedUrl.hostname.match(multiAccountPattern);

    if (!match) {
      // URL doesn't have multi-account format, validate it's still a proper AWS Console URL
      if (!parsedUrl.hostname.endsWith('.console.aws.amazon.com') && parsedUrl.hostname !== 'console.aws.amazon.com') {
        return {
          success: false,
          error: "Invalid AWS Console hostname format",
          type: "clean"
        };
      }
      
      // Return as-is for non-multi-account URLs
      return {
        success: true,
        url: url,
        type: "clean"
      };
    }

    // Validate account ID format
    const accountId = match[1];
    if (!/^\d{6,12}$/.test(accountId)) {
      return {
        success: false,
        error: "Invalid account ID format in URL - must be 6-12 digits",
        type: "clean"
      };
    }

    // Validate random chars format
    const randomChars = match[2];
    if (!/^[a-z0-9]+$/.test(randomChars)) {
      return {
        success: false,
        error: "Invalid URL format - random characters must be alphanumeric lowercase",
        type: "clean"
      };
    }

    // Extract the base hostname without account prefix
    const baseHostname = match[3]; // e.g., "eu-west-1.console.aws.amazon.com"
    
    // Validate base hostname
    if (!baseHostname.endsWith('.console.aws.amazon.com')) {
      return {
        success: false,
        error: "Invalid base hostname format after removing account prefix",
        type: "clean"
      };
    }
    
    // Construct cleaned URL
    const cleanedUrl = new URL(parsedUrl.toString());
    cleanedUrl.hostname = baseHostname;

    return {
      success: true,
      url: cleanedUrl.toString(),
      type: "clean"
    };

  } catch (error) {
    return {
      success: false,
      error: `URL cleaning failed: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
      type: "clean"
    };
  }
}

/**
 * Check if URL has multi-account format
 * @param url - URL to check
 * @returns True if URL has account ID prefix
 */
export function isMultiAccountUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const multiAccountPattern = /^(\d{12})-([a-z0-9]+)\.(.+)$/;
    return multiAccountPattern.test(parsedUrl.hostname);
  } catch {
    return false;
  }
}

/**
 * Generate AWS SSO deep link
 * @param sessionInfo - Current session information
 * @param config - Extension configuration
 * @returns Deep link URL result
 */
export function generateDeepLink(sessionInfo: SessionInfo, config: ExtensionConfig): UrlResult {
  try {
    // Validate configuration object
    if (!config || typeof config !== 'object') {
      return {
        success: false,
        error: "Extension configuration is missing or invalid",
        type: "deeplink"
      };
    }

    // Validate required configuration
    if (!config.ssoSubdomain || typeof config.ssoSubdomain !== 'string' || config.ssoSubdomain.trim() === '') {
      return {
        success: false,
        error: "AWS SSO subdomain not configured. Please set it in extension options.",
        type: "deeplink"
      };
    }

    // Validate subdomain format
    const subdomain = config.ssoSubdomain.trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(subdomain) || subdomain.length > 63) {
      return {
        success: false,
        error: "Invalid AWS SSO subdomain format. Must be alphanumeric with hyphens, 2-63 characters.",
        type: "deeplink"
      };
    }

    // Validate session information object
    if (!sessionInfo || typeof sessionInfo !== 'object') {
      return {
        success: false,
        error: "Session information is missing or invalid",
        type: "deeplink"
      };
    }

    // Validate required session fields
    const missingFields = [];
    if (!sessionInfo.accountId || typeof sessionInfo.accountId !== 'string') {
      missingFields.push('account ID');
    }
    if (!sessionInfo.roleName || typeof sessionInfo.roleName !== 'string') {
      missingFields.push('role name');
    }
    if (!sessionInfo.currentUrl || typeof sessionInfo.currentUrl !== 'string') {
      missingFields.push('current URL');
    }

    if (missingFields.length > 0) {
      return {
        success: false,
        error: `Missing required session information: ${missingFields.join(', ')}`,
        type: "deeplink"
      };
    }

    // Validate account ID format (6-12 digits for flexibility)
    if (!/^\d{6,12}$/.test(sessionInfo.accountId)) {
      return {
        success: false,
        error: "Invalid account ID format - must be 6-12 digits",
        type: "deeplink"
      };
    }

    // Validate role name format
    if (sessionInfo.roleName.trim().length === 0) {
      return {
        success: false,
        error: "Role name cannot be empty",
        type: "deeplink"
      };
    }

    if (!/^[a-zA-Z0-9+=,.@_-]+$/.test(sessionInfo.roleName)) {
      return {
        success: false,
        error: "Invalid role name format - contains unsupported characters",
        type: "deeplink"
      };
    }

    // Validate current URL
    if (!validateAwsConsoleUrl(sessionInfo.currentUrl)) {
      return {
        success: false,
        error: "Current URL is not a valid AWS Console URL",
        type: "deeplink"
      };
    }

    // Clean the destination URL first
    const cleanedUrlResult = cleanUrl(sessionInfo.currentUrl);
    if (!cleanedUrlResult.success) {
      return {
        success: false,
        error: `Failed to clean destination URL: ${cleanedUrlResult.error}`,
        type: "deeplink"
      };
    }

    const destinationUrl = cleanedUrlResult.url!;

    // Construct deep link URL with validation
    let deepLinkUrl: URL;
    try {
      deepLinkUrl = new URL(`https://${subdomain}.awsapps.com/start/`);
    } catch (error) {
      return {
        success: false,
        error: `Invalid SSO subdomain: ${error instanceof Error ? error.message : 'Unable to construct URL'}`,
        type: "deeplink"
      };
    }
    
    // Add fragment with parameters
    try {
      const params = new URLSearchParams({
        account_id: sessionInfo.accountId,
        role_name: sessionInfo.roleName,
        destination: destinationUrl
      });
      
      deepLinkUrl.hash = `/console?${params.toString()}`;
    } catch (error) {
      return {
        success: false,
        error: `Failed to construct deep link parameters: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: "deeplink"
      };
    }

    // Final validation of generated URL
    const finalUrl = deepLinkUrl.toString();
    if (finalUrl.length > 2048) {
      return {
        success: false,
        error: "Generated deep link URL is too long (>2048 characters)",
        type: "deeplink"
      };
    }

    return {
      success: true,
      url: finalUrl,
      type: "deeplink"
    };

  } catch (error) {
    return {
      success: false,
      error: `Deep link generation failed: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
      type: "deeplink"
    };
  }
}

/**
 * Validate AWS Console URL format
 * @param url - URL to validate
 * @returns True if URL is valid AWS Console URL
 */
export function validateAwsConsoleUrl(url: string): boolean {
  try {
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return false;
    }

    const parsedUrl = new URL(url);
    
    // Must use HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }
    
    // Must be AWS Console domain
    const hostname = parsedUrl.hostname.toLowerCase();
    return hostname.endsWith('.console.aws.amazon.com') || hostname === 'console.aws.amazon.com';
  } catch {
    return false;
  }
}

/**
 * Validate session information completeness and format
 * @param sessionInfo - Session information to validate
 * @returns Validation result with details
 */
export function validateSessionInfo(sessionInfo: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!sessionInfo || typeof sessionInfo !== 'object') {
    return { valid: false, errors: ['Session information is missing or not an object'] };
  }

  // Validate account ID
  if (!sessionInfo.accountId) {
    errors.push('Account ID is missing');
  } else if (typeof sessionInfo.accountId !== 'string') {
    errors.push('Account ID must be a string');
  } else if (!/^\d{6,12}$/.test(sessionInfo.accountId)) {
    errors.push('Account ID must be 6-12 digits');
  }

  // Validate role name
  if (!sessionInfo.roleName) {
    errors.push('Role name is missing');
  } else if (typeof sessionInfo.roleName !== 'string') {
    errors.push('Role name must be a string');
  } else if (sessionInfo.roleName.trim().length === 0) {
    errors.push('Role name cannot be empty');
  } else if (!/^[a-zA-Z0-9+=,.@_-]+$/.test(sessionInfo.roleName)) {
    errors.push('Role name contains invalid characters');
  }

  // Validate current URL
  if (!sessionInfo.currentUrl) {
    errors.push('Current URL is missing');
  } else if (typeof sessionInfo.currentUrl !== 'string') {
    errors.push('Current URL must be a string');
  } else if (!validateAwsConsoleUrl(sessionInfo.currentUrl)) {
    errors.push('Current URL is not a valid AWS Console URL');
  }

  // Validate region
  if (!sessionInfo.region) {
    errors.push('Region is missing');
  } else if (typeof sessionInfo.region !== 'string') {
    errors.push('Region must be a string');
  } else if (!/^[a-z0-9-]+$/.test(sessionInfo.region)) {
    errors.push('Region format is invalid');
  }

  // Validate isMultiAccount
  if (typeof sessionInfo.isMultiAccount !== 'boolean') {
    errors.push('isMultiAccount must be a boolean');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate extension configuration
 * @param config - Configuration to validate
 * @returns Validation result with details
 */
export function validateExtensionConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Configuration is missing or not an object'] };
  }

  // Validate SSO subdomain
  if (!config.ssoSubdomain) {
    errors.push('AWS SSO subdomain is required');
  } else if (typeof config.ssoSubdomain !== 'string') {
    errors.push('AWS SSO subdomain must be a string');
  } else {
    const subdomain = config.ssoSubdomain.trim();
    if (subdomain.length === 0) {
      errors.push('AWS SSO subdomain cannot be empty');
    } else if (subdomain.length > 63) {
      errors.push('AWS SSO subdomain cannot exceed 63 characters');
    } else if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(subdomain)) {
      errors.push('AWS SSO subdomain format is invalid (must be alphanumeric with hyphens, no leading/trailing hyphens)');
    }
  }

  // Validate default action
  if (config.defaultAction && !['clean', 'deeplink'].includes(config.defaultAction)) {
    errors.push('Default action must be either "clean" or "deeplink"');
  }

  // Validate boolean flags
  if (config.showNotifications !== undefined && typeof config.showNotifications !== 'boolean') {
    errors.push('showNotifications must be a boolean');
  }

  if (config.autoClosePopup !== undefined && typeof config.autoClosePopup !== 'boolean') {
    errors.push('autoClosePopup must be a boolean');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Extract region from AWS Console URL
 * @param url - AWS Console URL
 * @returns AWS region or null if not found
 */
export function extractRegionFromUrl(url: string): string | null {
  try {
    if (!url || typeof url !== 'string') {
      return null;
    }

    const parsedUrl = new URL(url);
    
    // Pattern to match region in hostname: region.console.aws.amazon.com
    // or account-random.region.console.aws.amazon.com
    const regionPattern = /(?:^|\.)([a-z]{2}-[a-z]+-\d+)\.console\.aws\.amazon\.com/;
    const match = parsedUrl.hostname.match(regionPattern);
    
    if (match && match[1]) {
      // Validate region format
      const region = match[1];
      if (/^[a-z]{2}-[a-z]+-\d+$/.test(region)) {
        return region;
      }
    }

    // Fallback: check URL parameters
    const urlParams = new URLSearchParams(parsedUrl.search);
    const regionParam = urlParams.get('region');
    if (regionParam && /^[a-z]{2}-[a-z]+-\d+$/.test(regionParam)) {
      return regionParam;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Create detailed error information for debugging
 * @param error - Error object or message
 * @param context - Additional context information
 * @returns Formatted error details
 */
export function createErrorDetails(error: unknown, context?: string): string {
  let details = '';
  
  if (context) {
    details += `Context: ${context}. `;
  }
  
  if (error instanceof Error) {
    details += `Error: ${error.message}`;
    if (error.stack) {
      details += `. Stack: ${error.stack.split('\n')[0]}`;
    }
  } else if (typeof error === 'string') {
    details += `Error: ${error}`;
  } else {
    details += `Error: ${JSON.stringify(error)}`;
  }
  
  return details;
}

/**
 * Handle configuration errors with specific guidance
 * @param config - Configuration object to check
 * @returns Error message with guidance or null if valid
 */
export function getConfigurationErrorMessage(config: any): string | null {
  const validation = validateExtensionConfig(config);
  
  if (!validation.valid) {
    const errors = validation.errors;
    let message = 'Configuration Error: ';
    
    if (errors.some(e => e.includes('subdomain'))) {
      message += 'AWS SSO subdomain is not properly configured. ';
      message += 'Please go to extension options and enter your organization\'s AWS SSO subdomain. ';
      message += 'Example: if your SSO URL is "https://mycompany.awsapps.com", enter "mycompany".';
    } else {
      message += errors.join('; ');
    }
    
    return message;
  }
  
  return null;
}

/**
 * Handle session extraction errors with specific guidance
 * @param sessionInfo - Session information to check
 * @returns Error message with guidance or null if valid
 */
export function getSessionErrorMessage(sessionInfo: any): string | null {
  const validation = validateSessionInfo(sessionInfo);
  
  if (!validation.valid) {
    const errors = validation.errors;
    let message = 'Session Error: ';
    
    if (errors.some(e => e.includes('Account ID'))) {
      message += 'Unable to extract AWS account ID from this page. ';
      message += 'Please ensure you are on an AWS Console page and logged in properly.';
    } else if (errors.some(e => e.includes('Role name'))) {
      message += 'Unable to extract role name from your session. ';
      message += 'This may happen if you are not using AWS SSO or federated access.';
    } else if (errors.some(e => e.includes('URL'))) {
      message += 'Current page URL is not a valid AWS Console URL. ';
      message += 'Please navigate to an AWS Console page.';
    } else {
      message += errors.join('; ');
    }
    
    return message;
  }
  
  return null;
}

/**
 * Provide fallback options when operations fail
 * @param operationType - Type of operation that failed
 * @param originalUrl - Original URL for fallback
 * @returns Fallback suggestions
 */
export function getFallbackOptions(operationType: 'clean' | 'deeplink', originalUrl?: string): string[] {
  const options: string[] = [];
  
  if (operationType === 'clean' && originalUrl) {
    options.push('Try copying the current URL manually');
    options.push('Check if you are on a multi-account AWS Console page');
    options.push('Refresh the page and try again');
  } else if (operationType === 'deeplink') {
    options.push('Configure your AWS SSO subdomain in extension options');
    options.push('Ensure you are logged in with AWS SSO');
    options.push('Try using the clean URL option instead');
    options.push('Contact your AWS administrator for SSO configuration details');
  }
  
  return options;
}