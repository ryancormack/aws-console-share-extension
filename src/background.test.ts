import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    get: vi.fn(),
    sendMessage: vi.fn(),
    query: vi.fn(),
  },
};

// Make chrome available globally
(global as any).chrome = mockChrome;

// Mock the url-processor module
vi.mock('./url-processor.js', () => ({
  cleanUrl: vi.fn(),
  generateDeepLink: vi.fn(),
  validateAwsConsoleUrl: vi.fn(),
}));

describe('Background Service Worker', () => {
  let handleMessage: any;
  let validateAwsConsoleTab: any;
  let initializeExtension: any;
  let cleanUrl: any;
  let generateDeepLink: any;
  let validateAwsConsoleUrl: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Set up default mock implementations
    mockChrome.tabs.get.mockResolvedValue({
      id: 1,
      url: 'https://eu-west-1.console.aws.amazon.com/cloudwatch/home',
      active: true,
      status: 'complete'
    });
    
    mockChrome.tabs.sendMessage.mockResolvedValue({
      success: true,
      data: {
        accountId: '123456789012',
        roleName: 'TestRole',
        currentUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch/home',
        isMultiAccount: false,
        region: 'eu-west-1'
      }
    });

    // Import the background module and get the exported functions
    const backgroundModule = await import('./background.js');
    handleMessage = backgroundModule.handleMessage;
    validateAwsConsoleTab = backgroundModule.validateAwsConsoleTab;
    initializeExtension = backgroundModule.initializeExtension;

    // Get mocked url-processor functions
    const urlProcessorModule = await import('./url-processor.js');
    cleanUrl = urlProcessorModule.cleanUrl;
    generateDeepLink = urlProcessorModule.generateDeepLink;
    validateAwsConsoleUrl = urlProcessorModule.validateAwsConsoleUrl;

    // Set up default mock implementations for url-processor
    cleanUrl.mockReturnValue({
      success: true,
      type: 'clean',
      cleanedUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch/home',
      originalUrl: 'https://123456789012-abc123.eu-west-1.console.aws.amazon.com/cloudwatch/home'
    });

    generateDeepLink.mockReturnValue({
      success: true,
      type: 'deeplink',
      deepLinkUrl: 'https://example.awsapps.com/start#/console?account_id=123456789012&role_name=TestRole&destination=https://eu-west-1.console.aws.amazon.com/cloudwatch/home'
    });

    validateAwsConsoleUrl.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Extension Initialization', () => {
    it('should set up message listeners on initialization', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      initializeExtension();
      
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(mockChrome.runtime.onInstalled.addListener).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('AWS Console Link Sharer extension initialized');
      
      consoleSpy.mockRestore();
    });

    it('should handle extension install event', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      initializeExtension();
      
      // Get the install handler that was registered
      const installHandler = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Simulate install event
      installHandler({ reason: 'install' });
      
      expect(consoleSpy).toHaveBeenCalledWith('AWS Console Link Sharer extension installed');
      
      consoleSpy.mockRestore();
    });

    it('should handle extension update event', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      initializeExtension();
      
      const installHandler = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Simulate update event
      installHandler({ reason: 'update' });
      
      expect(consoleSpy).toHaveBeenCalledWith('AWS Console Link Sharer extension updated');
      
      consoleSpy.mockRestore();
    });

    it('should handle unknown install reason', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      initializeExtension();
      
      const installHandler = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Simulate unknown reason event
      installHandler({ reason: 'unknown' });
      
      // Should not log anything for unknown reasons
      expect(consoleSpy).toHaveBeenCalledWith('AWS Console Link Sharer extension initialized');
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('installed'));
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('updated'));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Message Handling', () => {
    describe('cleanUrl action', () => {
      it('should handle cleanUrl message correctly', async () => {
        const message = {
          action: 'cleanUrl',
          url: 'https://123456789012-abc123.eu-west-1.console.aws.amazon.com/cloudwatch/home'
        };
        const sender = { tab: { id: 1 } };
        
        const result = await handleMessage(message, sender);
        
        expect(cleanUrl).toHaveBeenCalledWith(message.url);
        expect(result).toEqual({
          success: true,
          type: 'clean',
          cleanedUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch/home',
          originalUrl: 'https://123456789012-abc123.eu-west-1.console.aws.amazon.com/cloudwatch/home'
        });
      });

      it('should return error when URL is missing for cleanUrl', async () => {
        const message = { action: 'cleanUrl' };
        const sender = { tab: { id: 1 } };
        
        const result = await handleMessage(message, sender);
        
        expect(result).toEqual({
          type: 'url',
          message: 'URL is required for cleaning'
        });
        expect(cleanUrl).not.toHaveBeenCalled();
      });

      it('should return error when URL is empty for cleanUrl', async () => {
        const message = { action: 'cleanUrl', url: '' };
        const sender = { tab: { id: 1 } };
        
        const result = await handleMessage(message, sender);
        
        expect(result).toEqual({
          type: 'url',
          message: 'URL is required for cleaning'
        });
        expect(cleanUrl).not.toHaveBeenCalled();
      });
    });

    describe('generateDeepLink action', () => {
      it('should handle generateDeepLink message correctly', async () => {
        const sessionInfo = {
          accountId: '123456789012',
          roleName: 'TestRole',
          currentUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch/home',
          isMultiAccount: false,
          region: 'eu-west-1'
        };
        const config = {
          ssoSubdomain: 'example',
          autoClose: true,
          defaultAction: 'clean'
        };
        const message = {
          action: 'generateDeepLink',
          sessionInfo,
          config
        };
        const sender = { tab: { id: 1 } };
        
        const result = await handleMessage(message, sender);
        
        expect(generateDeepLink).toHaveBeenCalledWith(sessionInfo, config);
        expect(result).toEqual({
          success: true,
          type: 'deeplink',
          deepLinkUrl: 'https://example.awsapps.com/start#/console?account_id=123456789012&role_name=TestRole&destination=https://eu-west-1.console.aws.amazon.com/cloudwatch/home'
        });
      });

      it('should return error when sessionInfo is missing for generateDeepLink', async () => {
        const message = {
          action: 'generateDeepLink',
          config: { ssoSubdomain: 'example' }
        };
        const sender = { tab: { id: 1 } };
        
        const result = await handleMessage(message, sender);
        
        expect(result).toEqual({
          type: 'url',
          message: 'Session info and config are required'
        });
        expect(generateDeepLink).not.toHaveBeenCalled();
      });

      it('should return error when config is missing for generateDeepLink', async () => {
        const message = {
          action: 'generateDeepLink',
          sessionInfo: { accountId: '123456789012' }
        };
        const sender = { tab: { id: 1 } };
        
        const result = await handleMessage(message, sender);
        
        expect(result).toEqual({
          type: 'url',
          message: 'Session info and config are required'
        });
        expect(generateDeepLink).not.toHaveBeenCalled();
      });
    });

    describe('getSessionInfo action', () => {
      it('should handle getSessionInfo message correctly', async () => {
        const message = { action: 'getSessionInfo' };
        const sender = { tab: { id: 1 } };
        
        const result = await handleMessage(message, sender);
        
        expect(mockChrome.tabs.get).toHaveBeenCalledWith(1);
        expect(validateAwsConsoleUrl).toHaveBeenCalledWith('https://eu-west-1.console.aws.amazon.com/cloudwatch/home');
        expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, { action: 'getSessionInfo' });
        expect(result).toEqual({
          accountId: '123456789012',
          roleName: 'TestRole',
          currentUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch/home',
          isMultiAccount: false,
          region: 'eu-west-1'
        });
      });

      it('should use tabId from message if provided', async () => {
        const message = { action: 'getSessionInfo', tabId: 2 };
        const sender = { tab: { id: 1 } };
        
        mockChrome.tabs.get.mockResolvedValueOnce({
          id: 2,
          url: 'https://us-east-1.console.aws.amazon.com/ec2/home'
        });
        
        await handleMessage(message, sender);
        
        expect(mockChrome.tabs.get).toHaveBeenCalledWith(2);
        expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(2, { action: 'getSessionInfo' });
      });

      it('should return error when no tab ID is available', async () => {
        const message = { action: 'getSessionInfo' };
        const sender = {}; // No tab info
        
        const result = await handleMessage(message, sender);
        
        expect(result).toEqual({
          type: 'permission',
          message: 'Unable to identify current tab'
        });
        expect(mockChrome.tabs.get).not.toHaveBeenCalled();
      });

      it('should return error when tab is not AWS Console page', async () => {
        const message = { action: 'getSessionInfo' };
        const sender = { tab: { id: 1 } };
        
        validateAwsConsoleUrl.mockReturnValueOnce(false);
        
        const result = await handleMessage(message, sender);
        
        expect(result).toEqual({
          type: 'permission',
          message: 'Extension only works on AWS Console pages'
        });
        expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
      });

      it('should return error when content script returns failure', async () => {
        const message = { action: 'getSessionInfo' };
        const sender = { tab: { id: 1 } };
        
        mockChrome.tabs.sendMessage.mockResolvedValueOnce({
          success: false,
          error: 'Session extraction failed'
        });
        
        const result = await handleMessage(message, sender);
        
        expect(result).toEqual({
          type: 'session',
          message: 'Session extraction failed'
        });
      });

      it('should return default error when content script returns failure without error message', async () => {
        const message = { action: 'getSessionInfo' };
        const sender = { tab: { id: 1 } };
        
        mockChrome.tabs.sendMessage.mockResolvedValueOnce({
          success: false
        });
        
        const result = await handleMessage(message, sender);
        
        expect(result).toEqual({
          type: 'session',
          message: 'Content script error'
        });
      });

      it('should handle content script connection error', async () => {
        const message = { action: 'getSessionInfo' };
        const sender = { tab: { id: 1 } };
        
        mockChrome.tabs.sendMessage.mockRejectedValueOnce(
          new Error('Could not establish connection. Receiving end does not exist.')
        );
        
        const result = await handleMessage(message, sender);
        
        expect(result).toEqual({
          type: 'session',
          message: 'Content script not loaded. Please refresh the page.'
        });
      });

      it('should handle content script disconnection error', async () => {
        const message = { action: 'getSessionInfo' };
        const sender = { tab: { id: 1 } };
        
        mockChrome.tabs.sendMessage.mockRejectedValueOnce(
          new Error('The message port closed before a response was received. receiving end does not exist')
        );
        
        const result = await handleMessage(message, sender);
        
        expect(result).toEqual({
          type: 'session',
          message: 'Content script disconnected. Please refresh the page.'
        });
      });

      it('should handle generic content script error', async () => {
        const message = { action: 'getSessionInfo' };
        const sender = { tab: { id: 1 } };
        
        mockChrome.tabs.sendMessage.mockRejectedValueOnce(
          new Error('Some other error')
        );
        
        const result = await handleMessage(message, sender);
        
        expect(result).toEqual({
          type: 'session',
          message: 'Failed to communicate with content script'
        });
      });

      it('should handle non-Error exceptions from content script', async () => {
        const message = { action: 'getSessionInfo' };
        const sender = { tab: { id: 1 } };
        
        mockChrome.tabs.sendMessage.mockRejectedValueOnce('String error');
        
        const result = await handleMessage(message, sender);
        
        expect(result).toEqual({
          type: 'session',
          message: 'Failed to communicate with content script'
        });
      });
    });

    describe('getCurrentUrl action', () => {
      it('should handle getCurrentUrl message correctly', async () => {
        const message = { action: 'getCurrentUrl' };
        const sender = { tab: { id: 1 } };
        
        mockChrome.tabs.sendMessage.mockResolvedValueOnce({
          success: true,
          data: { currentUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch/home' }
        });
        
        const result = await handleMessage(message, sender);
        
        expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, { action: 'getCurrentUrl' });
        expect(result).toEqual({
          currentUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch/home'
        });
      });
    });

    describe('unknown action', () => {
      it('should return error for unknown action', async () => {
        const message = { action: 'unknownAction' };
        const sender = { tab: { id: 1 } };
        
        const result = await handleMessage(message, sender);
        
        expect(result).toEqual({
          type: 'permission',
          message: 'Unknown message action'
        });
      });
    });

    describe('error handling', () => {
      it('should handle top-level exceptions', async () => {
        const message = { action: 'cleanUrl', url: 'test' };
        const sender = { tab: { id: 1 } };
        
        // Make cleanUrl throw an error
        cleanUrl.mockImplementationOnce(() => {
          throw new Error('Test error');
        });
        
        const result = await handleMessage(message, sender);
        
        expect(result).toEqual({
          type: 'session',
          message: 'Background script error'
        });
      });
    });
    });

  describe('Tab Validation', () => {
    it('should validate AWS Console tab correctly', async () => {
      const result = await validateAwsConsoleTab(1);
      
      expect(mockChrome.tabs.get).toHaveBeenCalledWith(1);
      expect(validateAwsConsoleUrl).toHaveBeenCalledWith('https://eu-west-1.console.aws.amazon.com/cloudwatch/home');
      expect(result).toBe(true);
    });

    it('should return false for non-AWS Console tab', async () => {
      mockChrome.tabs.get.mockResolvedValueOnce({
        id: 1,
        url: 'https://example.com'
      });
      validateAwsConsoleUrl.mockReturnValueOnce(false);
      
      const result = await validateAwsConsoleTab(1);
      
      expect(result).toBe(false);
    });

    it('should return false when tab has no URL', async () => {
      mockChrome.tabs.get.mockResolvedValueOnce({
        id: 1,
        url: null
      });
      
      const result = await validateAwsConsoleTab(1);
      
      expect(result).toBe(false);
      expect(validateAwsConsoleUrl).not.toHaveBeenCalled();
    });

    it('should return false when tab is undefined', async () => {
      mockChrome.tabs.get.mockResolvedValueOnce(undefined);
      
      const result = await validateAwsConsoleTab(1);
      
      expect(result).toBe(false);
    });

    it('should handle tab get error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockChrome.tabs.get.mockRejectedValueOnce(new Error('Tab not found'));
      
      const result = await validateAwsConsoleTab(1);
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Error validating AWS Console tab:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Message Handler Integration', () => {
    it('should handle message through Chrome runtime listener', async () => {
      initializeExtension();
      
      // Get the message handler that was registered
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = vi.fn();
      
      const message = {
        action: 'cleanUrl',
        url: 'https://123456789012-abc123.eu-west-1.console.aws.amazon.com/cloudwatch/home'
      };
      const sender = { tab: { id: 1 } };
      
      const result = messageHandler(message, sender, sendResponse);
      
      expect(result).toBe(true); // Should return true for async response
      
      // Wait for async response
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        type: 'clean',
        cleanedUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch/home',
        originalUrl: 'https://123456789012-abc123.eu-west-1.console.aws.amazon.com/cloudwatch/home'
      });
    });

    it('should handle message handler errors through Chrome runtime listener', async () => {
      initializeExtension();
      
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = vi.fn();
      
      // Make handleMessage throw an error by mocking cleanUrl to throw
      cleanUrl.mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      const message = { action: 'cleanUrl', url: 'test' };
      const sender = { tab: { id: 1 } };
      
      messageHandler(message, sender, sendResponse);
      
      // Wait for async response
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(sendResponse).toHaveBeenCalledWith({
        type: 'session',
        message: 'Background script error'
      });
    });

    it('should handle non-Error exceptions in message handler', async () => {
      initializeExtension();
      
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = vi.fn();
      
      // Make handleMessage throw a non-Error
      cleanUrl.mockImplementationOnce(() => {
        throw 'String error';
      });
      
      const message = { action: 'cleanUrl', url: 'test' };
      const sender = { tab: { id: 1 } };
      
      messageHandler(message, sender, sendResponse);
      
      // Wait for async response
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(sendResponse).toHaveBeenCalledWith({
        type: 'session',
        message: 'Background script error'
      });
    });
  });

});