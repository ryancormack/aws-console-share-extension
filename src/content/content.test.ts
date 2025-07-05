import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Chrome APIs globally
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
  },
};

// Set up global Chrome API mock
(global as any).chrome = mockChrome;

describe("Content Script", () => {
  beforeEach(async () => {
    // Set up DOM with AWS Console structure
    document.body.innerHTML = `
      <div id="root">
        <div data-testid="awsc-copy-accountid">123456789012</div>
        <div data-testid="account-detail-menu">
          <span>Account: 123456789012</span>
        </div>
        <div class="awsc-username-display">
          <span>AWSReservedSSO_PowerUser_abc123def456</span>
        </div>
        <div data-testid="awsc-username-display">
          <span>assumed-role/TestRole/session</span>
        </div>
      </div>
    `;

    // Mock window.location for AWS Console URL
    Object.defineProperty(window, "location", {
      value: {
        href: "https://eu-west-1.console.aws.amazon.com/cloudwatch/home",
        hostname: "eu-west-1.console.aws.amazon.com",
      },
      writable: true,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  describe("Content Script Functionality", () => {
    it("should set up Chrome message listener", async () => {
      // Import the content script to trigger initialization
      await import("./content.js");

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });
  });

  describe("Account ID Extraction Logic", () => {
    it("should extract account ID from copy button", async () => {
      const { extractAccountId } = await import("./content.js");

      const accountId = extractAccountId();
      expect(accountId).toBe("123456789012");
    });

    it("should extract account ID from navigation elements as fallback", async () => {
      // Remove the copy button to test fallback
      const copyButton = document.querySelector(
        '[data-testid="awsc-copy-accountid"]'
      );
      copyButton?.remove();

      const { extractAccountId } = await import("./content.js");

      const accountId = extractAccountId();
      expect(accountId).toBe("123456789012");
    });

    it("should extract account ID from multi-account URL", async () => {
      // Remove DOM elements to force URL extraction
      document.body.innerHTML = "<div>No account info</div>";

      // Mock multi-account URL
      Object.defineProperty(window, "location", {
        value: {
          href: "https://123456789012-abc123.eu-west-1.console.aws.amazon.com/cloudwatch",
          hostname: "123456789012-abc123.eu-west-1.console.aws.amazon.com",
        },
        writable: true,
      });

      const { extractAccountId } = await import("./content.js");

      const accountId = extractAccountId();
      expect(accountId).toBe("123456789012");
    });

    it("should handle account ID extraction errors", async () => {
      // Remove all account ID sources and reset URL
      document.body.innerHTML = "<div>No account info</div>";
      Object.defineProperty(window, "location", {
        value: {
          href: "https://eu-west-1.console.aws.amazon.com/cloudwatch/home",
          hostname: "eu-west-1.console.aws.amazon.com",
        },
        writable: true,
      });

      const { extractAccountId } = await import("./content.js");

      const accountId = extractAccountId();
      expect(accountId).toBeNull();
    });
  });

  describe("Role Name Extraction Logic", () => {
    it("should extract role name from SSO pattern", async () => {
      // Set up DOM with SSO pattern
      document.body.innerHTML = `
        <div class="awsc-username-display">
          <span>AWSReservedSSO_PowerUser_abc123def456</span>
        </div>
      `;

      const { extractRoleName } = await import("./content.js");

      const roleName = extractRoleName();
      expect(roleName).toBe("PowerUser");
    });

    it("should extract role name from assumed-role ARN", async () => {
      // Update DOM to have assumed-role pattern
      document.body.innerHTML = `
        <div data-testid="awsc-username-display">
          <span>assumed-role/TestRole/session</span>
        </div>
      `;

      const { extractRoleName } = await import("./content.js");

      const roleName = extractRoleName();
      expect(roleName).toBe("TestRole");
    });

    it("should handle role name extraction errors", async () => {
      // Remove all role sources
      document.body.innerHTML = "<div>No role info</div>";

      const { extractRoleName } = await import("./content.js");

      const roleName = extractRoleName();
      expect(roleName).toBeNull();
    });

    it("should extract role name from federated user pattern", async () => {
      document.body.innerHTML = `
        <div>
          <span data-testid="PowerUser/user@example.com">PowerUser/user@example.com</span>
        </div>
      `;

      const { extractRoleName } = await import("./content.js");

      const roleName = extractRoleName();
      expect(roleName).toBe("PowerUser");
    });
  });

  describe("URL Processing Functions", () => {
    it("should get current URL", async () => {
      const { getCurrentUrl } = await import("./content.js");

      expect(getCurrentUrl()).toBe(
        "https://eu-west-1.console.aws.amazon.com/cloudwatch/home"
      );
    });

    it("should detect multi-account URL format", async () => {
      const { isMultiAccountUrl } = await import("./content.js");

      expect(
        isMultiAccountUrl(
          "https://123456789012-abc123.eu-west-1.console.aws.amazon.com/cloudwatch"
        )
      ).toBe(true);
      expect(
        isMultiAccountUrl("https://eu-west-1.console.aws.amazon.com/cloudwatch")
      ).toBe(false);
      expect(isMultiAccountUrl("invalid-url")).toBe(false);
    });

    it("should extract region from URL", async () => {
      const { extractRegion } = await import("./content.js");

      expect(extractRegion()).toBe("eu-west-1");
    });

    it("should handle invalid URLs in region extraction", async () => {
      // Mock invalid location
      Object.defineProperty(window, "location", {
        value: {
          href: "invalid-url",
          hostname: "invalid",
        },
        writable: true,
      });

      const { extractRegion } = await import("./content.js");

      expect(extractRegion()).toBe("us-east-1");
    });

    it("should default to us-east-1 for non-regional URLs", async () => {
      Object.defineProperty(window, "location", {
        value: {
          href: "https://console.aws.amazon.com/cloudwatch",
          hostname: "console.aws.amazon.com",
        },
        writable: true,
      });

      const { extractRegion } = await import("./content.js");

      expect(extractRegion()).toBe("us-east-1");
    });
  });

  describe("Session Data Validation", () => {
    it("should validate complete session data", async () => {
      const { validateSessionData } = await import("./content.js");

      // Valid session data
      const validResult = validateSessionData(
        "123456789012",
        "PowerUser",
        "https://eu-west-1.console.aws.amazon.com/cloudwatch"
      );
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toEqual([]);

      // Invalid account ID
      const invalidAccountResult = validateSessionData(
        "invalid",
        "PowerUser",
        "https://eu-west-1.console.aws.amazon.com/cloudwatch"
      );
      expect(invalidAccountResult.valid).toBe(false);
      expect(invalidAccountResult.errors).toContain(
        "Could not extract valid account ID"
      );

      // Invalid role name
      const invalidRoleResult = validateSessionData(
        "123456789012",
        "",
        "https://eu-west-1.console.aws.amazon.com/cloudwatch"
      );
      expect(invalidRoleResult.valid).toBe(false);
      expect(invalidRoleResult.errors).toContain(
        "Could not extract valid role name"
      );

      // Invalid URL
      const invalidUrlResult = validateSessionData(
        "123456789012",
        "PowerUser",
        "https://example.com"
      );
      expect(invalidUrlResult.valid).toBe(false);
      expect(invalidUrlResult.errors).toContain("Not on AWS Console page");
    });

    it("should handle null values in validation", async () => {
      const { validateSessionData } = await import("./content.js");

      const result = validateSessionData(null, null, "https://example.com");
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe("Session Info Integration", () => {
    it("should get complete session info", async () => {
      const { getSessionInfo } = await import("./content.js");

      const sessionInfo = await getSessionInfo();
      expect(sessionInfo.accountId).toBe("123456789012");
      expect(sessionInfo.roleName).toBe("PowerUser");
      expect(sessionInfo.currentUrl).toBe(
        "https://eu-west-1.console.aws.amazon.com/cloudwatch/home"
      );
      expect(sessionInfo.region).toBe("eu-west-1");
      expect(sessionInfo.isMultiAccount).toBe(false);
    });

    it("should handle session extraction on non-AWS Console pages", async () => {
      Object.defineProperty(window, "location", {
        value: {
          href: "https://example.com",
          hostname: "example.com",
        },
        writable: true,
      });

      const { getSessionInfo } = await import("./content.js");

      await expect(getSessionInfo()).rejects.toThrow(
        "This extension only works on AWS Console pages"
      );
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle missing account ID gracefully", async () => {
      // Remove account ID elements and reset URL to non-multi-account
      document.body.innerHTML = "<div>No account info</div>";
      Object.defineProperty(window, "location", {
        value: {
          href: "https://eu-west-1.console.aws.amazon.com/cloudwatch/home",
          hostname: "eu-west-1.console.aws.amazon.com",
        },
        writable: true,
      });

      const { getSessionInfo } = await import("./content.js");

      await expect(getSessionInfo()).rejects.toThrow(
        "Could not extract valid account ID"
      );
    });

    it("should handle missing role name gracefully", async () => {
      // Keep account ID but remove role elements
      document.body.innerHTML = `
        <div data-testid="awsc-copy-accountid">123456789012</div>
        <div>No role info</div>
      `;

      const { getSessionInfo } = await import("./content.js");

      await expect(getSessionInfo()).rejects.toThrow(
        "Could not extract valid role name"
      );
    });

    it("should handle DOM query errors gracefully", async () => {
      const { extractAccountId } = await import("./content.js");

      // Should not throw even with missing elements
      const result = extractAccountId();
      expect(result).toBe("123456789012"); // Should find the account ID in our test DOM
    });

    it("should handle DOM errors in account ID extraction", async () => {
      const { extractAccountId } = await import("./content.js");

      // Mock querySelector to throw an error
      const originalQuerySelector = document.querySelector;
      document.querySelector = vi.fn().mockImplementation(() => {
        throw new Error("DOM error");
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = extractAccountId();
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error extracting account ID:",
        expect.any(Error)
      );

      // Restore original function
      document.querySelector = originalQuerySelector;
      consoleSpy.mockRestore();
    });

    it("should handle DOM errors in role name extraction", async () => {
      const { extractRoleName } = await import("./content.js");

      // Mock querySelectorAll to throw an error
      const originalQuerySelectorAll = document.querySelectorAll;
      document.querySelectorAll = vi.fn().mockImplementation(() => {
        throw new Error("DOM error");
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = extractRoleName();
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error extracting role name:",
        expect.any(Error)
      );

      // Restore original function
      document.querySelectorAll = originalQuerySelectorAll;
      consoleSpy.mockRestore();
    });

    it("should handle URL parsing errors", async () => {
      const { isMultiAccountUrl } = await import("./content.js");

      expect(isMultiAccountUrl("invalid-url")).toBe(false);
      expect(isMultiAccountUrl("")).toBe(false);
      expect(
        isMultiAccountUrl(
          "https://123456789012-abc.eu-west-1.console.aws.amazon.com"
        )
      ).toBe(true);
    });
  });
});
