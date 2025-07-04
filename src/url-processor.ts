/**
 * URL processing logic for AWS Console Link Sharer extension
 * Handles URL cleaning and deep link generation
 */

import { SessionInfo, ExtensionConfig, UrlResult } from './types/index.js';

/**
 * Clean URL by removing account ID and random character prefix
 */
export function cleanUrl(url: string): UrlResult {
  try {
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return { success: false, error: "Invalid URL provided", type: "clean" };
    }

    const parsedUrl = new URL(url);
    
    if (!parsedUrl.hostname.includes('console.aws.amazon.com')) {
      return { success: false, error: "Not an AWS Console URL", type: "clean" };
    }

    // Check for multi-account format: 123456789012-abc123.region.console.aws.amazon.com
    const match = parsedUrl.hostname.match(/^(\d{12})-[a-z0-9]+\.(.+)$/);
    if (match) {
      parsedUrl.hostname = match[2];
    }

    return { success: true, url: parsedUrl.toString(), type: "clean" };
  } catch {
    return { success: false, error: "Invalid URL format", type: "clean" };
  }
}

/**
 * Check if URL has multi-account format
 */
export function isMultiAccountUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return /^\d{12}-[a-z0-9]+\./.test(parsedUrl.hostname);
  } catch {
    return false;
  }
}

/**
 * Generate AWS SSO deep link
 */
export function generateDeepLink(sessionInfo: SessionInfo, config: ExtensionConfig): UrlResult {
  try {
    if (!config?.ssoSubdomain?.trim()) {
      return { success: false, error: "AWS SSO subdomain not configured", type: "deeplink" };
    }

    if (!sessionInfo?.accountId || !sessionInfo?.roleName || !sessionInfo?.currentUrl) {
      return { success: false, error: "Missing session information", type: "deeplink" };
    }

    // Clean the destination URL first
    const cleanedUrlResult = cleanUrl(sessionInfo.currentUrl);
    if (!cleanedUrlResult.success) {
      return { success: false, error: "Failed to clean destination URL", type: "deeplink" };
    }

    const deepLinkUrl = new URL(`https://${config.ssoSubdomain.trim()}.awsapps.com/start/`);
    const params = new URLSearchParams({
      account_id: sessionInfo.accountId,
      role_name: sessionInfo.roleName,
      destination: cleanedUrlResult.url!
    });
    
    deepLinkUrl.hash = `/console?${params.toString()}`;
    return { success: true, url: deepLinkUrl.toString(), type: "deeplink" };
  } catch {
    return { success: false, error: "Failed to generate deep link", type: "deeplink" };
  }
}

/**
 * Validate AWS Console URL format
 */
export function validateAwsConsoleUrl(url: string): boolean {
  try {
    if (!url) return false;
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' && parsedUrl.hostname.includes('console.aws.amazon.com');
  } catch {
    return false;
  }
}

/**
 * Validate session information
 */
export function validateSessionInfo(sessionInfo: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!sessionInfo) {
    errors.push('Session information is missing');
    return { valid: false, errors };
  }

  if (!sessionInfo.accountId || !/^\d{6,12}$/.test(sessionInfo.accountId)) {
    errors.push('Invalid account ID');
  }

  if (!sessionInfo.roleName || sessionInfo.roleName.trim().length === 0) {
    errors.push('Invalid role name');
  }

  if (!sessionInfo.currentUrl || !validateAwsConsoleUrl(sessionInfo.currentUrl)) {
    errors.push('Invalid current URL');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate extension configuration
 */
export function validateExtensionConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config) {
    errors.push('Configuration is missing');
    return { valid: false, errors };
  }

  if (!config.ssoSubdomain || typeof config.ssoSubdomain !== 'string' || config.ssoSubdomain.trim().length === 0) {
    errors.push('AWS SSO subdomain is required');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Extract region from AWS Console URL
 */
export function extractRegionFromUrl(url: string): string | null {
  try {
    if (!url) return null;
    
    const parsedUrl = new URL(url);
    const match = parsedUrl.hostname.match(/([a-z]{2}-[a-z]+-\d+)\.console\.aws\.amazon\.com/);
    
    if (match) return match[1];
    
    // Check URL parameters as fallback
    const regionParam = new URLSearchParams(parsedUrl.search).get('region');
    return regionParam && /^[a-z]{2}-[a-z]+-\d+$/.test(regionParam) ? regionParam : null;
  } catch {
    return null;
  }
}

