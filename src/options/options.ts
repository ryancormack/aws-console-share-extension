import {
  ExtensionConfig,
  ValidationResult,
  RoleSelectionStrategy,
  AccountRoleMap,
} from "../types/index.js";

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: ExtensionConfig = {
  ssoSubdomain: "",
  defaultAction: "clean",
  showNotifications: true,
  autoClosePopup: false,
  roleSelectionStrategy: "current",
  defaultRoleName: "",
  accountRoleMap: {},
};

/**
 * DOM element references
 */
interface OptionsElements {
  form: HTMLFormElement;
  ssoSubdomain: HTMLInputElement;
  defaultAction: HTMLSelectElement;
  showNotifications: HTMLInputElement;
  autoClosePopup: HTMLInputElement;
  roleSelectionStrategy: HTMLSelectElement;
  defaultRoleName: HTMLInputElement;
  accountRoleMap: HTMLTextAreaElement;
  saveButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  statusMessage: HTMLElement;
  ssoSubdomainError: HTMLElement;
  defaultRoleError: HTMLElement;
  accountRoleMapError: HTMLElement;
  defaultRoleGroup: HTMLElement;
  accountRoleMapGroup: HTMLElement;
}

let elements: OptionsElements;

/**
 * Handle role selection strategy change
 */
function handleRoleStrategyChange(): void {
  updateRoleStrategyVisibility();
}

/**
 * Update visibility of role strategy dependent fields
 */
function updateRoleStrategyVisibility(): void {
  const strategy = elements.roleSelectionStrategy
    .value as RoleSelectionStrategy;

  // Show/hide default role field
  if (strategy === "default" || strategy === "account-map") {
    elements.defaultRoleGroup.style.display = "block";
  } else {
    elements.defaultRoleGroup.style.display = "none";
  }

  // Show/hide account role mapping field
  if (strategy === "account-map") {
    elements.accountRoleMapGroup.style.display = "block";
  } else {
    elements.accountRoleMapGroup.style.display = "none";
  }
}

/**
 * Initialize the options page
 */
async function initializeOptions(): Promise<void> {
  try {
    // Get DOM elements
    elements = {
      form: document.getElementById("optionsForm") as HTMLFormElement,
      ssoSubdomain: document.getElementById("ssoSubdomain") as HTMLInputElement,
      defaultAction: document.getElementById(
        "defaultAction"
      ) as HTMLSelectElement,
      showNotifications: document.getElementById(
        "showNotifications"
      ) as HTMLInputElement,
      autoClosePopup: document.getElementById(
        "autoClosePopup"
      ) as HTMLInputElement,
      roleSelectionStrategy: document.getElementById(
        "roleSelectionStrategy"
      ) as HTMLSelectElement,
      defaultRoleName: document.getElementById(
        "defaultRoleName"
      ) as HTMLInputElement,
      accountRoleMap: document.getElementById(
        "accountRoleMap"
      ) as HTMLTextAreaElement,
      saveButton: document.getElementById("saveButton") as HTMLButtonElement,
      resetButton: document.getElementById("resetButton") as HTMLButtonElement,
      statusMessage: document.getElementById("statusMessage") as HTMLElement,
      ssoSubdomainError: document.getElementById(
        "ssoSubdomainError"
      ) as HTMLElement,
      defaultRoleError: document.getElementById(
        "defaultRoleError"
      ) as HTMLElement,
      accountRoleMapError: document.getElementById(
        "accountRoleMapError"
      ) as HTMLElement,
      defaultRoleGroup: document.getElementById(
        "defaultRoleGroup"
      ) as HTMLElement,
      accountRoleMapGroup: document.getElementById(
        "accountRoleMapGroup"
      ) as HTMLElement,
    };

    // Set up event listeners
    elements.form.addEventListener("submit", handleFormSubmit);
    elements.resetButton.addEventListener("click", handleReset);
    elements.roleSelectionStrategy.addEventListener(
      "change",
      handleRoleStrategyChange
    );
    elements.defaultRoleName.addEventListener("input", () =>
      clearFieldError("defaultRoleName")
    );
    elements.accountRoleMap.addEventListener("input", () =>
      clearFieldError("accountRoleMap")
    );
    elements.ssoSubdomain.addEventListener("input", handleSubdomainInput);
    elements.ssoSubdomain.addEventListener("blur", validateSubdomainField);

    // Load and display current settings
    await loadSettings();

    console.log("Options page initialized successfully");
  } catch (error) {
    console.error("Failed to initialize options page:", error);
    showStatus("Failed to initialize options page", "error");
  }
}

