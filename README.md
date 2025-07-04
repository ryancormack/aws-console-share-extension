# AWS Console Link Sharer

A Chrome extension that simplifies sharing AWS Console resource links by providing URL cleaning and deep link generation capabilities. Perfect for teams working across multiple AWS accounts and roles.

## 🚀 Features

- **Clean URLs**: Remove account-specific prefixes from AWS Console URLs for universal sharing
- **Deep Link Generation**: Create AWS SSO deep links for cross-account access
- **Flexible Role Selection**: Choose how roles are determined for deep links
- **One-Click Copy**: Automatically copies generated URLs to clipboard
- **Smart Detection**: Only activates on AWS Console pages
- **Error Handling**: Clear error messages and fallback options

## 📋 Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Features Overview](#features-overview)
- [Role Selection Strategies](#role-selection-strategies)
- [Configuration](#configuration)
- [Use Cases](#use-cases)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

## 🔧 Installation

### From Source (Developer Mode)

1. **Clone or download** this repository
2. **Build the extension**:
   ```bash
   npm install
   npm run build
   ```
3. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top-right)
   - Click **"Load unpacked"**
   - Select the `dist` folder from this project
4. **Pin the extension** (optional):
   - Click the puzzle piece icon in Chrome's toolbar
   - Find "AWS Console Link Sharer" and click the pin icon

## 🚀 Quick Start

### First-Time Setup

1. **Configure AWS SSO Subdomain** (required for deep links):
   - Click the extension icon → **"Settings"**
   - Enter your organization's AWS SSO subdomain
   - Example: If your SSO URL is `https://mycompany.awsapps.com`, enter `mycompany`
   - Click **"Save Settings"**

### Basic Usage

1. **Navigate to any AWS Console page**
2. **Click the extension icon** in your toolbar
3. **Choose an action**:
   - **Clean URL**: Remove account-specific prefixes
   - **Generate Deep Link**: Create cross-account SSO link
4. **URL is automatically copied** to your clipboard ✨

## 🎯 Features Overview

### URL Cleaning

Converts account-specific AWS Console URLs into universal format:

**Before (Multi-account URL):**
```
https://123456789012-abc123def.eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1
```

**After (Clean URL):**
```
https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1
```

**Benefits:**
- Share links that work regardless of how users access AWS
- Create bookmarks that work across different account access methods
- Cleaner, more professional URLs for documentation

### Deep Link Generation

Creates AWS SSO deep links that automatically authenticate users to the correct account and role:

**Generated Deep Link:**
```
https://mycompany.awsapps.com/start/#/console?account_id=123456789012&role_name=PlatformAccess&destination=https://eu-west-1.console.aws.amazon.com/cloudwatch/home
```

**Benefits:**
- Recipients automatically land in the correct AWS account
- No manual account/role switching required
- Perfect for cross-account team collaboration

## ⚙️ Role Selection Strategies

The extension offers three strategies for determining which role to use in deep links:

### 1. Use Current Logged-in Role (Default)

Uses the role from your current AWS Console session.

**When to use:**
- You want deep links to use whatever role you're currently using
- Simple setup with no additional configuration needed

**Example:**
- You're logged in as `PlatformAccess`
- Deep links will use `PlatformAccess`

### 2. Use Default Role

Always uses a specific role regardless of your current session.

**Configuration:**
1. Go to Settings → Role Selection Strategy → **"Use Default Role"**
2. Enter your preferred role name (e.g., `DeveloperAccess`)
3. Save settings

**When to use:**
- You want all deep links to use a consistent role
- You have a "standard" role that most team members should use
- You're currently using an admin role but want to share links for a regular role

**Example:**
- Default role set to: `DeveloperAccess`
- Even if you're logged in as `AdminAccess`, deep links will use `DeveloperAccess`

### 3. Use Account-Role Mapping

Maps specific roles to specific AWS accounts, with fallback options.

**Configuration:**
1. Go to Settings → Role Selection Strategy → **"Use Account-Role Mapping"**
2. Enter account-role pairs in the format `AccountID:RoleName` (one per line):
   ```
   123456789012:PlatformAdministratorAccess
   987654321098:DeveloperAccess
   555666777888:ReadOnlyAccess
   ```
3. Optionally set a default role as fallback
4. Save settings

**When to use:**
- Different accounts require different roles
- You work across multiple accounts with varying access levels
- You want fine-grained control over role selection

**Example Configuration:**
```
Production Account (123456789012): ReadOnlyAccess
Development Account (987654321098): DeveloperAccess
Staging Account (555666777888): PlatformAccess
Default Role: ViewOnlyAccess
```

**How it works:**
1. **Check mapping**: If current account ID exists in mapping → use mapped role
2. **Fallback to default**: If no mapping found → use default role (if configured)
3. **Final fallback**: If no default role → use current logged-in role

## 🔧 Configuration

### Extension Settings

Access via: Extension icon → **"Settings"** or right-click extension → **"Options"**

| Setting | Description | Required |
|---------|-------------|----------|
| **AWS SSO Subdomain** | Your organization's SSO subdomain (e.g., `mycompany`) | Yes (for deep links) |
| **Default Action** | Which button to highlight by default | No |
| **Role Selection Strategy** | How to determine role for deep links | No |
| **Default Role Name** | Role to use for "Default" or "Account-Map" strategies | Conditional |
| **Account-Role Mapping** | Account ID to role name mappings | Conditional |
| **Show Notifications** | Display success/error messages | No |
| **Auto-close Popup** | Close popup after successful action | No |

### Role Selection Configuration Examples

#### Simple Default Role Setup
```
Role Selection Strategy: Use Default Role
Default Role Name: PlatformAccess
```

#### Multi-Account Mapping Setup
```
Role Selection Strategy: Use Account-Role Mapping
Default Role Name: ViewOnlyAccess
Account-Role Mapping:
123456789012:PlatformAdministratorAccess
987654321098:DeveloperAccess
555666777888:ReadOnlyAccess
```

## 💡 Use Cases

### 1. Team Collaboration
**Scenario**: Share AWS Console links with team members
- **Clean URLs**: For documentation, wikis, or general sharing
- **Deep Links**: For specific tasks requiring account/role context

### 2. Multi-Account Organizations
**Scenario**: Work across development, staging, and production accounts
- **Account-Role Mapping**: Different roles for different environments
- **Automatic switching**: Recipients land in correct account with appropriate permissions

### 3. Documentation & Training
**Scenario**: Create training materials or runbooks
- **Clean URLs**: Universal links that work for anyone
- **Consistent roles**: Use default role strategy for standardized access

### 4. Cross-Team Support
**Scenario**: Support team needs access to specific resources
- **Deep Links**: Direct access to exact resources with appropriate role
- **Role mapping**: Different support levels for different accounts

### 5. Incident Response
**Scenario**: Quickly share links during incidents
- **One-click generation**: Fast URL creation and copying
- **Auto-close popup**: Streamlined workflow during time-sensitive situations

## 🔍 Troubleshooting

### Extension Not Working

**Issue**: Extension icon is grayed out or doesn't respond
- **Solution**: Ensure you're on an AWS Console page (`*.console.aws.amazon.com`)
- **Check**: Extension is enabled in `chrome://extensions/`

### Session Information Not Found

**Issue**: "Unable to extract AWS session information"
- **Cause**: Not logged into AWS Console or page not fully loaded
- **Solution**: 
  1. Ensure you're logged into AWS Console
  2. Refresh the page and wait for it to fully load
  3. Check that account ID is visible in the AWS Console header

### Deep Link Generation Fails

**Issue**: "AWS SSO subdomain not configured"
- **Solution**: Go to Settings and enter your organization's SSO subdomain

**Issue**: "Role name could not be extracted"
- **Cause**: Not using AWS SSO authentication
- **Solution**: Deep links require AWS SSO. For IAM users, use Clean URL feature instead

### Role Selection Not Working

**Issue**: Deep links use wrong role despite configuration
- **Check**: Settings are saved (refresh extension after changes)
- **Verify**: Role names match exactly (case-sensitive)
- **Debug**: Check browser console for error messages

### Copy to Clipboard Fails

**Issue**: URL not copied automatically
- **Cause**: Browser security restrictions
- **Fallback**: Manual copy button will be available
- **Solution**: Ensure Chrome has clipboard permissions

## 🛠️ Development

### Prerequisites
- Node.js 20+
- npm
- Chrome browser

### Setup
```bash
# Clone repository
git clone <repository-url>
cd aws-console-link-sharer

# Install dependencies
npm install

# Build extension
npm run build

# Watch for changes (development)
npm run watch
```

### Project Structure
```
src/
├── manifest.json          # Extension manifest
├── background.ts           # Service worker
├── content/
│   └── content.ts         # Content script (AWS session extraction)
├── popup/
│   ├── popup.html         # Main UI
│   ├── popup.ts           # UI logic
│   └── popup.css          # Styling
├── options/
│   ├── options.html       # Settings page
│   ├── options.ts         # Settings logic
│   └── options.css        # Settings styling
├── types/
│   └── index.ts           # TypeScript definitions
└── icons/                 # Extension icons
```

### Testing
```bash
# Run unit tests
npm test

# Run tests with UI
npm run test:ui

# Run tests once
npm run test:run
```

### Building
```bash
# Clean build
npm run clean

# Full build
npm run build

# Copy assets only
npm run copy-assets
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

If you encounter issues or have questions:

1. Search existing [GitHub Issues](../../issues)
2. Create a new issue with:
   - Chrome version
   - Extension version
   - Steps to reproduce
   - Error messages (if any)

## 🔄 Changelog

### v1.0.0
- Initial release
- URL cleaning functionality
- Deep link generation
- Flexible role selection strategies
- Auto-copy to clipboard
- Comprehensive error handling

---

**Made with Q and Claude for AWS teams everywhere**