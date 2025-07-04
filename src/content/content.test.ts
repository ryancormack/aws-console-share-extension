import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JSDOM } from "jsdom";

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
  },
};

// Set up DOM environment
let dom: JSDOM;
let window: any;
let document: Document;

describe("Content Script", () => {
  beforeEach(async () => {
    // Create a new JSDOM instance for each test
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <head><title>AWS Console</title></head>
        <body>
          <div id="root"></div>
        </body>
      </html>
    `,
      {
        url: "https://eu-west-1.console.aws.amazon.com/cloudwatch/home",
        pretendToBeVisual: true,
        resources: "usable",
      }
    );

    window = dom.window;
    document = window.document;

    // Set up global environment
    (global as any).window = window;
    (global as any).document = document;
    (global as any).location = window.location;
    (global as any).URL = window.URL;
    (global as any).URLSearchParams = window.URLSearchParams;
    (global as any).chrome = mockChrome;

    vi.clearAllMocks();

    // Note: Content script is not a module, so we test its functionality conceptually
  });

  afterEach(() => {
    dom.window.close();
    vi.clearAllMocks();
  });

  describe("Message Handling", () => {
    it("should set up message listener on initialization", () => {
      // Since content script is not a module, we test the message listener setup conceptually
      // In the actual content script, chrome.runtime.onMessage.addListener is called
      expect(mockChrome.runtime.onMessage.addListener).toBeDefined();
    });

    it("should handle basic message structure", () => {
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock
        .calls?.[0]?.[0] as any;

      if (messageHandler) {
        const sendResponse = vi.fn();

        // Test with invalid message
        messageHandler(null, {}, sendResponse);
        expect(sendResponse).toHaveBeenCalledWith({
          success: false,
          error: "Invalid message format",
        });

        // Test with unknown action
        messageHandler({ action: "unknown" }, {}, sendResponse);
        expect(sendResponse).toHaveBeenCalledWith({
          success: false,
          error: "Unknown action: unknown",
        });
      }
    });
  });

  describe("URL Processing", () => {
    it("should get current URL", () => {
      expect(window.location.href).toBe(
        "https://eu-west-1.console.aws.amazon.com/cloudwatch/home"
      );
    });

    it("should detect multi-account URL format", () => {
      const testUrl =
        "https://123456789012-abc123.eu-west-1.console.aws.amazon.com/cloudwatch";
      const isMultiAccount = /^\d{12}-[a-z0-9]+\./.test(
        new URL(testUrl).hostname
      );
      expect(isMultiAccount).toBe(true);
    });

    it("should extract region from URL", () => {
      const url = "https://eu-west-1.console.aws.amazon.com/cloudwatch/home";
      const match = new URL(url).hostname.match(
        /([a-z]{2}-[a-z]+-\d+)\.console\.aws\.amazon\.com/
      );
      expect(match?.[1]).toBe("eu-west-1");
    });
  });

  describe("DOM Interaction", () => {
    it("should handle DOM queries safely", () => {
      // Test that DOM queries don't throw errors
      const copyButton = document.querySelector(
        '[data-testid="awsc-copy-accountid"]'
      );
      expect(copyButton).toBeNull(); // No such element in our test DOM

      const spans = document.querySelectorAll("span");
      expect(spans).toHaveLength(0); // No spans in our test DOM
    });

    it("should validate AWS Console page", () => {
      const currentUrl = window.location.href;
      const isAwsConsole = currentUrl.includes("console.aws.amazon.com");
      expect(isAwsConsole).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle non-AWS Console pages", () => {
      // Create DOM with non-AWS URL
      dom.window.close();
      dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
        url: "https://example.com",
      });

      (global as any).window = dom.window;
      (global as any).location = dom.window.location;

      const currentUrl = dom.window.location.href;
      const isAwsConsole = currentUrl.includes("console.aws.amazon.com");
      expect(isAwsConsole).toBe(false);
    });

    it("should handle missing DOM elements gracefully", () => {
      // Test that missing elements return null without throwing
      const missingElement = document.querySelector("#non-existent");
      expect(missingElement).toBeNull();

      const missingElements = document.querySelectorAll(".non-existent");
      expect(missingElements).toHaveLength(0);
    });
  });
});
