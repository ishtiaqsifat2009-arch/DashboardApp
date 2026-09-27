# Studyspace

A local-first study dashboard built with React, TypeScript, and Vite. Tasks, notes, study plans, timer progress, and activity share one state store. Without cloud credentials, data stays in this browser. With Supabase configured, accounts sync that data across devices.

## Run locally

```sh
npm install
npm run dev
```

The app works without environment variables and saves data in browser storage. Production checks:

```sh
npm run lint
npm run build
```

## Enable accounts and cloud sync

1. Create a Supabase project.
2. In the Supabase SQL Editor, run `supabase/migrations/20260926000000_create_study_data.sql`. It creates the per-user data table, row-level security policies, and realtime publication entry.
3. In Supabase Authentication settings, enable email/password sign-in. Set the Site URL to your app origin and add `http://localhost:5173/**` plus your deployed origin to the redirect URL allowlist.
4. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` to the project's URL and `VITE_SUPABASE_ANON_KEY` to its public anon/publishable key.
5. Restart `npm run dev`, create an account, and confirm it from email if confirmation is enabled in Supabase.

The first account syncs this browser's local study data if it has not already created a cloud record. After that, the cloud record is authoritative for that account; other signed-in devices load it and receive realtime updates. Each account also has its own local cache.

Only the public anon/publishable key belongs in frontend environment variables. Never put a Supabase `service_role` key in this app or commit `.env.local`.

## Deploy to Vercel

1. Import the repository into Vercel and set the project root to `dashboard`.
2. Use the Vite defaults: build command `npm run build`, output directory `dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's environment variables for Preview and Production.
4. Deploy, then add the deployed origin to Supabase Authentication's Site URL and redirect URL allowlist.

The frontend uses Supabase Auth, the Supabase Postgres REST API, and Realtime directly; there is no separately hosted custom API server or service-role credential.
```
