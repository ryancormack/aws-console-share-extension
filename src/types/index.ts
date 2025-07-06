export interface SessionInfo {
  accountId: string;
  roleName: string;
  currentUrl: string;
  isMultiAccount: boolean;
  region: string;
}

export type RoleSelectionStrategy = "current" | "default" | "account-map";

export interface AccountRoleMap {
  [accountId: string]: string;
}

export interface ExtensionConfig {
  ssoSubdomain: string;
  defaultAction: "clean" | "deeplink";
  showNotifications: boolean;
  autoClosePopup: boolean;
  roleSelectionStrategy: RoleSelectionStrategy;
  defaultRoleName: string;
  accountRoleMap: AccountRoleMap;
}

export interface UrlResult {
  success: boolean;
  url?: string;
  error?: string;
  type: "clean" | "deeplink";
}

export interface PopupMessage {
  action: "getSessionInfo" | "getCurrentUrl" | "cleanUrl" | "generateDeepLink";
  tabId?: number;
  url?: string;
  sessionInfo?: SessionInfo;
  config?: ExtensionConfig;
}

export interface BackgroundMessage {
  action: "forwardToContent";
  message: PopupMessage;
  tabId: number;
}

export interface ContentMessage {
  action: "getSessionInfo" | "getCurrentUrl";
}

export interface ContentResponse {
  accountId: string;
  roleName: string;
  currentUrl: string;
  isMultiAccount: boolean;
  region: string;
}

export type ExtensionMessage = PopupMessage | BackgroundMessage | ContentMessage;

export interface ExtensionError {
  type: "config" | "session" | "url" | "permission" | "network" | "storage";
  message: string;
  details?: string;
  code?: string;
  recoverable?: boolean;
  suggestions?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: ExtensionError;
  timestamp?: number;
}

export interface ErrorRecovery {
  canRetry: boolean;
  retryDelay?: number;
  maxRetries?: number;
  fallbackOptions?: string[];
  userActions?: string[];
}