/**
 * Load settings from Chrome storage and populate form
 */
async function loadSettings(): Promise<ExtensionConfig> {
  try {
    const result = await chrome.storage.sync.get(DEFAULT_CONFIG);
    const config = result as ExtensionConfig;

    // Populate form fields
    elements.ssoSubdomain.value = config.ssoSubdomain || "";
    elements.defaultAction.value = config.defaultAction || "clean";
    elements.showNotifications.checked = config.showNotifications !== false;
    elements.autoClosePopup.checked = config.autoClosePopup === true;
    elements.roleSelectionStrategy.value =
      config.roleSelectionStrategy || "current";
    elements.defaultRoleName.value = config.defaultRoleName || "";

    // Convert account role map to textarea format
    const accountRoleMapText = Object.entries(config.accountRoleMap || {})
      .map(([accountId, roleName]) => `${accountId}:${roleName}`)
      .join("\n");
    elements.accountRoleMap.value = accountRoleMapText;

    // Update visibility of conditional fields
    updateRoleStrategyVisibility();

    return config;
  } catch (error) {
    console.error("Failed to load settings:", error);
    showStatus("Failed to load settings", "error");
    return DEFAULT_CONFIG;
  }
}

/**
 * Save settings to Chrome storage
 */
async function saveSettings(config: ExtensionConfig): Promise<void> {
  try {
    await chrome.storage.sync.set(config);
    showStatus("Settings saved successfully", "success");
    console.log("Settings saved:", config);
  } catch (error) {
    console.error("Failed to save settings:", error);
    showStatus("Failed to save settings", "error");
    throw error;
  }
}

/**
 * Validate AWS SSO subdomain format
 */
