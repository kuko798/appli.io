# Privacy Policy for Appli.io

**Last Updated:** February 9, 2026

## Overview
Appli.io is a Chrome extension that helps users track their job applications by syncing job-related emails from Gmail and organizing them in a dashboard.

## Data Collection and Usage

### What Data We Collect
- **Email Content**: We access job application emails from your Gmail account to extract information such as company names, job titles, application statuses, and dates.
- **Authentication Tokens**: We use OAuth 2.0 tokens to securely access your Gmail account.
- **API Keys**: We store your personal Groq API key locally to enable AI features.

### How We Use Your Data
- All data is processed **locally on your device** using Chrome's local storage.
- Email content is sent to **Groq's API** for analysis using your personal API key.
- Extracted data (company, role, status, date) is stored locally for display in the dashboard.
- **We do not store your data on our own servers.**
- **We do not sell, share, or transfer your data to third parties.**

### Data Storage
- All job application data and API keys are stored locally on your device using `chrome.storage.local` and `chrome.storage.sync`.
- No data is stored on external servers or databases controlled by us.
- You can delete all stored data at any time by removing the extension.

### Permissions Used
- **identity**: Required for OAuth 2.0 authentication with Google to access Gmail
- **storage**: Required to save job application data and API keys locally on your device
- **notifications**: Required to notify you about sync status and operations
- **Gmail API (gmail.readonly)**: Required to read job application emails from your inbox

### Data Security
- We use Google's OAuth 2.0 for secure authentication
- All data processing happens locally or via direct connection to Groq APIs
- We only request read-only access to Gmail
- No passwords are stored or transmitted

### Third-Party Services
- **Google Gmail API**: Used to read emails from your Gmail account
- **Google OAuth 2.0**: Used for secure authentication
- **Groq API**: Used for AI-powered email analysis and resume diagnostics. Data sent to Groq is subject to [Groq's Privacy Policy](https://groq.com/privacy/). We do not control how Groq processes data sent via your personal API key.

### Your Rights
You have the right to:
- Delete all stored data by uninstalling the extension
- Revoke Gmail access at any time through your Google Account settings
- Manually edit or delete individual job entries in the dashboard

### Changes to This Policy
We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date above.

### Contact
For questions or concerns about this privacy policy, please contact us through our GitHub repository: https://github.com/kuko798/appli.io

## Compliance
This extension complies with:
- Chrome Web Store Developer Program Policies
- Google API Services User Data Policy
- General Data Protection Regulation (GDPR) principles
