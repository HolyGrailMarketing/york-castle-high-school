# Google OAuth Configuration Guide

This guide explains how to configure Google OAuth authentication for York Castle High School.

## Overview

Google OAuth is already implemented in the backend and frontend. You just need to:
1. Create Google OAuth credentials
2. Configure environment variables
3. Set up allowed email domains

## Step 1: Create Google OAuth Credentials

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create or Select a Project**
   - Click the project dropdown at the top
   - Click "New Project" or select an existing project
   - Give it a name (e.g., "York Castle High School")
   - Click "Create"

3. **Enable Google+ API (if needed)**
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" or "People API"
   - Click on it and click "Enable"

4. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" (unless you have a Google Workspace account)
   - Fill in the required information:
     - **App name**: York Castle High School
     - **User support email**: yorkcastle.high.san@moey.gov.jm
     - **Developer contact information**: yorkcastle.high.san@moey.gov.jm
   - Click "Save and Continue"
   - Skip "Scopes" for now (click "Save and Continue")
   - Add test users if your app is in testing mode:
     - Click "Add Users"
     - Add email addresses that should be able to sign in during testing
   - Click "Save and Continue"

5. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application" as the application type
   - Give it a name (e.g., "York Castle Web Client")
   
6. **Configure Authorized Redirect URIs**
   Add the following redirect URIs (callback URLs) - **EXACT MATCH REQUIRED**:
   
   **For Development:**
   ```
   http://localhost:3000/api/auth/google/callback
   ```
   
   **For Production (York Castle High School):**
   You MUST add ALL of these exact redirect URIs:
   ```
   https://www.yorkcastlehighschool.org/api/auth/google/callback
   https://yorkcastlehighschool.org/api/auth/google/callback
   ```
   
   **Important Notes:**
   - Use **HTTPS** (not HTTP) for production
   - Include both **www** and **non-www** versions
   - The path must be exactly `/api/auth/google/callback` (no trailing slash)
   - Case-sensitive - must match exactly
   
   - Click "Create"
   - **IMPORTANT**: Copy the **Client ID** and **Client Secret** - you'll need these for the `.env` file

## Step 2: Configure Environment Variables

1. **Navigate to the backend directory**
   ```bash
   cd backend
   ```

2. **Create or edit the `.env` file**
   ```bash
   # If .env doesn't exist, create it
   touch .env
   ```

3. **Add the following variables to `.env`:**
   ```env
   # Google OAuth Configuration
   GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret-here
   GOOGLE_CALLBACK_URL=/api/auth/google/callback
   
   # Note: GOOGLE_CALLBACK_URL should be a relative path or full URL
   # For development: /api/auth/google/callback
   # For production: https://yourdomain.com/api/auth/google/callback
   ```

4. **Update ALLOWED_EMAIL_DOMAINS (optional)**
   The system already defaults to these domains:
   ```env
   ALLOWED_EMAIL_DOMAINS=moeschools.edu.jm,yorkcastlehighschool.org
   ```
   
   To add more domains, separate them with commas:
   ```env
   ALLOWED_EMAIL_DOMAINS=moeschools.edu.jm,yorkcastlehighschool.org,example.com
   ```

## Step 3: User Account Setup

**Important**: Users must have accounts created in the database BEFORE they can sign in with Google. Google OAuth will not automatically create new user accounts for security reasons.

To create a user account that can use Google Sign-In:

1. **Via Admin Dashboard** (if you have admin access):
   - Log in to the admin dashboard
   - Go to Users management
   - Create a new user with the email address
   - The user can then sign in with Google using that email

2. **Via Database** (for initial setup):
   ```sql
   -- Insert a user (they can sign in with Google using this email)
   INSERT INTO "User" (id, email, name, role, "provider", "createdAt", "updatedAt")
   VALUES (
     gen_random_uuid(),
     'user@moeschools.edu.jm',
     'User Name',
     'STUDENT',  -- or 'ADMIN', 'STAFF', 'PARENT'
     'GOOGLE',
     NOW(),
     NOW()
   );
   ```

3. **Via Registration API** (programmatically):
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "user@moeschools.edu.jm",
       "password": "temporary-password",
       "name": "User Name",
       "role": "STUDENT"
     }'
   ```
   
   After registration, the user can then use Google Sign-In (the password is optional for Google users).

## Step 4: Verify Configuration

1. **Restart your backend server**
   ```bash
   cd backend
   npm run dev
   ```

2. **Check the server logs**
   - If configured correctly, you should NOT see: "Google OAuth credentials not configured"
   - If you see this warning, check that your `.env` file has the correct variables

3. **Test Google Sign-In**
   - Go to the login page: `http://localhost:3000/admin` or `http://localhost:3000/log-in.html`
   - Click "Sign in with Google"
   - You should be redirected to Google's sign-in page
   - After signing in, you'll be redirected back to the application

