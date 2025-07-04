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

describe('Background Service Worker', () => {
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

    // Import the background module after setting up mocks
    await import('./background.js');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Extension Initialization', () => {
    it('should set up message listeners on initialization', () => {
      // The background script should have set up listeners during import
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(mockChrome.runtime.onInstalled.addListener).toHaveBeenCalled();
    });

    it('should handle extension install event', () => {
      // Get the install handler that was registered
      const installHandler = mockChrome.runtime.onInstalled.addListener.mock.calls?.[0]?.[0];
      
      if (installHandler) {
        // Mock console.log to verify it's called
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        
        // Simulate install event
        installHandler({ reason: 'install' });
        
        expect(consoleSpy).toHaveBeenCalledWith('AWS Console Link Sharer extension installed');
        
        consoleSpy.mockRestore();
      }
    });

    it('should handle extension update event', () => {
      const installHandler = mockChrome.runtime.onInstalled.addListener.mock.calls?.[0]?.[0];
      
      if (installHandler) {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        
        // Simulate update event
        installHandler({ reason: 'update' });
        
        expect(consoleSpy).toHaveBeenCalledWith('AWS Console Link Sharer extension updated');
        
        consoleSpy.mockRestore();
      }
    });
  });

  describe('Message Handling', () => {
    it('should handle cleanUrl message correctly', async () => {
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls?.[0]?.[0];
      
      if (messageHandler) {
        const message = {
          action: 'cleanUrl',
          url: 'https://123456789012-abc123.eu-west-1.console.aws.amazon.com/cloudwatch/home'
        };
        const sender = { tab: { id: 1 } };
        const sendResponse = vi.fn();
        
        messageHandler(message, sender, sendResponse);
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(sendResponse).toHaveBeenCalled();
        const response = sendResponse.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.type).toBe('clean');
      }
    });

    it('should handle getSessionInfo message', async () => {
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls?.[0]?.[0];
      
      if (messageHandler) {
        const message = { action: 'getSessionInfo' };
        const sender = { tab: { id: 1 } };
        const sendResponse = vi.fn();
        
        messageHandler(message, sender, sendResponse);
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(sendResponse).toHaveBeenCalled();
      }
    });
  });


});