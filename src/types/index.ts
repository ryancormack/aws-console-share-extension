// Core data models for the AWS Console Link Sharer extension

/**
 * Session information extracted from AWS Console pages
 */
export interface SessionInfo {
  /** AWS Account ID (e.g., "604663847695") */
  accountId: string;
  /** Extracted role name (e.g., "PlatformManagementAccess") */
  roleName: string;
  /** Current page URL */
  currentUrl: string;
  /** Whether URL has account prefix */
  isMultiAccount: boolean;
  /** AWS region from URL */
  region: string;
}

/**
 * Role selection strategy for deep link generation
 */
export type RoleSelectionStrategy = "current" | "default" | "account-map";

/**
 * Account to role mapping for specific accounts
 */
export interface AccountRoleMap {
  [accountId: string]: string;
}

/**
 * Extension configuration stored in Chrome storage
 */
export interface ExtensionConfig {
  /** AWS SSO subdomain (required for deep links) */
  ssoSubdomain: string;
  /** Default action preference */
  defaultAction: "clean" | "deeplink";
  /** Show success/error notifications */
  showNotifications: boolean;
  /** Auto-close popup after action */
  autoClosePopup: boolean;
  /** Role selection strategy */
  roleSelectionStrategy: RoleSelectionStrategy;
  /** Default role name to use when strategy is "default" or as fallback */
  defaultRoleName: string;
  /** Account ID to role name mapping */
  accountRoleMap: AccountRoleMap;
}

/**
 * Result of URL processing operations
 */
export interface UrlResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Generated URL if successful */
  url?: string;
  /** Error message if failed */
  error?: string;
  /** Type of operation performed */
  type: "clean" | "deeplink";
}

// Message types for inter-component communication

/**
 * Messages sent from popup to background/content scripts
 */
export interface PopupMessage {
  action: "getSessionInfo" | "getCurrentUrl" | "cleanUrl" | "generateDeepLink";
  tabId?: number;
  url?: string;
  sessionInfo?: SessionInfo;
  config?: ExtensionConfig;
}

/**
 * Messages sent from background script to content scripts
 */
export interface BackgroundMessage {
  action: "forwardToContent";
  message: PopupMessage;
  tabId: number;
}

/**
 * Messages sent from content script
 */
export interface ContentMessage {
  action: "getSessionInfo" | "getCurrentUrl";
}

/**
 * Response from content script with session information
 */
export interface ContentResponse {
  accountId: string;
  roleName: string;
  currentUrl: string;
  isMultiAccount: boolean;
  region: string;
}

/**
 * Union type for all extension messages
 */
export type ExtensionMessage = PopupMessage | BackgroundMessage | ContentMessage;

/**
 * Error types for better error handling
 */
export interface ExtensionError {
  type: "config" | "session" | "url" | "permission" | "network" | "storage";
  message: string;
  details?: string;
  code?: string;
  recoverable?: boolean;
  suggestions?: string[];
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Enhanced response wrapper for all operations
 */
export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: ExtensionError;
  timestamp?: number;
}

/**
 * Error recovery suggestions
 */
export interface ErrorRecovery {
  canRetry: boolean;
  retryDelay?: number;
  maxRetries?: number;
  fallbackOptions?: string[];
  userActions?: string[];
}