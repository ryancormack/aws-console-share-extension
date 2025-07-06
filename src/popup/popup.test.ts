import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

describe('Popup Manager', () => {
  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = `
      <div id="message-area" class="message-area" style="display: none;"></div>
      <div id="current-url"></div>
      <button id="clean-url-btn" class="action-button">Clean URL</button>
      <button id="generate-deeplink-btn" class="action-button">Generate Deep Link</button>
      <div id="result-section" style="display: none;">
        <textarea id="result-url"></textarea>
        <button id="copy-btn">Copy</button>
      </div>
    `;

    // Set up global environment
    (global as any).chrome = mockChrome;
    (global as any).navigator = {
      clipboard: mockClipboard
    };
    
    // Mock isSecureContext for clipboard API
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true
    });

    // Mock window.close
    (global as any).window = {
      ...window,
      close: vi.fn(),
      isSecureContext: true
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('Role Resolution Logic', () => {
    it('should resolve role name using current strategy', async () => {
      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      
      const sessionInfo = {
        accountId: '123456789012',
        roleName: 'CurrentRole',
        currentUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        isMultiAccount: false,
        region: 'eu-west-1'
      };
      
      const config = {
        ssoSubdomain: 'mycompany',
        defaultAction: 'clean' as const,
        showNotifications: true,
        autoClosePopup: false,
        roleSelectionStrategy: 'current' as const,
        defaultRoleName: 'DefaultRole',
        accountRoleMap: {}
      };

      // Test the actual role resolution logic
      const resolvedRole = popupManager.resolveRoleName(sessionInfo, config);
      expect(resolvedRole).toBe('CurrentRole');
    });

    it('should resolve role name using default strategy', async () => {
      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      
      const sessionInfo = {
        accountId: '123456789012',
        roleName: 'CurrentRole',
        currentUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        isMultiAccount: false,
        region: 'eu-west-1'
      };
      
      const config = {
        ssoSubdomain: 'mycompany',
        defaultAction: 'clean' as const,
        showNotifications: true,
        autoClosePopup: false,
        roleSelectionStrategy: 'default' as const,
        defaultRoleName: 'DefaultRole',
        accountRoleMap: {}
      };

      const resolvedRole = popupManager.resolveRoleName(sessionInfo, config);
      expect(resolvedRole).toBe('DefaultRole');
    });

    it('should resolve role name using account-map strategy', async () => {
      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      
      const sessionInfo = {
        accountId: '123456789012',
        roleName: 'CurrentRole',
        currentUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        isMultiAccount: false,
        region: 'eu-west-1'
      };
      
      const config = {
        ssoSubdomain: 'mycompany',
        defaultAction: 'clean' as const,
        showNotifications: true,
        autoClosePopup: false,
        roleSelectionStrategy: 'account-map' as const,
        defaultRoleName: 'DefaultRole',
        accountRoleMap: {
          '123456789012': 'MappedRole'
        }
      };

      const resolvedRole = popupManager.resolveRoleName(sessionInfo, config);
      expect(resolvedRole).toBe('MappedRole');
    });

    it('should fallback to default role when account not in mapping', async () => {
      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      
      const sessionInfo = {
        accountId: '123456789012',
        roleName: 'CurrentRole',
        currentUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        isMultiAccount: false,
        region: 'eu-west-1'
      };
      
      const config = {
        ssoSubdomain: 'mycompany',
        defaultAction: 'clean' as const,
        showNotifications: true,
        autoClosePopup: false,
        roleSelectionStrategy: 'account-map' as const,
        defaultRoleName: 'FallbackRole',
        accountRoleMap: {
          '999999999999': 'MappedRole' // Different account
        }
      };

      const resolvedRole = popupManager.resolveRoleName(sessionInfo, config);
      expect(resolvedRole).toBe('FallbackRole');
    });

    it('should fallback to current role when no default role provided', async () => {
      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      
      const sessionInfo = {
        accountId: '123456789012',
        roleName: 'CurrentRole',
        currentUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        isMultiAccount: false,
        region: 'eu-west-1'
      };
      
      const config = {
        ssoSubdomain: 'mycompany',
        defaultAction: 'clean' as const,
        showNotifications: true,
        autoClosePopup: false,
        roleSelectionStrategy: 'account-map' as const,
        defaultRoleName: '', // No default role
        accountRoleMap: {
          '999999999999': 'MappedRole' // Different account
        }
      };

      const resolvedRole = popupManager.resolveRoleName(sessionInfo, config);
      expect(resolvedRole).toBe('CurrentRole');
    });
  });

  describe('URL Validation Logic', () => {
    it('should validate AWS Console URLs correctly', async () => {
      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();

      // Test valid AWS Console URLs
      expect(popupManager.isAwsConsoleUrl('https://eu-west-1.console.aws.amazon.com/cloudwatch')).toBe(true);
      expect(popupManager.isAwsConsoleUrl('https://console.aws.amazon.com/billing')).toBe(true);
      expect(popupManager.isAwsConsoleUrl('https://123456-abc.us-east-1.console.aws.amazon.com/ec2')).toBe(true);

      // Test invalid URLs
      expect(popupManager.isAwsConsoleUrl('https://google.com')).toBe(false);
      expect(popupManager.isAwsConsoleUrl('https://aws.amazon.com')).toBe(false);
      expect(popupManager.isAwsConsoleUrl('invalid-url')).toBe(false);
      expect(popupManager.isAwsConsoleUrl('')).toBe(false);
    });
  });

  describe('Clipboard Functionality', () => {
    it('should copy text to clipboard successfully', async () => {
      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();

      mockClipboard.writeText.mockResolvedValue(undefined);

      const result = await popupManager.copyToClipboard('test text');
      
      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('test text');
    });

    it('should handle clipboard copy failure', async () => {
      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();

      mockClipboard.writeText.mockRejectedValue(new Error('Clipboard error'));
      
      const result = await popupManager.copyToClipboard('test text');
      
      expect(result).toBe(false);
    });

    it('should handle clipboard API unavailable', async () => {
      // Mock clipboard API as unavailable
      (global as any).navigator = {};
      (global as any).window = {
        ...window,
        isSecureContext: false
      };

      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      
      const result = await popupManager.copyToClipboard('test text');
      expect(result).toBe(false);
    });
  });

  describe('Message Display Logic', () => {
    it('should show error messages correctly', async () => {
      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      
      popupManager.showError('Test error message');
      
      const messageArea = document.getElementById('message-area');
      expect(messageArea?.textContent).toBe('Test error message');
      expect(messageArea?.className).toBe('message-area error');
      expect(messageArea?.style.display).toBe('block');
    });

    it('should show success messages correctly', async () => {
      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      
      popupManager.showSuccess('Test success message');
      
      const messageArea = document.getElementById('message-area');
      expect(messageArea?.textContent).toBe('Test success message');
      expect(messageArea?.className).toBe('message-area success');
      expect(messageArea?.style.display).toBe('block');
    });
  });

  describe('Button State Management', () => {
    it('should disable buttons correctly', async () => {
      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      
      popupManager.disableButtons();
      
      const buttons = document.querySelectorAll('.action-button');
      buttons.forEach((button) => {
        expect((button as HTMLButtonElement).disabled).toBe(true);
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle missing tab error appropriately', async () => {
      mockChrome.tabs.query.mockResolvedValue([]);

      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      await popupManager.initializePopup();

      const messageArea = document.getElementById('message-area');
      expect(messageArea?.textContent).toBe('Unable to access current tab. Please try again.');
      expect(messageArea?.className).toBe('message-area error');
    });

    it('should handle non-AWS Console URL error', async () => {
      mockChrome.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://google.com',
        active: true
      }]);

      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      await popupManager.initializePopup();

      const messageArea = document.getElementById('message-area');
      expect(messageArea?.textContent).toBe('This extension only works on AWS Console pages. Please navigate to console.aws.amazon.com.');
    });

    it('should handle storage configuration errors', async () => {
      mockChrome.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        active: true
      }]);

      mockChrome.storage.sync.get.mockRejectedValue(new Error('Storage error'));

      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      await popupManager.initializePopup();

      // The actual behavior is that it continues with default config but fails on session loading
      const messageArea = document.getElementById('message-area');
      expect(messageArea?.textContent).toContain('Unable to extract AWS session information');
    });

    it('should handle session info extraction errors', async () => {
      mockChrome.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        active: true
      }]);

      mockChrome.storage.sync.get.mockResolvedValue({});
      mockChrome.tabs.sendMessage.mockResolvedValue({
        success: false,
        error: 'Session extraction failed'
      });

      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      await popupManager.initializePopup();

      const messageArea = document.getElementById('message-area');
      expect(messageArea?.textContent).toContain('Unable to extract AWS session information');
    });

    it('should handle content script connection errors', async () => {
      mockChrome.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        active: true
      }]);

      mockChrome.storage.sync.get.mockResolvedValue({});
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Could not establish connection'));

      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      await popupManager.initializePopup();

      const messageArea = document.getElementById('message-area');
      expect(messageArea?.textContent).toContain('Unable to extract AWS session information');
    });
  });

  describe('Configuration Validation', () => {
    it('should handle invalid SSO subdomain format', async () => {
      mockChrome.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        active: true
      }]);

      mockChrome.storage.sync.get.mockResolvedValue({
        ssoSubdomain: '-invalid-subdomain-',
        defaultAction: 'clean'
      });

      mockChrome.tabs.sendMessage.mockResolvedValue({
        success: true,
        data: {
          accountId: '123456789012',
          roleName: 'TestRole',
          currentUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
          isMultiAccount: false,
          region: 'eu-west-1'
        }
      });

      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      await popupManager.initializePopup();

      // Should initialize successfully but with cleaned config
      const messageArea = document.getElementById('message-area');
      expect(messageArea?.textContent).toBe('Extension loaded successfully!');
    });

    it('should provide default configuration on storage failure', async () => {
      mockChrome.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        active: true
      }]);

      mockChrome.storage.sync.get.mockRejectedValue(new Error('Storage unavailable'));
      mockChrome.tabs.sendMessage.mockResolvedValue({
        success: true,
        data: {
          accountId: '123456789012',
          roleName: 'TestRole',
          currentUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
          isMultiAccount: false,
          region: 'eu-west-1'
        }
      });

      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      await popupManager.initializePopup();

      // The actual behavior is that it continues with default config and shows success
      const messageArea = document.getElementById('message-area');
      expect(messageArea?.textContent).toBe('Extension loaded successfully!');
    });
  });

  describe('Session Data Validation', () => {
    it('should validate session data structure correctly', async () => {
      mockChrome.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        active: true
      }]);

      mockChrome.storage.sync.get.mockResolvedValue({});

      // Test invalid account ID
      mockChrome.tabs.sendMessage.mockResolvedValue({
        success: true,
        data: {
          accountId: 'invalid-id',
          roleName: 'TestRole',
          currentUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
          isMultiAccount: false,
          region: 'eu-west-1'
        }
      });

      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      await popupManager.initializePopup();

      const messageArea = document.getElementById('message-area');
      expect(messageArea?.textContent).toContain('Unable to extract AWS session information');
    });

    it('should handle missing session data fields', async () => {
      mockChrome.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        active: true
      }]);

      mockChrome.storage.sync.get.mockResolvedValue({});

      mockChrome.tabs.sendMessage.mockResolvedValue({
        success: true,
        data: {
          accountId: '123456789012',
          // Missing roleName and currentUrl
          isMultiAccount: false,
          region: 'eu-west-1'
        }
      });

      const { PopupManager } = await import('./popup.js');
      const popupManager = new PopupManager();
      await popupManager.initializePopup();

      const messageArea = document.getElementById('message-area');
      expect(messageArea?.textContent).toContain('Unable to extract AWS session information');
    });
  });
});