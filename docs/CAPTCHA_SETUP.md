# Cloudflare Turnstile + Supabase CAPTCHA Setup Guide

This guide provides step-by-step instructions to activate CAPTCHA protection on your login and signup pages using Cloudflare Turnstile with Supabase.

---

## Part 1: Create Cloudflare Account and Get Turnstile Keys

### Step 1: Sign Up for Cloudflare

1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/login)
2. Click **Sign Up** (if you don't have an account)
3. Complete the registration process with your email and password
4. Verify your email address

### Step 2: Access Turnstile

1. Once logged in to the Cloudflare Dashboard, look for **Turnstile** in the left sidebar navigation
2. Click on **Turnstile** (or navigate directly via the [Turnstile page](https://dash.cloudflare.com/?to=/:account/turnstile))

### Step 3: Create a New Turnstile Widget

1. Click the **Add widget** button (usually displayed prominently on the Turnstile page)
2. Fill out the required fields:
   - **Widget name**: Enter a descriptive name (e.g., "My App Auth" or "Production Login")
   - **Hostname management**: 
     - **For production**: Enter your domain (e.g., `yourdomain.com`)
     - **For local development**: Enter `localhost`
     - Click **Add** to include each domain
   - **Widget mode**: Select one of these options:
     - **Managed** (Recommended): Cloudflare decides when to show a challenge
     - **Non-Interactive**: Always runs without user interaction
     - **Invisible**: Hidden challenge, no visual widget
3. (Optional) **Pre-clearance support**: Leave unchecked unless you're building a single-page application with specific requirements
4. Click the **Create** button at the bottom

### Step 4: Copy Your Keys

After creating the widget, you'll see two important keys:

1. **Sitekey** (Public Key)
   - This is visible in your widget list and settings
   - Safe to use in client-side code
   - Example format: `0x4AAAAAAxxxxxxxxxxxxx`

2. **Secret Key** (Private Key)
   - Shown once after widget creation (can be regenerated later if needed)
   - ⚠️ **NEVER expose this in client-side code**
   - Store this securely
   - Example format: `0x4AAAAAAxxxxxxxxxxxxx`

**💡 Tip**: Open a text editor and paste both keys temporarily - you'll need them in the next steps.

---

## Part 2: Configure Supabase Dashboard

### Step 5: Open Supabase Project Settings

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project from the project list
3. Click on the **Settings** icon (⚙️) in the left sidebar (usually at the bottom)
4. Navigate to **Authentication** (or **Auth**) in the settings menu

### Step 6: Enable CAPTCHA Protection

1. In the Authentication settings, scroll down to find:
   - **Bot and Abuse Protection** section
   - Look for **Enable CAPTCHA protection** toggle

2. Click the toggle to enable it (it will turn blue/green when active)

3. Configure the CAPTCHA settings:
   - **CAPTCHA Provider**: Select **Turnstile** from the dropdown menu
   - **CAPTCHA Secret**: Paste your **Secret Key** from Cloudflare (the one you copied in Step 4)

4. Click the **Save** button at the bottom of the page

✅ **Verification**: You should see a success message confirming your CAPTCHA settings have been saved.

---

## Part 3: Add Keys to Your Local Development Environment

### Step 7: Configure Environment Variables

1. Open your project folder in your code editor
2. Locate the `.env.local` file in the root directory of your project

3. Update the file with these environment variables:

```bash
# Cloudflare Turnstile Keys
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_sitekey_here

# Example with actual format:
# NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAxxxxxxxxxxxxx
```

Replace `your_sitekey_here` with the **Sitekey** you copied from Cloudflare.

**📝 Naming Notes**:
- The `NEXT_PUBLIC_` prefix exposes the variable to the browser (safe for the public Sitekey)
- This is already configured in your code to use this variable name
- Do NOT include the Secret Key in `.env.local` — Supabase handles it server-side

4. **Save the file**

### Step 8: Verify .env.local in .gitignore

⚠️ **Security Step**: Ensure your secret keys are never committed to version control.

1. Open your `.gitignore` file in the root directory
2. Verify this line exists:

```
.env.local
```

If not already present, add it. This prevents accidentally committing your keys to GitHub.

---

## Part 4: Activate CAPTCHA

### Step 9: Restart Your Development Server

1. Stop your development server (press `Ctrl+C` in the terminal)
2. Start it again:
   ```bash
   npm run dev
   ```

This ensures the environment variables are loaded.

---

## Part 5: Testing

### Step 10: Test Locally

1. **Allow localhost in Cloudflare Turnstile**:
   - Go to your [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile)
   - Click on your widget
   - Go to **Settings**
   - Under **Hostname management**, ensure `localhost` is listed
   - If not, click **Add** and type `localhost`
   - Click **Save**

2. **Test the flow**:
   - Navigate to `http://localhost:3000/signup` (or your local URL)
   - You should see a Turnstile CAPTCHA widget appear
   - Complete the CAPTCHA (checkbox or challenge)
   - Fill out the form and submit
   - Check your browser console for any errors (Press `F12`)
   - Verify that signup succeeds

3. **Test login page**:
   - Navigate to `http://localhost:3000/login`
   - Verify the Turnstile CAPTCHA widget appears
   - Test the login flow

### Step 11: Test in Production

1. **Update Hostname in Cloudflare**:
   - In Cloudflare Dashboard > Turnstile > Your Widget > Settings
   - Add your production domain (e.g., `yourdomain.com`)
   - Click **Save**

2. **Deploy and test**:
   - Deploy your application to production
   - Test signup and login flows
   - Verify CAPTCHA appears and validates correctly

---

## Troubleshooting

### Common Issues and Solutions

**Issue**: "Invalid site key" error or CAPTCHA doesn't show
- **Solution**: 
  - Double-check that your `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in `.env.local` matches exactly what's shown in Cloudflare Dashboard
  - Restart your dev server after changing `.env.local`
  - Verify the domain is added in Cloudflare Turnstile's hostname management

**Issue**: CAPTCHA error in console
- **Solution**: 
  - For localhost: ensure `localhost` is in the allowed hostnames in Cloudflare
  - For production: ensure your domain (e.g., `yourdomain.com`) is in the allowed hostnames

**Issue**: "Token validation failed" when submitting form
- **Solution**: 
  - Ensure your **Secret Key** is correctly set in Supabase Dashboard (Settings > Authentication > Bot and Abuse Protection > CAPTCHA Secret)
  - Check that the secret key matches what's shown in Cloudflare (regenerate if needed)

**Issue**: CAPTCHA token expired
- **Solution**: 
  - Turnstile tokens expire after 5 minutes
  - The current implementation refreshes the token on form submission
  - If users take too long, they may need to complete CAPTCHA again

**Issue**: Can't find CAPTCHA settings in Supabase Dashboard
- **Solution**:
  - Make sure you're in Settings > Authentication (not just Settings)
  - Look for "Bot and Abuse Protection" section
  - If you don't see it, your Supabase plan may need to be upgraded

---

## Summary Checklist

✅ **Cloudflare Setup**:
- [ ] Created Cloudflare account at https://dash.cloudflare.com
- [ ] Navigated to Turnstile section
- [ ] Created new Turnstile widget
- [ ] Copied Sitekey and Secret Key
- [ ] Added `localhost` for development testing
- [ ] Added your production domain

✅ **Supabase Configuration**:
- [ ] Opened Supabase Dashboard > Your Project > Settings > Authentication
- [ ] Found "Bot and Abuse Protection" section
- [ ] Enabled "Enable CAPTCHA protection" toggle
- [ ] Selected "Turnstile" as the CAPTCHA provider
- [ ] Pasted Secret Key from Cloudflare
- [ ] Clicked Save and saw success message

✅ **Local Development**:
- [ ] Updated `.env.local` with `NEXT_PUBLIC_TURNSTILE_SITE_KEY=<your_sitekey>`
- [ ] Verified `.env.local` is in `.gitignore`
- [ ] Restarted development server
- [ ] Tested signup page — CAPTCHA widget appears
- [ ] Tested login page — CAPTCHA widget appears
- [ ] Successfully completed CAPTCHA and submitted forms

✅ **Production**:
- [ ] Updated Cloudflare Turnstile hostname settings with production domain
- [ ] Deployed application
- [ ] Tested signup and login in production environment
- [ ] Verified CAPTCHA protection is active

---

## Additional Resources

- **[Cloudflare Turnstile Official Docs](https://developers.cloudflare.com/turnstile/get-started/)**: Complete technical documentation
- **[Supabase CAPTCHA Guide](https://supabase.com/docs/guides/auth/auth-captcha)**: Official Supabase CAPTCHA configuration
- **[Turnstile Testing Guide](https://developers.cloudflare.com/turnstile/reference/testing/)**: How to test with dummy test keys

---

## Current Implementation Status

Your application is already configured to use Turnstile CAPTCHA on:
- ✅ **Login page** (`/app/login/page.tsx`): CAPTCHA widget integrated with form validation
- ✅ **Signup page** (`/app/signup/page.tsx`): CAPTCHA widget integrated with form validation
- ✅ **Environment template** (`.env.local.example`): Documented for reference
- ✅ **Dependencies**: `@marsidev/react-turnstile` already installed

**All you need to do**: Complete the steps above to get your Cloudflare and Supabase accounts configured, then add your Site Key to `.env.local`.

---

**🎉 Once you complete this guide, your authentication system will be protected against bot attacks and automated account creation attempts!**