function validateSubdomain(subdomain: string): ValidationResult {
  const errors: string[] = [];
  const trimmed = subdomain.trim();

  if (!trimmed) {
    errors.push("AWS SSO subdomain is required");
  } else if (trimmed.length < 2 || trimmed.length > 63) {
    errors.push("Subdomain must be 2-63 characters long");
  } else if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(trimmed)) {
    errors.push("Invalid subdomain format");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate role name format
 */
function validateRoleName(roleName: string): ValidationResult {
  const errors: string[] = [];
  const trimmed = roleName.trim();

  if (!trimmed) {
    errors.push("Role name is required");
  } else if (trimmed.length > 64) {
    errors.push("Role name too long (max 64 characters)");
  } else if (!/^[a-zA-Z0-9+=,.@_-]+$/.test(trimmed)) {
    errors.push("Invalid role name characters");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse and validate account role mapping
 */
function parseAccountRoleMap(mapText: string): {
  valid: boolean;
  errors: string[];
  map: AccountRoleMap;
} {
  const errors: string[] = [];
  const map: AccountRoleMap = {};

  if (!mapText?.trim()) {
    return { valid: true, errors: [], map: {} };
  }

  const lines = mapText.trim().split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(":");
    if (parts.length !== 2) {
      errors.push(`Line ${i + 1}: Use format AccountID:RoleName`);
      continue;
    }

    const accountId = parts[0].trim();
    const roleName = parts[1].trim();

    if (!/^\d{12}$/.test(accountId)) {
      errors.push(`Line ${i + 1}: Invalid account ID (must be 12 digits)`);
    }

    if (!roleName) {
      errors.push(`Line ${i + 1}: Role name required`);
    }

    if (errors.length === 0) {
      map[accountId] = roleName;
    }
  }

  return { valid: errors.length === 0, errors, map };
}

/**
 * Reset configuration to defaults
 */
async function resetToDefaults(): Promise<void> {
  try {
    await chrome.storage.sync.clear();
    await loadSettings();
    showStatus("Settings reset to defaults", "success");
    clearFieldErrors();
  } catch (error) {
    console.error("Failed to reset settings:", error);
    showStatus("Failed to reset settings", "error");
  }
}

/**
 * Handle form submission
 */
async function handleFormSubmit(event: Event): Promise<void> {
  event.preventDefault();

  try {
    clearFieldErrors();

    const formData = new FormData(elements.form);
    const ssoSubdomain = (
      (formData.get("ssoSubdomain") as string) || ""
    ).trim();
    const defaultAction = formData.get("defaultAction") as string;
    const showNotifications = formData.has("showNotifications");
    const autoClosePopup = formData.has("autoClosePopup");
    const roleSelectionStrategy = formData.get(
      "roleSelectionStrategy"
    ) as RoleSelectionStrategy;
    const defaultRoleName = (
      (formData.get("defaultRoleName") as string) || ""
    ).trim();
    const accountRoleMapText = (
      (formData.get("accountRoleMap") as string) || ""
    ).trim();

    // Validate subdomain
    const subdomainValidation = validateSubdomain(ssoSubdomain);
    if (!subdomainValidation.valid) {
      showFieldError("ssoSubdomain", subdomainValidation.errors[0]);
      return;
    }

    // Validate default role name if needed
    if (
      (roleSelectionStrategy === "default" ||
        roleSelectionStrategy === "account-map") &&
      defaultRoleName
    ) {
      const roleValidation = validateRoleName(defaultRoleName);
      if (!roleValidation.valid) {
        showFieldError("defaultRoleName", roleValidation.errors[0]);
        return;
      }
    }

    // Validate account role mapping if needed
    let accountRoleMap: AccountRoleMap = {};
    if (roleSelectionStrategy === "account-map") {
      const mapValidation = parseAccountRoleMap(accountRoleMapText);
      if (!mapValidation.valid) {
        showFieldError("accountRoleMap", mapValidation.errors[0]);
        return;
      }
      accountRoleMap = mapValidation.map;
    }

    const config: ExtensionConfig = {
      ssoSubdomain,
      defaultAction: (defaultAction as "clean" | "deeplink") || "clean",
      showNotifications,
      autoClosePopup,
      roleSelectionStrategy,
      defaultRoleName,
      accountRoleMap,
    };

    await saveSettings(config);
  } catch (error) {
    console.error("Failed to save settings:", error);
    showStatus("Failed to save settings", "error");
  }
}

/**
 * Handle reset button click
 */
async function handleReset(event: Event): Promise<void> {
  event.preventDefault();

  if (
    confirm(
      "Are you sure you want to reset all settings to their default values?"
    )
  ) {
    await resetToDefaults();
  }
}

/**
 * Handle subdomain input changes
 */
function handleSubdomainInput(): void {
  clearFieldError("ssoSubdomain");
}

/**
 * Validate subdomain field on blur
 */
function validateSubdomainField(): void {
  const subdomain = elements.ssoSubdomain.value.trim();
  if (subdomain) {
    const validation = validateSubdomain(subdomain);
    if (!validation.valid) {
      showFieldError("ssoSubdomain", validation.errors[0]);
    }
  }
}

/**
 * Show status message
 */
function showStatus(message: string, type: "success" | "error"): void {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${type}`;
  elements.statusMessage.style.display = "block";

  if (type === "success") {
    setTimeout(() => {
      elements.statusMessage.style.display = "none";
    }, 3000);
  }
}

/**
 * Show field error
 */
function showFieldError(fieldName: string, message: string): void {
  const errorElement = document.getElementById(`${fieldName}Error`);
  const inputElement = document.getElementById(fieldName);

  if (errorElement && inputElement) {
    errorElement.textContent = message;
    errorElement.style.display = "block";
    inputElement.classList.add("error");
    inputElement.setAttribute("aria-invalid", "true");
  }
}

/**
 * Clear field error
 */
function clearFieldError(fieldName: string): void {
  const errorElement = document.getElementById(`${fieldName}Error`);
  const inputElement = document.getElementById(fieldName);

  if (errorElement && inputElement) {
    errorElement.textContent = "";
    errorElement.style.display = "none";
    inputElement.classList.remove("error");
    inputElement.removeAttribute("aria-invalid");
  }
}

/**
 * Clear all field errors
 */
function clearFieldErrors(): void {
  clearFieldError("ssoSubdomain");
  clearFieldError("defaultRoleName");
  clearFieldError("accountRoleMap");
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeOptions);
} else {
  initializeOptions();
}
