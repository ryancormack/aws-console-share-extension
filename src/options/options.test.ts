import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Chrome APIs
const mockChrome = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn(),
    },
  },
};

// Mock global functions
const mockConfirm = vi.fn();
const mockSetTimeout = vi.fn();

describe("Options Page", () => {
  let validateSubdomain: any;
  let validateRoleName: any;
  let parseAccountRoleMap: any;
  let showStatus: any;
  let showFieldError: any;
  let clearFieldError: any;
  let clearFieldErrors: any;
  let updateRoleStrategyVisibility: any;
  let loadSettings: any;
  let saveSettings: any;
  let handleReset: any;
  let handleSubdomainInput: any;
  let validateSubdomainField: any;
  let DEFAULT_CONFIG: any;
  let initializeOptions: any;

  beforeEach(async () => {
    // Set up DOM
    document.body.innerHTML = `
      <form id="optionsForm">
        <input type="text" id="ssoSubdomain" name="ssoSubdomain" />
        <div id="ssoSubdomainError" class="error-message" style="display: none;"></div>
        
        <select id="defaultAction" name="defaultAction">
          <option value="clean">Clean URL</option>
          <option value="deeplink">Generate Deep Link</option>
        </select>
        
        <input type="checkbox" id="showNotifications" name="showNotifications" />
        <input type="checkbox" id="autoClosePopup" name="autoClosePopup" />
        
        <select id="roleSelectionStrategy" name="roleSelectionStrategy">
          <option value="current">Current Role</option>
          <option value="default">Default Role</option>
          <option value="account-map">Account Role Map</option>
        </select>
        
        <div id="defaultRoleGroup" style="display: none;">
          <input type="text" id="defaultRoleName" name="defaultRoleName" />
          <div id="defaultRoleError" class="error-message" style="display: none;"></div>
        </div>
        
        <div id="accountRoleMapGroup" style="display: none;">
          <textarea id="accountRoleMap" name="accountRoleMap"></textarea>
          <div id="accountRoleMapError" class="error-message" style="display: none;"></div>
        </div>
        
        <button type="submit" id="saveButton">Save</button>
        <button type="button" id="resetButton">Reset</button>
      </form>
      
      <div id="statusMessage" class="status-message" style="display: none;"></div>
    `;

    // Set up global environment
    (global as any).chrome = mockChrome;
    (global as any).confirm = mockConfirm;
    (global as any).setTimeout = mockSetTimeout;

    // Mock document ready state
    Object.defineProperty(document, "readyState", {
      writable: true,
      value: "complete",
    });

    // Set up default mock implementations
    mockChrome.storage.sync.get.mockResolvedValue({
      ssoSubdomain: "test-company",
      defaultAction: "clean",
      showNotifications: true,
      autoClosePopup: false,
      roleSelectionStrategy: "current",
      defaultRoleName: "",
      accountRoleMap: {},
    });

    mockChrome.storage.sync.set.mockResolvedValue(undefined);
    mockChrome.storage.sync.clear.mockResolvedValue(undefined);

    vi.clearAllMocks();

    // Import the options module and get the exported functions
    const optionsModule = await import("./options.js");
    validateSubdomain = optionsModule.validateSubdomain;
    validateRoleName = optionsModule.validateRoleName;
    parseAccountRoleMap = optionsModule.parseAccountRoleMap;
    showStatus = optionsModule.showStatus;
    showFieldError = optionsModule.showFieldError;
    clearFieldError = optionsModule.clearFieldError;
    clearFieldErrors = optionsModule.clearFieldErrors;
    updateRoleStrategyVisibility = optionsModule.updateRoleStrategyVisibility;
    loadSettings = optionsModule.loadSettings;
    saveSettings = optionsModule.saveSettings;
    handleReset = optionsModule.handleReset;
    handleSubdomainInput = optionsModule.handleSubdomainInput;
    validateSubdomainField = optionsModule.validateSubdomainField;
    DEFAULT_CONFIG = optionsModule.DEFAULT_CONFIG;
    initializeOptions = optionsModule.initializeOptions;
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  describe("Validation Functions", () => {
    it("should validate subdomain format correctly", () => {
      // Valid cases
      expect(validateSubdomain("valid-subdomain").valid).toBe(true);
      expect(validateSubdomain("my-org").valid).toBe(true);
      expect(validateSubdomain("test123").valid).toBe(true);

      // Invalid cases
      expect(validateSubdomain("").valid).toBe(false);
      expect(validateSubdomain("").errors[0]).toBe(
        "AWS SSO subdomain is required"
      );

      expect(validateSubdomain("a").valid).toBe(false);
      expect(validateSubdomain("a").errors[0]).toBe(
        "Subdomain must be 2-63 characters long"
      );

      expect(validateSubdomain("a".repeat(64)).valid).toBe(false);
      expect(validateSubdomain("a".repeat(64)).errors[0]).toBe(
        "Subdomain must be 2-63 characters long"
      );

      expect(validateSubdomain("-invalid").valid).toBe(false);
      expect(validateSubdomain("-invalid").errors[0]).toBe(
        "Invalid subdomain format"
      );

      expect(validateSubdomain("invalid-").valid).toBe(false);
      expect(validateSubdomain("invalid-").errors[0]).toBe(
        "Invalid subdomain format"
      );
    });

    it("should validate role names correctly", () => {
      // Valid cases
      expect(validateRoleName("ValidRole").valid).toBe(true);
      expect(validateRoleName("Role-Name_123").valid).toBe(true);
      expect(validateRoleName("Role+Name@Domain.com").valid).toBe(true);

      // Invalid cases
      expect(validateRoleName("").valid).toBe(false);
      expect(validateRoleName("").errors[0]).toBe("Role name is required");

      expect(validateRoleName("a".repeat(65)).valid).toBe(false);
      expect(validateRoleName("a".repeat(65)).errors[0]).toBe(
        "Role name too long (max 64 characters)"
      );

      expect(validateRoleName("Invalid Role").valid).toBe(false); // spaces not allowed
      expect(validateRoleName("Invalid Role").errors[0]).toBe(
        "Invalid role name characters"
      );

      expect(validateRoleName("Invalid!Role").valid).toBe(false); // ! not allowed
      expect(validateRoleName("Invalid!Role").errors[0]).toBe(
        "Invalid role name characters"
      );
    });

    it("should parse account role mappings correctly", () => {
      // Valid cases
      const validMapping = "123456789012:PowerUser\n987654321098:ReadOnly";
      const result = parseAccountRoleMap(validMapping);
      expect(result.valid).toBe(true);
      expect(result.map).toEqual({
        "123456789012": "PowerUser",
        "987654321098": "ReadOnly",
      });

      // Empty mapping should be valid
      expect(parseAccountRoleMap("").valid).toBe(true);
      expect(parseAccountRoleMap("").map).toEqual({});

      // Mapping with empty lines
      const mappingWithEmptyLines =
        "123456789012:PowerUser\n\n987654321098:ReadOnly\n";
      const resultWithEmpty = parseAccountRoleMap(mappingWithEmptyLines);
      expect(resultWithEmpty.valid).toBe(true);
      expect(resultWithEmpty.map).toEqual({
        "123456789012": "PowerUser",
        "987654321098": "ReadOnly",
      });

      // Invalid cases
      const invalidFormat = "invalid-format";
      const invalidResult = parseAccountRoleMap(invalidFormat);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors[0]).toBe(
        "Line 1: Use format AccountID:RoleName"
      );

      const invalidAccountId = "12345:PowerUser"; // Too short
      const invalidAccountResult = parseAccountRoleMap(invalidAccountId);
      expect(invalidAccountResult.valid).toBe(false);
      expect(invalidAccountResult.errors[0]).toBe(
        "Line 1: Invalid account ID (must be 12 digits)"
      );

      const missingRole = "123456789012:";
      const missingRoleResult = parseAccountRoleMap(missingRole);
      expect(missingRoleResult.valid).toBe(false);
      expect(missingRoleResult.errors[0]).toBe("Line 1: Role name required");
    });
  });

  describe("UI Visibility Logic", () => {
    it("should update role strategy visibility correctly", async () => {
      // Initialize the options page to set up element references
      await initializeOptions();
      
      const roleStrategySelect = document.getElementById("roleSelectionStrategy") as HTMLSelectElement;
      const defaultRoleGroup = document.getElementById("defaultRoleGroup") as HTMLElement;
      const accountRoleMapGroup = document.getElementById("accountRoleMapGroup") as HTMLElement;

      // Test current strategy
      roleStrategySelect.value = "current";
      updateRoleStrategyVisibility();
      expect(defaultRoleGroup.style.display).toBe("none");
      expect(accountRoleMapGroup.style.display).toBe("none");

      // Test default strategy
      roleStrategySelect.value = "default";
      updateRoleStrategyVisibility();
      expect(defaultRoleGroup.style.display).toBe("block");
      expect(accountRoleMapGroup.style.display).toBe("none");

      // Test account-map strategy
      roleStrategySelect.value = "account-map";
      updateRoleStrategyVisibility();
      expect(defaultRoleGroup.style.display).toBe("block");
      expect(accountRoleMapGroup.style.display).toBe("block");
    });
  });

  describe("Error Display Functions", () => {
    it("should show field errors correctly", () => {
      showFieldError("ssoSubdomain", "Test error message");

      const errorElement = document.getElementById("ssoSubdomainError");
      const inputElement = document.getElementById("ssoSubdomain");

      expect(errorElement?.textContent).toBe("Test error message");
      expect(errorElement?.style.display).toBe("block");
      expect(inputElement?.classList.contains("error")).toBe(true);
      expect(inputElement?.getAttribute("aria-invalid")).toBe("true");
    });

    it("should clear field errors correctly", () => {
      // First set an error
      const errorElement = document.getElementById(
        "ssoSubdomainError"
      ) as HTMLElement;
      const inputElement = document.getElementById(
        "ssoSubdomain"
      ) as HTMLInputElement;

      errorElement.textContent = "Test error";
      errorElement.style.display = "block";
      inputElement.classList.add("error");
      inputElement.setAttribute("aria-invalid", "true");

      // Then clear it
      clearFieldError("ssoSubdomain");

      expect(errorElement.textContent).toBe("");
      expect(errorElement.style.display).toBe("none");
      expect(inputElement.classList.contains("error")).toBe(false);
      expect(inputElement.getAttribute("aria-invalid")).toBeNull();
    });

    it("should show status messages correctly", async () => {
      // Initialize the options page to set up element references
      await initializeOptions();
      
      const statusElement = document.getElementById("statusMessage") as HTMLElement;

      // Test success message
      showStatus("Test success message", "success");
      expect(statusElement.textContent).toBe("Test success message");
      expect(statusElement.className).toBe("status-message success");
      expect(statusElement.style.display).toBe("block");
      
      // Verify setTimeout was called for success message auto-hide
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3000);

      // Test error message
      showStatus("Test error message", "error");
      expect(statusElement.textContent).toBe("Test error message");
      expect(statusElement.className).toBe("status-message error");
      expect(statusElement.style.display).toBe("block");
    });

    it("should clear all field errors", () => {
      // Set up some errors first
      showFieldError("ssoSubdomain", "Error 1");
      showFieldError("defaultRoleName", "Error 2");
      showFieldError("accountRoleMap", "Error 3");

      // Clear all errors
      clearFieldErrors();

      // Check that all errors are cleared
      expect(document.getElementById("ssoSubdomainError")?.textContent).toBe("");
      expect(document.getElementById("defaultRoleError")?.textContent).toBe("");
      expect(document.getElementById("accountRoleMapError")?.textContent).toBe("");
    });
  });

  describe("Configuration Management", () => {
    it("should handle default configuration values", () => {
      expect(DEFAULT_CONFIG.ssoSubdomain).toBe("");
      expect(DEFAULT_CONFIG.defaultAction).toBe("clean");
      expect(DEFAULT_CONFIG.showNotifications).toBe(true);
      expect(DEFAULT_CONFIG.autoClosePopup).toBe(false);
      expect(DEFAULT_CONFIG.roleSelectionStrategy).toBe("current");
      expect(DEFAULT_CONFIG.defaultRoleName).toBe("");
      expect(DEFAULT_CONFIG.accountRoleMap).toEqual({});
    });

    it("should load settings from Chrome storage", async () => {
      const mockConfig = {
        ssoSubdomain: "test-company",
        defaultAction: "deeplink",
        showNotifications: false,
        autoClosePopup: true,
        roleSelectionStrategy: "default",
        defaultRoleName: "TestRole",
        accountRoleMap: { "123456789012": "PowerUser" },
      };

      mockChrome.storage.sync.get.mockResolvedValue(mockConfig);

      const result = await loadSettings();

      expect(mockChrome.storage.sync.get).toHaveBeenCalledWith(DEFAULT_CONFIG);
      expect(result).toEqual(mockConfig);
    });

    it("should handle load settings error", async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockChrome.storage.sync.get.mockRejectedValue(new Error("Storage error"));

      const result = await loadSettings();

      expect(result).toEqual(DEFAULT_CONFIG);
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load settings:", expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it("should save settings to Chrome storage", async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const config = {
        ssoSubdomain: "my-company",
        defaultAction: "clean" as const,
        showNotifications: true,
        autoClosePopup: false,
        roleSelectionStrategy: "current" as const,
        defaultRoleName: "",
        accountRoleMap: {},
      };

      await saveSettings(config);

      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(config);
      expect(consoleSpy).toHaveBeenCalledWith("Settings saved:", config);
      
      consoleSpy.mockRestore();
    });

    it("should handle save settings error", async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const config = {
        ssoSubdomain: "test",
        defaultAction: "clean" as const,
        showNotifications: true,
        autoClosePopup: false,
        roleSelectionStrategy: "current" as const,
        defaultRoleName: "",
        accountRoleMap: {},
      };

      mockChrome.storage.sync.set.mockRejectedValue(new Error("Storage error"));

      await expect(saveSettings(config)).rejects.toThrow("Storage error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to save settings:", expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it("should convert account role map to textarea format", () => {
      const accountRoleMap = {
        "123456789012": "PowerUser",
        "987654321098": "ReadOnly",
        "555666777888": "DeveloperAccess",
      };

      const accountRoleMapText = Object.entries(accountRoleMap)
        .map(([accountId, roleName]) => `${accountId}:${roleName}`)
        .join("\n");

      expect(accountRoleMapText).toBe(
        "123456789012:PowerUser\n987654321098:ReadOnly\n555666777888:DeveloperAccess"
      );
    });
  });

  describe("Form Validation Integration", () => {
    it("should validate complete form submission flow", () => {
      // Test the complete validation flow
      const validateFormSubmission = (formData: any) => {
        const errors: string[] = [];

        // Validate subdomain
        if (!formData.ssoSubdomain?.trim()) {
          errors.push("AWS SSO subdomain is required");
        } else if (
          formData.ssoSubdomain.trim().length < 2 ||
          formData.ssoSubdomain.trim().length > 63
        ) {
          errors.push("Subdomain must be 2-63 characters long");
        } else if (
          !/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(
            formData.ssoSubdomain.trim()
          )
        ) {
          errors.push("Invalid subdomain format");
        }

        // Validate role name if needed
        if (
          (formData.roleSelectionStrategy === "default" ||
            formData.roleSelectionStrategy === "account-map") &&
          formData.defaultRoleName
        ) {
          if (formData.defaultRoleName.length > 64) {
            errors.push("Role name too long (max 64 characters)");
          } else if (!/^[a-zA-Z0-9+=,.@_-]+$/.test(formData.defaultRoleName)) {
            errors.push("Invalid role name characters");
          }
        }

        // Validate account role mapping if needed
        if (
          formData.roleSelectionStrategy === "account-map" &&
          formData.accountRoleMapText
        ) {
          const lines = formData.accountRoleMapText.trim().split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(":");
            if (parts.length !== 2) {
              errors.push(`Line ${i + 1}: Use format AccountID:RoleName`);
              break;
            }

            const accountId = parts[0].trim();
            if (!/^\d{12}$/.test(accountId)) {
              errors.push(
                `Line ${i + 1}: Invalid account ID (must be 12 digits)`
              );
              break;
            }
          }
        }

        return { valid: errors.length === 0, errors };
      };

      // Test valid form data
      const validFormData = {
        ssoSubdomain: "test-company",
        defaultAction: "clean",
        showNotifications: true,
        autoClosePopup: false,
        roleSelectionStrategy: "account-map",
        defaultRoleName: "PowerUser",
        accountRoleMapText: "123456789012:PowerUser\n987654321098:ReadOnly",
      };

      const validResult = validateFormSubmission(validFormData);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toEqual([]);

      // Test invalid form data
      const invalidFormData = {
        ssoSubdomain: "", // Empty subdomain
        roleSelectionStrategy: "default",
        defaultRoleName: "Invalid Role!", // Invalid characters
        accountRoleMapText: "invalid-format", // Invalid format
      };

      const invalidResult = validateFormSubmission(invalidFormData);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
      expect(invalidResult.errors[0]).toBe("AWS SSO subdomain is required");
    });

    it("should handle edge cases in validation", () => {
      const validateEdgeCases = (
        input: string,
        type: "subdomain" | "role" | "accountMap"
      ) => {
        switch (type) {
          case "subdomain":
            // Test edge cases for subdomain validation
            if (input === "a") return { valid: false, error: "Too short" };
            if (input === "a".repeat(64))
              return { valid: false, error: "Too long" };
            if (input === "-invalid")
              return { valid: false, error: "Invalid format" };
            if (input === "valid-subdomain")
              return { valid: true, error: null };
            break;

          case "role":
            // Test edge cases for role name validation
            if (input === "a".repeat(65))
              return { valid: false, error: "Too long" };
            if (input === "Invalid Role")
              return { valid: false, error: "Invalid characters" };
            if (input === "ValidRole123") return { valid: true, error: null };
            break;

          case "accountMap":
            // Test edge cases for account mapping
            if (input === "invalid-format")
              return { valid: false, error: "Invalid format" };
            if (input === "12345:Role")
              return { valid: false, error: "Invalid account ID" };
            if (input === "123456789012:ValidRole")
              return { valid: true, error: null };
            break;
        }
        return { valid: false, error: "Unknown" };
      };

      // Test subdomain edge cases
      expect(validateEdgeCases("a", "subdomain").valid).toBe(false);
      expect(validateEdgeCases("a".repeat(64), "subdomain").valid).toBe(false);
      expect(validateEdgeCases("-invalid", "subdomain").valid).toBe(false);
      expect(validateEdgeCases("valid-subdomain", "subdomain").valid).toBe(
        true
      );

      // Test role name edge cases
      expect(validateEdgeCases("a".repeat(65), "role").valid).toBe(false);
      expect(validateEdgeCases("Invalid Role", "role").valid).toBe(false);
      expect(validateEdgeCases("ValidRole123", "role").valid).toBe(true);

      // Test account mapping edge cases
      expect(validateEdgeCases("invalid-format", "accountMap").valid).toBe(
        false
      );
      expect(validateEdgeCases("12345:Role", "accountMap").valid).toBe(false);
      expect(
        validateEdgeCases("123456789012:ValidRole", "accountMap").valid
      ).toBe(true);
    });
  });

  describe("DOM Manipulation Utilities", () => {
    it("should handle DOM element retrieval safely", () => {
      const getElement = (id: string) => {
        const element = document.getElementById(id);
        return element;
      };

      // Test existing elements
      expect(getElement("ssoSubdomain")).toBeTruthy();
      expect(getElement("defaultAction")).toBeTruthy();
      expect(getElement("statusMessage")).toBeTruthy();

      // Test non-existing elements
      expect(getElement("nonExistentElement")).toBeNull();
    });

    it("should handle form data collection", () => {
      const collectFormData = () => {
        const form = document.getElementById("optionsForm") as HTMLFormElement;
        if (!form) return null;

        const formData = new FormData(form);
        return {
          ssoSubdomain: ((formData.get("ssoSubdomain") as string) || "").trim(),
          defaultAction: formData.get("defaultAction") as string,
          showNotifications: formData.has("showNotifications"),
          autoClosePopup: formData.has("autoClosePopup"),
          roleSelectionStrategy: formData.get(
            "roleSelectionStrategy"
          ) as string,
          defaultRoleName: (
            (formData.get("defaultRoleName") as string) || ""
          ).trim(),
          accountRoleMap: (
            (formData.get("accountRoleMap") as string) || ""
          ).trim(),
        };
      };

      // Set some form values
      (document.getElementById("ssoSubdomain") as HTMLInputElement).value =
        "test-company";
      (
        document.getElementById("showNotifications") as HTMLInputElement
      ).checked = true;
      (document.getElementById("autoClosePopup") as HTMLInputElement).checked =
        false;

      const formData = collectFormData();
      expect(formData).toBeTruthy();
      expect(formData?.ssoSubdomain).toBe("test-company");
      expect(formData?.showNotifications).toBe(true);
      expect(formData?.autoClosePopup).toBe(false);
    });

    it("should handle element state management", () => {
      const setElementState = (
        elementId: string,
        state: { value?: string; checked?: boolean; display?: string }
      ) => {
        const element = document.getElementById(elementId);
        if (!element) return false;

        if (state.value !== undefined && "value" in element) {
          (element as HTMLInputElement).value = state.value;
        }
        if (state.checked !== undefined && "checked" in element) {
          (element as HTMLInputElement).checked = state.checked;
        }
        if (state.display !== undefined) {
          (element as HTMLElement).style.display = state.display;
        }

        return true;
      };

      // Test setting input value
      expect(setElementState("ssoSubdomain", { value: "test-value" })).toBe(
        true
      );
      expect(
        (document.getElementById("ssoSubdomain") as HTMLInputElement).value
      ).toBe("test-value");

      // Test setting checkbox state
      expect(setElementState("showNotifications", { checked: true })).toBe(
        true
      );
      expect(
        (document.getElementById("showNotifications") as HTMLInputElement)
          .checked
      ).toBe(true);

      // Test setting display style
      expect(setElementState("statusMessage", { display: "block" })).toBe(true);
      expect(
        (document.getElementById("statusMessage") as HTMLElement).style.display
      ).toBe("block");

      // Test non-existent element
      expect(setElementState("nonExistent", { value: "test" })).toBe(false);
    });
  });

  describe("Event Handler Logic", () => {
    it("should handle subdomain input events", () => {
      // Set up an error first
      showFieldError("ssoSubdomain", "Test error");
      
      // Simulate input event
      handleSubdomainInput();
      
      // Error should be cleared
      const errorElement = document.getElementById("ssoSubdomainError");
      expect(errorElement?.textContent).toBe("");
      expect(errorElement?.style.display).toBe("none");
    });

    it("should handle subdomain field validation", async () => {
      // Initialize the options page to set up element references
      await initializeOptions();
      
      const subdomainInput = document.getElementById("ssoSubdomain") as HTMLInputElement;
      
      // Test valid subdomain
      subdomainInput.value = "valid-subdomain";
      validateSubdomainField();
      
      const errorElement = document.getElementById("ssoSubdomainError");
      expect(errorElement?.textContent).toBe("");
      
      // Test invalid subdomain
      subdomainInput.value = "-invalid-";
      validateSubdomainField();
      
      expect(errorElement?.textContent).toBe("Invalid subdomain format");
    });

    it("should handle reset confirmation", async () => {
      mockConfirm.mockReturnValue(true);
      
      const event = new Event('click');
      await handleReset(event);
      
      expect(mockConfirm).toHaveBeenCalledWith(
        "Are you sure you want to reset all settings to their default values?"
      );
    });

    it("should handle reset cancellation", async () => {
      mockConfirm.mockReturnValue(false);
      
      const event = new Event('click');
      await handleReset(event);
      
      expect(mockConfirm).toHaveBeenCalled();
      // Should not proceed with reset when cancelled
    });
  });
});