import { SessionInfo, ExtensionConfig, UrlResult } from "../types/index.js";
import { cleanUrl, generateDeepLink } from "../url-processor.js";

export class PopupManager {
  private currentSessionInfo: SessionInfo | null = null;
  private config: ExtensionConfig | null = null;

  async initializePopup(): Promise<void> {
    try {
      const tab = await this.validateCurrentTab();
      if (!tab) return;

      try {
        await this.loadConfiguration();
      } catch (configError) {
        console.error("Configuration loading failed:", configError);
        this.showError("Failed to load extension configuration. Some features may not work properly.");
      }

      try {
        await this.loadSessionInfo(tab.id!);
      } catch (sessionError) {
        console.error("Session info loading failed:", sessionError);
        this.showError("Unable to extract AWS session information. Please ensure you are logged in and the page has fully loaded.");
        this.disableButtons();
        return;
      }
      
      this.setupEventListeners();
      this.displayCurrentUrl();

      if (this.currentSessionInfo && this.config) {
        this.showSuccess("Extension loaded successfully!");
      }
    } catch (error) {
      console.error("Failed to initialize popup:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown initialization error";
      this.showError(`Failed to initialize extension: ${errorMessage}. Please refresh the page and try again.`);
      this.disableButtons();
    }
  }

  private async validateCurrentTab(): Promise<chrome.tabs.Tab | null> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      this.showError("Unable to access current tab. Please try again.");
      this.disableButtons();
      return null;
    }

    if (!tab.id) {
      this.showError("Invalid tab state. Please refresh the page and try again.");
      this.disableButtons();
      return null;
    }

    if (!tab.url) {
      this.showError("Unable to access current page URL. Please check permissions.");
      this.disableButtons();
      return null;
    }

    if (!this.isAwsConsoleUrl(tab.url)) {
      this.showError("This extension only works on AWS Console pages. Please navigate to console.aws.amazon.com.");
      this.disableButtons();
      return null;
    }

    return tab;
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get([
        "ssoSubdomain", "defaultAction", "showNotifications", "autoClosePopup",
        "roleSelectionStrategy", "defaultRoleName", "accountRoleMap"
      ]);

      this.config = {
        ssoSubdomain: typeof result.ssoSubdomain === "string" ? result.ssoSubdomain : "",
        defaultAction: ["clean", "deeplink"].includes(result.defaultAction) ? result.defaultAction : "clean",
        showNotifications: typeof result.showNotifications === "boolean" ? result.showNotifications : true,
        autoClosePopup: typeof result.autoClosePopup === "boolean" ? result.autoClosePopup : true,
        roleSelectionStrategy: ["current", "default", "account-map"].includes(result.roleSelectionStrategy) 
          ? result.roleSelectionStrategy : "current",
        defaultRoleName: typeof result.defaultRoleName === "string" ? result.defaultRoleName : "",
        accountRoleMap: typeof result.accountRoleMap === "object" && result.accountRoleMap !== null 
          ? result.accountRoleMap : {},
      };

