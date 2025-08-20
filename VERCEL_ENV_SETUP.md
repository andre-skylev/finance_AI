# Vercel Environment Variables Setup

## Required Environment Variables

You need to add the following environment variables in your Vercel project dashboard:

### 1. Supabase Configuration (REQUIRED)
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url (e.g., https://xxxxxxxxxxxxxxxxxxxx.supabase.co)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Important:
- Do NOT set `NEXT_PUBLIC_SUPABASE_URL` to your Vercel domain. It must be your Supabase project URL ending in `.supabase.co`.

### 2. Google Cloud Credentials (OPTIONAL - if using OCR/Vision API)
Preferred (single variable):
```
GOOGLE_CREDENTIALS_BASE64=base64_encoded_service_account_json
```

Fallback (individual variables) if base64 is not used:
```
GOOGLE_PROJECT_ID=your_project_id
GOOGLE_CLIENT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY=your_private_key
GOOGLE_PRIVATE_KEY_ID=your_private_key_id
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_CERT_URL=your_cert_url
```

### 3. OpenAI API (OPTIONAL - if using AI features)
```
OPENAI_API_KEY=your_openai_api_key
```

### 4. Middleware Fallback (Recommended for Production on Vercel)
To avoid occasional Edge bundling issues (e.g., `__dirname is not defined`) and keep auth protection, enable the cookie-only middleware fallback:

```
MW_FORCE_FALLBACK=1
```

What it does:
- Keeps middleware active, but skips importing `@supabase/ssr` in the Edge runtime.
- Uses the presence of `sb-*-auth-token` cookies to allow or redirect to `/login` on protected routes.

When to disable:
- If you later confirm `@supabase/ssr` imports no longer cause issues on your Edge deployment, remove this flag to re-enable full session refresh behavior in middleware.

## How to Add Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Click on "Settings" tab
3. Navigate to "Environment Variables"
4. Add each variable with its value
5. Select environments: Production, Preview, Development
6. Click "Save"

## Getting Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon/Public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service Role key → `SUPABASE_SERVICE_ROLE_KEY`

## Encoding Google Credentials

If you have a `google-credentials.json` file and want to convert it:

```bash
# Convert to base64 (macOS/Linux)
base64 -i credentials/google-credentials.json | tr -d '\n' > google-base64.txt

# Copy the content of google-base64.txt and use as GOOGLE_CREDENTIALS_BASE64
```

## Verify Deployment

After adding environment variables:
1. Trigger a new deployment
2. Check the Functions logs in Vercel dashboard
3. Look for any "Missing environment variables" errors

## Common Issues

### MIDDLEWARE_INVOCATION_FAILED
- Ensure all Supabase variables are set correctly
- Check that values don't have extra spaces or quotes
- Verify the Supabase project is active

### Authentication Issues
- Verify `NEXT_PUBLIC_SUPABASE_URL` points to your Supabase project (https://<project>.supabase.co), not your Vercel domain
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check Supabase project authentication settings
- Ensure cookies are enabled in your browser

### Supabase Auth URL Configuration (Required)
In Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://finance-ai-omega-eight.vercel.app` (no trailing slash)
- Additional Redirect URLs:
   - `https://finance-ai-omega-eight.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (for local dev)
   - Optional for previews: `https://*.vercel.app/auth/callback`

Our app initiates OAuth with `redirectTo: ${window.location.origin}/auth/callback`, and handles the code in `src/app/auth/callback/route.ts`.

### Malformed redirect URL after login
If you see a URL like:
`https://<project>.supabase.co/finance-ai-omega-eight.vercel.app?code=...`

This means the redirect host was not a full URL. Fix by:
1) Ensuring `NEXT_PUBLIC_SUPABASE_URL` is your Supabase URL (not Vercel), and
2) Setting Supabase Auth → Site URL to `https://finance-ai-omega-eight.vercel.app` and adding `/auth/callback` to Additional Redirect URLs.

### Google Vision API Issues
- Verify service account has Vision API enabled
- Check credentials are properly base64 encoded
- Ensure billing is enabled on Google Cloud project