## Step 5: Production Deployment

### Vercel/Serverless Deployment

1. **Add environment variables in Vercel Dashboard**:
   - Go to your Vercel project dashboard: https://vercel.com/dashboard
   - Select your project (york-castle-high-school)
   - Go to Settings > Environment Variables
   - Add these variables for **Production** environment:
     ```
     GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
     GOOGLE_CLIENT_SECRET=your-google-client-secret
     GOOGLE_CALLBACK_URL=https://www.yorkcastlehighschool.org/api/auth/google/callback
     ```
   - **IMPORTANT:** Set `GOOGLE_CALLBACK_URL` to the **full HTTPS URL** (not relative path)
   - If you have `ALLOWED_EMAIL_DOMAINS` different from default, add that too
   - Click "Save" after adding each variable

2. **Update Google Cloud Console Redirect URIs**:
   - Go to Google Cloud Console > APIs & Services > Credentials
   - Click on your OAuth 2.0 Client ID
   - Under "Authorized redirect URIs", add these EXACT URLs:
     ```
     https://www.yorkcastlehighschool.org/api/auth/google/callback
     https://yorkcastlehighschool.org/api/auth/google/callback
     ```
   - Click "Save"
   - **Wait a few minutes** for changes to propagate

### Traditional Server Deployment

1. **Update `.env` file** with production values:
   ```env
   GOOGLE_CLIENT_ID=your-production-client-id
   GOOGLE_CLIENT_SECRET=your-production-client-secret
   GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
   NODE_ENV=production
   ```

2. **Update Google Cloud Console**:
   - Add production callback URL to authorized redirect URIs
   - Ensure OAuth consent screen is published (not in testing mode)

## Troubleshooting

### Issue: "Google OAuth not configured"
**Solution**: Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in your `.env` file.

### Issue: "User account not found"
**Solution**: The user must have an account created in the database before using Google Sign-In. Create the user account first, then they can sign in with Google.

### Issue: "Email domain not allowed"
**Solution**: 
1. Check that the email domain is in `ALLOWED_EMAIL_DOMAINS` environment variable
2. Default domains are: `moeschools.edu.jm,yorkcastlehighschool.org`
3. Add more domains separated by commas if needed

### Issue: "Redirect URI mismatch" (Error 400)
**Solution**: 
1. **Check the exact redirect URI in the error message** - Google shows what it received
2. **Add the exact redirect URI to Google Cloud Console:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click on your OAuth 2.0 Client ID
   - Under "Authorized redirect URIs", click "+ ADD URI"
   - Add the EXACT URI from the error message (must match character-for-character)
   - Common URIs to add:
     ```
     https://www.yorkcastlehighschool.org/api/auth/google/callback
     https://yorkcastlehighschool.org/api/auth/google/callback
     http://localhost:3000/api/auth/google/callback (for development)
     ```
3. **Verify protocol (HTTPS vs HTTP):**
   - Production must use **HTTPS** (not HTTP)
   - If error shows `http://`, you need to add the HTTPS version
4. **Check for trailing slashes:** Must be `/api/auth/google/callback` (no trailing slash)
5. **Wait 5-10 minutes** after adding URIs for Google to propagate changes
6. **Set GOOGLE_CALLBACK_URL environment variable in Vercel:**
   ```
   GOOGLE_CALLBACK_URL=https://www.yorkcastlehighschool.org/api/auth/google/callback
   ```

### Issue: OAuth consent screen shows "This app isn't verified"
**Solution**: 
1. This is normal for apps in development/testing mode
2. Click "Advanced" > "Go to [App Name] (unsafe)" to proceed
3. To remove this warning, you need to verify your app with Google (requires app verification process)

## Security Notes

1. **Never commit `.env` file** to version control
2. **Use different OAuth credentials** for development and production
3. **Restrict allowed domains** to only your organization's domains
4. **Users must be pre-created** - Google OAuth does not auto-create accounts
5. **Keep Client Secret secure** - treat it like a password

## How It Works

1. User clicks "Sign in with Google" button
2. Frontend redirects to `/api/auth/google`
3. Backend redirects to Google's OAuth consent screen
4. User signs in with Google and grants permissions
5. Google redirects back to `/api/auth/google/callback` with authorization code
6. Backend exchanges code for user profile (email, name, picture)
7. Backend checks if user exists in database (must be pre-created)
8. Backend validates email domain is allowed
9. Backend generates JWT token and redirects to admin dashboard with token
10. Frontend stores token and user is logged in

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Passport.js Google Strategy](http://www.passportjs.org/packages/passport-google-oauth20/)
- [Google Cloud Console](https://console.cloud.google.com/)