      if (this.config.ssoSubdomain && this.config.ssoSubdomain.trim().length > 0) {
        const subdomain = this.config.ssoSubdomain.trim();
        if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(subdomain) || subdomain.length > 63) {
          console.warn("Invalid SSO subdomain format in configuration");
          this.config.ssoSubdomain = "";
        }
      }
    } catch (error) {
      console.error("Failed to load configuration:", error);
      this.config = {
        ssoSubdomain: "", defaultAction: "clean", showNotifications: true, autoClosePopup: true,
        roleSelectionStrategy: "current", defaultRoleName: "", accountRoleMap: {},
      };
      throw new Error("Configuration loading failed: " + (error instanceof Error ? error.message : "Storage access error"));
    }
  }

  private async loadSessionInfo(tabId: number): Promise<void> {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: "getSessionInfo" });

      if (!response) {
        throw new Error("No response received from content script");
      }

      if (!response.success) {
        throw new Error(response.error || "Session extraction failed");
      }

      if (!response.data) {
        throw new Error("No session data received");
      }

      const sessionData = response.data;
      if (!sessionData.accountId || !sessionData.roleName || !sessionData.currentUrl) {
        throw new Error("Incomplete session information received");
      }

      if (!/^\d{6,12}$/.test(sessionData.accountId)) {
        throw new Error("Invalid account ID format in session data");
      }

      if (typeof sessionData.roleName !== "string" || sessionData.roleName.trim().length === 0) {
        throw new Error("Invalid role name in session data");
      }

      if (!sessionData.currentUrl.includes("console.aws.amazon.com")) {
        throw new Error("Session data contains invalid AWS Console URL");
      }

      this.currentSessionInfo = {
        accountId: sessionData.accountId,
        roleName: sessionData.roleName,
        currentUrl: sessionData.currentUrl,
        isMultiAccount: Boolean(sessionData.isMultiAccount),
        region: sessionData.region || "us-east-1",
      };
    } catch (error) {
      console.error("Failed to get session info:", error);

      let errorMessage = "Unable to extract AWS session information from this page.";

      if (error instanceof Error) {
        if (error.message.includes("Could not establish connection")) {
          errorMessage = "Content script not loaded. Please refresh the page and try again.";
        } else if (error.message.includes("Account ID")) {
          errorMessage = "Unable to find AWS account ID on this page. Please ensure you are logged into the AWS Console.";
        } else if (error.message.includes("Role name")) {
          errorMessage = "Unable to extract role information. This extension works best with AWS SSO authentication.";
        } else {
          errorMessage = `Session extraction failed: ${error.message}`;
        }
      }

      throw new Error(errorMessage);
    }
  }

  private setupEventListeners(): void {
    const cleanUrlBtn = document.getElementById("clean-url-btn");
    const generateDeeplinkBtn = document.getElementById(
      "generate-deeplink-btn"
    );
    const copyBtn = document.getElementById("copy-btn");

    cleanUrlBtn?.addEventListener("click", () => this.handleCleanUrl());
    generateDeeplinkBtn?.addEventListener("click", () =>
      this.handleGenerateDeepLink()
    );
    copyBtn?.addEventListener("click", () => this.handleCopyToClipboard());
  }

  private displayCurrentUrl(): void {
    const urlDisplay = document.getElementById("current-url");
    if (urlDisplay && this.currentSessionInfo) {
      urlDisplay.textContent = this.currentSessionInfo.currentUrl;
      urlDisplay.title = this.currentSessionInfo.currentUrl;
    }
  }

  private async handleCleanUrl(): Promise<void> {
    if (!this.currentSessionInfo?.currentUrl) {
      this.showError(
        "Session information not available. Please refresh the page and try again."
      );
      return;
    }

    try {
      const result = cleanUrl(this.currentSessionInfo.currentUrl);

      if (!result.success) {
        this.showError(`URL cleaning failed: ${result.error}`);
        return;
      }

      await this.displayResult(result);
    } catch (error) {
      console.error("Failed to clean URL:", error);
      this.showError("Failed to clean URL. Please try again.");
    }
  }

  private async handleGenerateDeepLink(): Promise<void> {
    if (!this.currentSessionInfo || !this.config) {
      this.showError(
        "Session information or configuration not available. Please refresh the page and try again."
      );
      return;
    }

    if (!this.config.ssoSubdomain?.trim()) {
      this.showError(
        "AWS SSO subdomain not configured. Please go to Settings and enter your organization's SSO subdomain."
      );
      return;
    }

    try {
      // Resolve role name based on strategy
      const roleName = this.resolveRoleName(
        this.currentSessionInfo,
        this.config
      );
      const sessionWithResolvedRole = { ...this.currentSessionInfo, roleName };

      const result = generateDeepLink(sessionWithResolvedRole, this.config);

      if (!result.success) {
        this.showError(`Deep link generation failed: ${result.error}`);
        return;
      }

      await this.displayResult(result);
    } catch (error) {
      console.error("Failed to generate deep link:", error);
      this.showError("Failed to generate deep link. Please try again.");
    }
  }

  private resolveRoleName(
    sessionInfo: SessionInfo,
    config: ExtensionConfig
  ): string {
    const strategy = config.roleSelectionStrategy || "current";

    switch (strategy) {
      case "current":
        return sessionInfo.roleName;

      case "default":
        return config.defaultRoleName || sessionInfo.roleName;

      case "account-map":
        // Check if account has a specific role mapping
        const mappedRole = config.accountRoleMap[sessionInfo.accountId];
        if (mappedRole) {
          return mappedRole;
        }
        // Fall back to default role, then current role
        return config.defaultRoleName || sessionInfo.roleName;

      default:
        return sessionInfo.roleName;
    }
  }

  private async displayResult(result: UrlResult): Promise<void> {
    const resultSection = document.getElementById("result-section");
    const resultTextarea = document.getElementById(
      "result-url"
    ) as HTMLTextAreaElement;

    if (!resultSection || !resultTextarea) return;

    if (result.success && result.url) {
      resultTextarea.value = result.url;
      resultSection.style.display = "block";

      // Automatically copy to clipboard
      const copySuccess = await this.copyToClipboard(result.url);

      if (copySuccess) {
        this.showSuccess(
          `${
            result.type === "clean" ? "Clean URL" : "Deep link"
          } generated and copied to clipboard!`
        );

        // Auto-close popup if configured
        if (this.config?.autoClosePopup) {
          setTimeout(() => window.close(), 1000);
        }
      } else {
        this.showSuccess(
          `${
            result.type === "clean" ? "Clean URL" : "Deep link"
          } generated successfully! Click Copy to copy to clipboard.`
        );
      }
    } else {
      resultSection.style.display = "none";
      this.showError(result.error || "Unknown error occurred");
    }
  }

  private async handleCopyToClipboard(): Promise<void> {
    const resultTextarea = document.getElementById(
      "result-url"
    ) as HTMLTextAreaElement;

    if (!resultTextarea || !resultTextarea.value) {
      this.showError("No URL to copy");
      return;
    }

    const success = await this.copyToClipboard(resultTextarea.value);

    if (success) {
      this.showSuccess("URL copied to clipboard!");

      if (this.config?.autoClosePopup) {
        setTimeout(() => window.close(), 1000);
      }
    } else {
      this.showError("Failed to copy URL to clipboard");
    }
  }

  async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      // Simple fallback - just show the text for manual copying
      console.warn("Clipboard API not available");
      return false;
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      return false;
    }
  }

  showError(message: string): void {
    this.showMessage(message, "error");
  }

  showSuccess(message: string): void {
    this.showMessage(message, "success");
  }

  private showMessage(message: string, type: "error" | "success"): void {
    const messageArea = document.getElementById("message-area");
    if (!messageArea) return;

    messageArea.className = `message-area ${type}`;
    messageArea.textContent = message;
    messageArea.style.display = "block";

    // Auto-hide success messages
    if (type === "success") {
      setTimeout(() => {
        messageArea.style.display = "none";
      }, 3000);
    }
  }

  private isAwsConsoleUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes("console.aws.amazon.com");
    } catch {
      return false;
    }
  }

  private disableButtons(): void {
    const buttons = document.querySelectorAll(".action-button");
    buttons.forEach((button) => {
      (button as HTMLButtonElement).disabled = true;
    });
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const popupManager = new PopupManager();
  popupManager.initializePopup();
});
