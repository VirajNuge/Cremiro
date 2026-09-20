# Appwrite deployment

This project now uses Appwrite for authentication, TablesDB, Storage, Functions, and the Next.js site. Existing Supabase users and data are intentionally not migrated.

## 1. Create the Appwrite project

Create a Cloud project and add a Web platform for the local and production site origins. Enable Google in Auth → Providers and configure the Google client ID/secret. The OAuth callback is:

```text
https://YOUR_SITE_HOST/auth/callback
```

Copy `.env.local.example` to `.env.local`, then set the project ID and a server API key with the TablesDB, Storage, Functions, and Users scopes. Do not commit `.env.local`.

## 2. Create the schema

Run this from the repository root after setting the Appwrite variables:

```powershell
npm run appwrite:setup
```

The script creates database `cremiro`, the four tables, and the private `media` bucket. JSON fields are stored as long text and converted at the API boundary. Configure the requested indexes in the Appwrite console for `user_id`, `username`, `email`, request status/creation time, job request/user/status, and idempotency key.

Set row security on all tables. The application grants each row read/update permission to its owner; the server API key is never sent to browser code.

## 3. Deploy Functions

Create two Functions from the GitHub repository `VirajNuge/YT_to_Content`, branch `main`:

| Function | Root directory | Entrypoint | Schedule |
| --- | --- | --- | --- |
| `content-worker` | `appwrite/functions/content-worker` | `index.py` | — |
| `maintenance` | `appwrite/functions/maintenance` | `index.py` | `*/5 * * * *` |

Set the Appwrite variables from `.env.local.example` in both functions, including `NEXT_PUBLIC_SITE_URL` for `maintenance`. The worker uses CPU, Whisper `base`, `int8`, and `libx264` through `worker/core`; keep output files below 50 MB. It processes one request’s job items and persists status/output rows so a later execution can resume.

For a production deployment, include the repository root in the worker build context or copy `worker/core` into the function deployment. The function imports `worker.core.pipeline` deliberately so the existing processing code remains reusable.

## 4. Deploy the Next.js Site

Create an Appwrite Site connected to the same repository and branch:

```text
Framework: Next.js
Rendering: SSR
Install command: npm install
Build command: npm run build
Output directory: ./.next
```

Add the Appwrite and external-service variables from `.env.local.example` to the Site. The server-only `APPWRITE_API_KEY` must be a Site variable, not a `NEXT_PUBLIC_*` variable. Remove old Supabase and Modal variables.

After the Site is live, update `NEXT_PUBLIC_SITE_URL` to its final HTTPS origin and add that origin to Appwrite Web platforms and OAuth redirect settings.

## 5. Local verification

```powershell
npm install
npm run build
npm run dev
```

Verify signup/profile creation, login/logout, Google OAuth, password recovery, a protected dashboard request, private `/api/media/{fileId}` access, duplicate idempotency keys, and the five-minute maintenance execution. No Supabase or Modal credentials are required by the application.
