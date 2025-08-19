# Deployment Guide - Secure Credentials Setup

## Problem
Google Cloud credentials were accidentally committed to the repository. GitHub is blocking pushes for security reasons.

## Solution Steps

### 1. Remove Credentials from Git History

First, we need to completely remove the credentials from git history:

```bash
# Remove the file from the repository but keep it locally
git rm --cached credentials/google-credentials.json

# If the file is in multiple commits, use BFG Repo-Cleaner or git filter-branch
# Option A: Using BFG (recommended - faster and safer)
brew install bfg  # Install BFG on Mac
bfg --delete-files google-credentials.json
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# Option B: Using git filter-branch
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch credentials/google-credentials.json" \
  --prune-empty --tag-name-filter cat -- --all
```

### 2. Convert Credentials to Environment Variable

Instead of using a JSON file, convert your Google credentials to an environment variable:

```javascript
// In your code, replace file-based authentication with:
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
```

### 3. Prepare Credentials for Vercel

1. **Encode the JSON file to base64:**
```bash
base64 -i credentials/google-credentials.json | tr -d '\n' > google-credentials-base64.txt
```

2. **Copy the base64 string** from `google-credentials-base64.txt`

### 4. Configure Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add a new variable:
   - Name: `GOOGLE_CREDENTIALS_BASE64`
   - Value: [paste the base64 string]
   - Environment: Production, Preview, Development

### 5. Update Your Application Code

Create a utility function to handle the credentials:

```javascript
// utils/google-auth.js
export function getGoogleCredentials() {
  if (process.env.GOOGLE_CREDENTIALS_BASE64) {
    // Decode from base64 in production (Vercel)
    const credentialsJson = Buffer.from(
      process.env.GOOGLE_CREDENTIALS_BASE64, 
      'base64'
    ).toString('utf-8');
    return JSON.parse(credentialsJson);
  } else if (process.env.NODE_ENV === 'development') {
    // In development, read from local file
    const fs = require('fs');
    const path = require('path');
    const credentialsPath = path.join(process.cwd(), 'credentials', 'google-credentials.json');
    if (fs.existsSync(credentialsPath)) {
      return JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    }
  }
  
  throw new Error('Google credentials not configured');
}
```

### 6. Update .env.local for Development

Add to your `.env.local` (never commit this file):
```
# For local development, you can either use:
# Option 1: Base64 encoded credentials
GOOGLE_CREDENTIALS_BASE64=your_base64_string_here

# Option 2: Keep using the file locally (handled by the code above)
```

### 7. Force Push After Cleaning History

After removing credentials from history:

```bash
# Force push to overwrite remote history
git push --force-with-lease origin main

# If still blocked, you may need to:
# 1. Create a new branch from the cleaned history
# 2. Delete the old branch on GitHub
# 3. Push the new branch
```

### 8. Alternative: Create New Repository

If cleaning history is too complex:

1. Create a new repository on GitHub
2. Copy all files EXCEPT credentials/ folder
3. Ensure .gitignore is properly configured
4. Initialize and push to new repository

## Security Best Practices

1. **Never commit credentials** - Always use environment variables
2. **Use .gitignore** - Add credential files before first commit
3. **Rotate credentials** - After any exposure, regenerate credentials in Google Cloud Console
4. **Use Secret Management** - Consider using Vercel's built-in secrets or Google Secret Manager

## Verification

After deployment, verify:
1. Credentials are not in git history: `git log -p | grep -i "private_key"`
2. Application works on Vercel with environment variables
3. Local development still works

## Important Notes

- After this incident, you should regenerate your Google Cloud credentials
- Go to Google Cloud Console → IAM & Admin → Service Accounts
- Create new keys and delete the exposed ones
- Update your environment variables with the new credentials