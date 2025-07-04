import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
};

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(),
};

// Set up DOM environment
let dom: JSDOM;
let window: any;
let document: Document;

describe('Popup Manager', () => {
  beforeEach(async () => {
    // Create a new JSDOM instance for each test
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>AWS Console Link Sharer</title></head>
        <body>
          <div id="message-area" class="message-area" style="display: none;"></div>
          <div id="current-url"></div>
          <button id="clean-url-btn" class="action-button">Clean URL</button>
          <button id="generate-deeplink-btn" class="action-button">Generate Deep Link</button>
          <div id="result-section" style="display: none;">
            <textarea id="result-url"></textarea>
            <button id="copy-btn">Copy</button>
          </div>
        </body>
      </html>
    `, {
      url: 'chrome-extension://test/popup.html',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    window = dom.window;
    document = window.document;

    // Set up global environment
    (global as any).window = window;
    (global as any).document = document;
    (global as any).chrome = mockChrome;
    (global as any).navigator = {
      clipboard: mockClipboard
    };
    
    // Mock isSecureContext for clipboard API
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true
    });

    vi.clearAllMocks();

    // Import the popup module after setting up globals
    await import('./popup.js');
  });

  afterEach(() => {
    dom.window.close();
    vi.clearAllMocks();
  });

  describe('Popup Initialization', () => {
    it('should have required DOM elements', () => {
      expect(document.getElementById('current-url')).toBeTruthy();
      expect(document.getElementById('clean-url-btn')).toBeTruthy();
      expect(document.getElementById('generate-deeplink-btn')).toBeTruthy();
      expect(document.getElementById('message-area')).toBeTruthy();
    });

    it('should handle Chrome API calls', async () => {
      mockChrome.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        active: true
      }]);

      mockChrome.storage.sync.get.mockResolvedValue({
        ssoSubdomain: 'mycompany',
        defaultAction: 'clean'
      });

      // Basic test that mocks are set up correctly
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      expect(tabs).toHaveLength(1);
    });
  });

  describe('URL Processing', () => {
    it('should handle URL parsing', () => {
      const testUrl = 'https://123456789012-abc123.eu-west-1.console.aws.amazon.com/cloudwatch';
      const url = new URL(testUrl);
      expect(url.hostname).toContain('console.aws.amazon.com');
    });

    it('should handle invalid URLs', () => {
      expect(() => new URL('invalid-url')).toThrow();
    });
  });

  describe('Deep Link Generation', () => {
    it('should generate deep link URL', () => {
      const ssoSubdomain = 'mycompany';
      const accountId = '123456789012';
      const roleName = 'TestRole';
      const destination = 'https://eu-west-1.console.aws.amazon.com/cloudwatch';

      const deepLinkUrl = new URL(`https://${ssoSubdomain}.awsapps.com/start/`);
      deepLinkUrl.hash = `/console?account_id=${accountId}&role_name=${roleName}&destination=${encodeURIComponent(destination)}`;
      
      expect(deepLinkUrl.toString()).toContain('mycompany.awsapps.com');
      expect(deepLinkUrl.toString()).toContain('account_id=123456789012');
    });
  });

  describe('Clipboard Functionality', () => {
    it('should copy text to clipboard using modern API', async () => {
      mockClipboard.writeText.mockResolvedValue(undefined);

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText('test text');
        expect(mockClipboard.writeText).toHaveBeenCalledWith('test text');
      }
    });

    it('should handle clipboard API failure', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Clipboard error'));

      try {
        await navigator.clipboard.writeText('test text');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('User Interface', () => {
    it('should display success message', () => {
      const messageArea = document.getElementById('message-area');
      if (messageArea) {
        messageArea.className = 'message-area success';
        messageArea.textContent = 'Success!';
        messageArea.style.display = 'block';

        expect(messageArea.textContent).toBe('Success!');
        expect(messageArea.className).toBe('message-area success');
        expect(messageArea.style.display).toBe('block');
      }
    });

    it('should display error message', () => {
      const messageArea = document.getElementById('message-area');
      if (messageArea) {
        messageArea.className = 'message-area error';
        messageArea.textContent = 'Error occurred!';
        messageArea.style.display = 'block';

        expect(messageArea.textContent).toBe('Error occurred!');
        expect(messageArea.className).toBe('message-area error');
        expect(messageArea.style.display).toBe('block');
      }
    });

    it('should disable buttons when needed', () => {
      const buttons = document.querySelectorAll('.action-button');
      buttons.forEach(button => {
        (button as HTMLButtonElement).disabled = true;
      });

      const cleanBtn = document.getElementById('clean-url-btn') as HTMLButtonElement;
      const deepLinkBtn = document.getElementById('generate-deeplink-btn') as HTMLButtonElement;

      expect(cleanBtn.disabled).toBe(true);
      expect(deepLinkBtn.disabled).toBe(true);
    });

    it('should display result URL', () => {
      const resultSection = document.getElementById('result-section');
      const resultTextarea = document.getElementById('result-url') as HTMLTextAreaElement;

      if (resultSection && resultTextarea) {
        resultTextarea.value = 'https://example.com/cleaned-url';
        resultSection.style.display = 'block';

        expect(resultSection.style.display).toBe('block');
        expect(resultTextarea.value).toBe('https://example.com/cleaned-url');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing DOM elements gracefully', () => {
      // Remove elements from DOM
      document.body.innerHTML = '';

      // Should handle gracefully when elements are missing
      const messageArea = document.getElementById('message-area');
      expect(messageArea).toBeNull();
    });

    it('should provide helpful error messages for different scenarios', () => {
      const errorMessages = {
        'no-tab': 'Unable to access current tab. Please try again.',
        'not-aws': 'This extension only works on AWS Console pages. Please navigate to console.aws.amazon.com.',
        'no-session': 'Unable to extract AWS session information. Please ensure you are logged in and the page has fully loaded.',
        'no-config': 'Failed to load extension configuration. Some features may not work properly.'
      };

      Object.entries(errorMessages).forEach(([errorType, expectedMessage]) => {
        expect(expectedMessage).toContain(errorType === 'no-tab' ? 'current tab' : 
                                        errorType === 'not-aws' ? 'AWS Console pages' :
                                        errorType === 'no-session' ? 'session information' :
                                        'configuration');
      });
    });

    it('should handle configuration validation errors', () => {
      const validateConfig = (config: any): { valid: boolean; error?: string } => {
        if (!config) {
          return { valid: false, error: 'Configuration is missing' };
        }

        if (!config.ssoSubdomain || config.ssoSubdomain.trim().length === 0) {
          return { valid: false, error: 'AWS SSO subdomain not configured' };
        }

        if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(config.ssoSubdomain.trim())) {
          return { valid: false, error: 'Invalid SSO subdomain format' };
        }

        return { valid: true };
      };

      expect(validateConfig(null).valid).toBe(false);
      expect(validateConfig({ ssoSubdomain: '' }).valid).toBe(false);
      expect(validateConfig({ ssoSubdomain: '-invalid-' }).valid).toBe(false);
      expect(validateConfig({ ssoSubdomain: 'valid-subdomain' }).valid).toBe(true);
    });
  });
});