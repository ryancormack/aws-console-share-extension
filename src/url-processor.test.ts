import { describe, it, expect } from 'vitest';
import { 
  cleanUrl, 
  generateDeepLink, 
  isMultiAccountUrl, 
  validateAwsConsoleUrl, 
  extractRegionFromUrl,
  validateSessionInfo,
  validateExtensionConfig,
  getConfigurationErrorMessage,
  getSessionErrorMessage,
  getFallbackOptions
} from './url-processor';
import type { SessionInfo, ExtensionConfig } from './types/index';

describe('URL Processing Functions', () => {
  describe('cleanUrl', () => {
    it('should clean multi-account URLs by removing account prefix', () => {
      const url = 'https://123456789012-abc123def.eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1';
      const result = cleanUrl(url);
      
      expect(result.success).toBe(true);
      expect(result.type).toBe('clean');
      expect(result.url).toBe('https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1');
    });

    it('should return original URL if not multi-account format', () => {
      const url = 'https://eu-west-1.console.aws.amazon.com/cloudwatch/home';
      const result = cleanUrl(url);
      
      expect(result.success).toBe(true);
      expect(result.type).toBe('clean');
      expect(result.url).toBe(url);
    });

    it('should handle invalid URL format', () => {
      const url = 'invalid-url';
      const result = cleanUrl(url);
      
      expect(result.success).toBe(false);
      expect(result.type).toBe('clean');
      expect(result.error).toBe('Invalid URL format');
    });

    it('should handle empty or null URL', () => {
      const result = cleanUrl('');
      
      expect(result.success).toBe(false);
      expect(result.type).toBe('clean');
      expect(result.error).toBe('Invalid URL provided');
    });

    it('should handle non-AWS Console URLs', () => {
      const url = 'https://google.com/search';
      const result = cleanUrl(url);
      
      expect(result.success).toBe(false);
      expect(result.type).toBe('clean');
      expect(result.error).toBe('URL is not an AWS Console URL');
    });

    it('should preserve query parameters and fragments', () => {
      const url = 'https://123456789012-xyz789.us-east-1.console.aws.amazon.com/ec2/v2/home?region=us-east-1#instances';
      const result = cleanUrl(url);
      
      expect(result.success).toBe(true);
      expect(result.url).toBe('https://us-east-1.console.aws.amazon.com/ec2/v2/home?region=us-east-1#instances');
    });
  });

  describe('isMultiAccountUrl', () => {
    it('should detect multi-account URLs', () => {
      const urls = [
        'https://123456789012-abc123def.eu-west-1.console.aws.amazon.com/cloudwatch',
        'https://987654321098-xyz789.us-east-1.console.aws.amazon.com/ec2'
      ];
      
      urls.forEach(url => {
        expect(isMultiAccountUrl(url)).toBe(true);
      });
    });

    it('should not detect regular AWS Console URLs as multi-account', () => {
      const urls = [
        'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        'https://us-east-1.console.aws.amazon.com/ec2'
      ];
      
      urls.forEach(url => {
        expect(isMultiAccountUrl(url)).toBe(false);
      });
    });

    it('should handle invalid URLs gracefully', () => {
      expect(isMultiAccountUrl('invalid-url')).toBe(false);
      expect(isMultiAccountUrl('')).toBe(false);
    });
  });

  describe('validateAwsConsoleUrl', () => {
    it('should validate correct AWS Console URLs', () => {
      const validUrls = [
        'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        'https://123456-abc.us-east-1.console.aws.amazon.com/ec2',
        'https://console.aws.amazon.com/billing'
      ];
      
      validUrls.forEach(url => {
        expect(validateAwsConsoleUrl(url)).toBe(true);
      });
    });

    it('should reject non-AWS Console URLs', () => {
      const invalidUrls = [
        'https://google.com',
        'https://aws.amazon.com',
        'http://eu-west-1.console.aws.amazon.com/cloudwatch', // http instead of https
        'https://fake-console.aws.amazon.com'
      ];
      
      invalidUrls.forEach(url => {
        expect(validateAwsConsoleUrl(url)).toBe(false);
      });
    });

    it('should handle invalid URL formats', () => {
      expect(validateAwsConsoleUrl('invalid-url')).toBe(false);
      expect(validateAwsConsoleUrl('')).toBe(false);
    });
  });

  describe('extractRegionFromUrl', () => {
    it('should extract region from standard AWS Console URLs', () => {
      const testCases = [
        { url: 'https://eu-west-1.console.aws.amazon.com/cloudwatch', expected: 'eu-west-1' },
        { url: 'https://us-east-1.console.aws.amazon.com/ec2', expected: 'us-east-1' },
        { url: 'https://ap-southeast-2.console.aws.amazon.com/s3', expected: 'ap-southeast-2' }
      ];
      
      testCases.forEach(({ url, expected }) => {
        expect(extractRegionFromUrl(url)).toBe(expected);
      });
    });

    it('should extract region from multi-account URLs', () => {
      const testCases = [
        { url: 'https://123456-abc.eu-west-1.console.aws.amazon.com/cloudwatch', expected: 'eu-west-1' },
        { url: 'https://987654-xyz.us-east-1.console.aws.amazon.com/ec2', expected: 'us-east-1' }
      ];
      
      testCases.forEach(({ url, expected }) => {
        expect(extractRegionFromUrl(url)).toBe(expected);
      });
    });

    it('should return null for URLs without region', () => {
      const urls = [
        'https://console.aws.amazon.com/billing',
        'https://invalid-url',
        'https://google.com'
      ];
      
      urls.forEach(url => {
        expect(extractRegionFromUrl(url)).toBeNull();
      });
    });

    it('should handle invalid URLs gracefully', () => {
      expect(extractRegionFromUrl('invalid-url')).toBeNull();
      expect(extractRegionFromUrl('')).toBeNull();
    });
  });

  describe('generateDeepLink', () => {
    const validSessionInfo: SessionInfo = {
      accountId: '123456789012',
      roleName: 'PlatformAccess',
      currentUrl: 'https://123456789012-abc123.eu-west-1.console.aws.amazon.com/cloudwatch/home',
      isMultiAccount: true,
      region: 'eu-west-1'
    };

    const validConfig: ExtensionConfig = {
      ssoSubdomain: 'mycompany',
      defaultAction: 'deeplink',
      showNotifications: true,
      autoClosePopup: false,
      roleSelectionStrategy: 'current',
      defaultRoleName: '',
      accountRoleMap: {}
    };

    it('should generate valid deep link with correct format', () => {
      const result = generateDeepLink(validSessionInfo, validConfig);
      
      expect(result.success).toBe(true);
      expect(result.type).toBe('deeplink');
      expect(result.url).toContain('https://mycompany.awsapps.com/start/');
      expect(result.url).toContain('account_id=123456789012');
      expect(result.url).toContain('role_name=PlatformAccess');
      expect(result.url).toContain('destination=https%3A%2F%2Feu-west-1.console.aws.amazon.com%2Fcloudwatch%2Fhome');
    });

    it('should clean the destination URL before including it', () => {
      const result = generateDeepLink(validSessionInfo, validConfig);
      
      expect(result.success).toBe(true);
      // The destination URL should be cleaned (account prefix removed)
      expect(result.url).toContain('destination=https%3A%2F%2Feu-west-1.console.aws.amazon.com%2Fcloudwatch%2Fhome');
      expect(result.url).not.toContain('123456789012-abc123');
    });

    it('should fail when SSO subdomain is missing', () => {
      const configWithoutSubdomain: ExtensionConfig = {
        ...validConfig,
        ssoSubdomain: ''
      };
      
      const result = generateDeepLink(validSessionInfo, configWithoutSubdomain);
      
      expect(result.success).toBe(false);
      expect(result.type).toBe('deeplink');
      expect(result.error).toContain('AWS SSO subdomain not configured');
    });

    it('should fail when account ID is missing', () => {
      const sessionWithoutAccountId: SessionInfo = {
        ...validSessionInfo,
        accountId: ''
      };
      
      const result = generateDeepLink(sessionWithoutAccountId, validConfig);
      
      expect(result.success).toBe(false);
      expect(result.type).toBe('deeplink');
      expect(result.error).toBe('Missing required session information');
    });

    it('should fail when role name is missing', () => {
      const sessionWithoutRole: SessionInfo = {
        ...validSessionInfo,
        roleName: ''
      };
      
      const result = generateDeepLink(sessionWithoutRole, validConfig);
      
      expect(result.success).toBe(false);
      expect(result.type).toBe('deeplink');
      expect(result.error).toBe('Missing required session information');
    });

    it('should fail when current URL is missing', () => {
      const sessionWithoutUrl: SessionInfo = {
        ...validSessionInfo,
        currentUrl: ''
      };
      
      const result = generateDeepLink(sessionWithoutUrl, validConfig);
      
      expect(result.success).toBe(false);
      expect(result.type).toBe('deeplink');
      expect(result.error).toBe('Missing required session information');
    });

    it('should fail when account ID format is invalid', () => {
      const sessionWithInvalidAccountId: SessionInfo = {
        ...validSessionInfo,
        accountId: '12345' // Too short
      };
      
      const result = generateDeepLink(sessionWithInvalidAccountId, validConfig);
      
      expect(result.success).toBe(false);
      expect(result.type).toBe('deeplink');
      expect(result.error).toBe('Invalid account ID format');
    });

    it('should handle subdomain with whitespace', () => {
      const configWithWhitespace: ExtensionConfig = {
        ...validConfig,
        ssoSubdomain: '  mycompany  '
      };
      
      const result = generateDeepLink(validSessionInfo, configWithWhitespace);
      
      expect(result.success).toBe(true);
      expect(result.url).toContain('https://mycompany.awsapps.com/start/');
    });

    it('should properly encode special characters in destination URL', () => {
      const sessionWithSpecialChars: SessionInfo = {
        ...validSessionInfo,
        currentUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch/home?filter=test&value=hello world'
      };
      
      const result = generateDeepLink(sessionWithSpecialChars, validConfig);
      
      expect(result.success).toBe(true);
      expect(result.url).toContain('destination=https%3A%2F%2Feu-west-1.console.aws.amazon.com%2Fcloudwatch%2Fhome%3Ffilter%3Dtest%26value%3Dhello+world');
    });
  });

  describe('Error Handling and Validation', () => {
    describe('validateSessionInfo', () => {
      const validSessionInfo: SessionInfo = {
        accountId: '123456789012',
        roleName: 'TestRole',
        currentUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        isMultiAccount: false,
        region: 'eu-west-1'
      };

      it('should validate correct session info', () => {
        const result = validateSessionInfo(validSessionInfo);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect missing account ID', () => {
        const invalidSession = { ...validSessionInfo, accountId: '' };
        const result = validateSessionInfo(invalidSession);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Account ID is missing');
      });

      it('should detect invalid account ID format', () => {
        const invalidSession = { ...validSessionInfo, accountId: '12345' };
        const result = validateSessionInfo(invalidSession);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Account ID must be 6-12 digits');
      });

      it('should detect missing role name', () => {
        const invalidSession = { ...validSessionInfo, roleName: '' };
        const result = validateSessionInfo(invalidSession);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Role name cannot be empty');
      });

      it('should detect invalid role name characters', () => {
        const invalidSession = { ...validSessionInfo, roleName: 'invalid@role#' };
        const result = validateSessionInfo(invalidSession);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Role name contains invalid characters');
      });

      it('should detect invalid current URL', () => {
        const invalidSession = { ...validSessionInfo, currentUrl: 'https://example.com' };
        const result = validateSessionInfo(invalidSession);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Current URL is not a valid AWS Console URL');
      });

      it('should handle null or undefined session info', () => {
        const result = validateSessionInfo(null);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Session information is missing or not an object');
      });
    });

    describe('validateExtensionConfig', () => {
      const validConfig: ExtensionConfig = {
        ssoSubdomain: 'mycompany',
        defaultAction: 'clean',
        showNotifications: true,
        autoClosePopup: true,
        roleSelectionStrategy: 'current',
        defaultRoleName: '',
        accountRoleMap: {}
      };

      it('should validate correct configuration', () => {
        const result = validateExtensionConfig(validConfig);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect missing SSO subdomain', () => {
        const invalidConfig = { ...validConfig, ssoSubdomain: '' };
        const result = validateExtensionConfig(invalidConfig);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('AWS SSO subdomain cannot be empty');
      });

      it('should detect invalid subdomain format', () => {
        const invalidConfig = { ...validConfig, ssoSubdomain: '-invalid-' };
        const result = validateExtensionConfig(invalidConfig);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('AWS SSO subdomain format is invalid');
      });

      it('should detect subdomain too long', () => {
        const invalidConfig = { ...validConfig, ssoSubdomain: 'a'.repeat(64) };
        const result = validateExtensionConfig(invalidConfig);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('AWS SSO subdomain cannot exceed 63 characters');
      });

      it('should detect invalid default action', () => {
        const invalidConfig = { ...validConfig, defaultAction: 'invalid' as any };
        const result = validateExtensionConfig(invalidConfig);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Default action must be either "clean" or "deeplink"');
      });

      it('should handle null or undefined config', () => {
        const result = validateExtensionConfig(null);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Configuration is missing or not an object');
      });
    });

    describe('Error message helpers', () => {
      it('should provide configuration error messages with guidance', () => {
        const invalidConfig = { ssoSubdomain: '' };
        const message = getConfigurationErrorMessage(invalidConfig);
        expect(message).toContain('AWS SSO subdomain');
        expect(message).toContain('extension options');
        expect(message).toContain('mycompany');
      });

      it('should provide session error messages with guidance', () => {
        const invalidSession = { accountId: '', roleName: 'test' };
        const message = getSessionErrorMessage(invalidSession);
        expect(message).toContain('Account ID');
        expect(message).toContain('AWS Console page');
        expect(message).toContain('logged in properly');
      });

      it('should return null for valid configurations', () => {
        const validConfig = {
          ssoSubdomain: 'mycompany',
          defaultAction: 'clean',
          showNotifications: true,
          autoClosePopup: true
        };
        const message = getConfigurationErrorMessage(validConfig);
        expect(message).toBeNull();
      });
    });

    describe('Fallback options', () => {
      it('should provide clean URL fallback options', () => {
        const options = getFallbackOptions('clean', 'https://example.com');
        expect(options).toContain('Try copying the current URL manually');
        expect(options).toContain('Check if you are on a multi-account AWS Console page');
        expect(options).toContain('Refresh the page and try again');
      });

      it('should provide deep link fallback options', () => {
        const options = getFallbackOptions('deeplink');
        expect(options).toContain('Configure your AWS SSO subdomain in extension options');
        expect(options).toContain('Ensure you are logged in with AWS SSO');
        expect(options).toContain('Try using the clean URL option instead');
        expect(options).toContain('Contact your AWS administrator for SSO configuration details');
      });
    });
  });

  describe('Enhanced Error Handling in Core Functions', () => {
    describe('cleanUrl edge cases', () => {
      it('should handle empty or null URLs', () => {
        expect(cleanUrl('').success).toBe(false);
        expect(cleanUrl('   ').success).toBe(false);
        expect(cleanUrl(null as any).success).toBe(false);
        expect(cleanUrl(undefined as any).success).toBe(false);
      });

      it('should handle non-HTTPS URLs', () => {
        const result = cleanUrl('http://console.aws.amazon.com');
        expect(result.success).toBe(false);
        expect(result.error).toContain('HTTPS');
      });

      it('should validate account ID format in multi-account URLs', () => {
        const result = cleanUrl('https://12345-abcdef.eu-west-1.console.aws.amazon.com/cloudwatch');
        expect(result.success).toBe(false);
        expect(result.error).toContain('account ID format');
      });

      it('should validate random chars format in multi-account URLs', () => {
        const result = cleanUrl('https://123456789012-ABC123.eu-west-1.console.aws.amazon.com/cloudwatch');
        expect(result.success).toBe(false);
        expect(result.error).toContain('random characters must be alphanumeric lowercase');
      });
    });

    describe('generateDeepLink edge cases', () => {
      const validSessionInfo: SessionInfo = {
        accountId: '123456789012',
        roleName: 'TestRole',
        currentUrl: 'https://eu-west-1.console.aws.amazon.com/cloudwatch',
        isMultiAccount: false,
        region: 'eu-west-1'
      };

      const validConfig: ExtensionConfig = {
        ssoSubdomain: 'mycompany',
        defaultAction: 'clean',
        showNotifications: true,
        autoClosePopup: true,
        roleSelectionStrategy: 'current',
        defaultRoleName: '',
        accountRoleMap: {}
      };

      it('should handle missing session information', () => {
        const result = generateDeepLink(null as any, validConfig);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Session information is missing');
      });

      it('should handle missing configuration', () => {
        const result = generateDeepLink(validSessionInfo, null as any);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Extension configuration is missing');
      });

      it('should validate subdomain format', () => {
        const configWithInvalidSubdomain = { ...validConfig, ssoSubdomain: 'invalid-subdomain-' };
        const result = generateDeepLink(validSessionInfo, configWithInvalidSubdomain);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid AWS SSO subdomain format');
      });

      it('should validate role name format', () => {
        const sessionWithInvalidRole = { ...validSessionInfo, roleName: 'invalid@role#name' };
        const result = generateDeepLink(sessionWithInvalidRole, validConfig);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid role name format');
      });

      it('should handle very long URLs', () => {
        const longUrl = 'https://eu-west-1.console.aws.amazon.com/cloudwatch?' + 'param='.repeat(500) + 'value';
        const sessionWithLongUrl = { ...validSessionInfo, currentUrl: longUrl };
        const result = generateDeepLink(sessionWithLongUrl, validConfig);
        
        if (!result.success) {
          expect(result.error).toContain('too long');
        }
      });
    });

    describe('isMultiAccountUrl edge cases', () => {
      it('should handle null and undefined URLs', () => {
        expect(isMultiAccountUrl(null as any)).toBe(false);
        expect(isMultiAccountUrl(undefined as any)).toBe(false);
      });

      it('should handle non-string inputs', () => {
        expect(isMultiAccountUrl(123 as any)).toBe(false);
        expect(isMultiAccountUrl({} as any)).toBe(false);
      });
    });

    describe('validateAwsConsoleUrl edge cases', () => {
      it('should handle null and undefined URLs', () => {
        expect(validateAwsConsoleUrl(null as any)).toBe(false);
        expect(validateAwsConsoleUrl(undefined as any)).toBe(false);
      });

      it('should handle empty strings', () => {
        expect(validateAwsConsoleUrl('')).toBe(false);
        expect(validateAwsConsoleUrl('   ')).toBe(false);
      });

      it('should handle non-string inputs', () => {
        expect(validateAwsConsoleUrl(123 as any)).toBe(false);
        expect(validateAwsConsoleUrl({} as any)).toBe(false);
      });
    });

    describe('extractRegionFromUrl edge cases', () => {
      it('should handle null and undefined URLs', () => {
        expect(extractRegionFromUrl(null as any)).toBeNull();
        expect(extractRegionFromUrl(undefined as any)).toBeNull();
      });

      it('should extract region from URL parameters', () => {
        const url = 'https://console.aws.amazon.com/cloudwatch?region=us-west-2';
        expect(extractRegionFromUrl(url)).toBe('us-west-2');
      });

      it('should validate region format', () => {
        const url = 'https://invalid-region.console.aws.amazon.com/cloudwatch';
        expect(extractRegionFromUrl(url)).toBeNull();
      });
    });
  });}
);