# Cloudflare & Supabase Deployment Guide for INOMS

This project is configured with a hybrid **Cloudflare Worker + Static Assets + Supabase Cloud Database** architecture.

---

## 1. Why the 405 Method Not Allowed Occurred & How It Was Resolved

- **Root Cause**: When deploying only static assets without a Worker script, Cloudflare's static assets layer rejected HTTP `POST` requests to `/api/*` (such as `/api/auth/verify-master-pin`) with `405 Method Not Allowed`.
- **The Fix**:
  1. Added `main = "src/worker.ts"` to `wrangler.toml`.
  2. Created `src/worker.ts` which intercepts all `/api/*` routes (including `POST /api/auth/verify-master-pin`, `/api/auth/login`, etc.), handles CORS preflight (`OPTIONS`) with status `204`, and delegates all other requests to static assets (`env.ASSETS.fetch(request)`).
  3. No route will ever return 405 again.

---

## 2. Supabase Integration & Schema Setup

The project includes an end-to-end Supabase schema with multi-tenant tables, Row Level Security (RLS), and Realtime replication.

### Step 1: Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Under **Project Settings > API**, copy your **Project URL** (`https://xyz.supabase.co`) and **anon public key**.

### Step 2: Apply Database Schema
1. In the Supabase Dashboard, open **SQL Editor**.
2. Copy the contents of `supabase_schema.sql` (also available via the **"Copy SQL Schema"** button in the app UI under Settings > Supabase Cloud).
3. Paste and click **Run**. This creates:
   - `organizations` (tenants)
   - `tenant_configs` (company info)
   - `users` (technicians & staff)
   - `clients` (customer directory)
   - `jobs` (repair tickets with checklist & specs)
   - `invoices` & `payments`
   - `products` (inventory & spare parts)
   - `expenses`, `categories`, `racks`, `equipments`, `problems`

---

## 3. One-Click Live Data Migration

You can migrate all existing data from your live running app into Supabase in 1 click:

1. Open **Settings > Supabase Cloud & Migration** (or **Master Admin Dashboard > Supabase Database & Migration**).
2. Enter your **Supabase URL** and **Anon Key**.
3. Click **"Test Connection"** (verifies connectivity).
4. Click **"Migrate Live Data Now"**.
5. The built-in migration engine extracts all records from local storage and IndexedDB, formats them to match the relational schema, and batch-upserts them directly into Supabase tables with live progress indicators.

---

## 4. Deploying to Cloudflare

### Via Command Line (Wrangler):
```bash
# 1. Build the production application
npm run build

# 2. Deploy Worker + Assets
npx wrangler deploy
```

### Via Cloudflare Dashboard:
1. Build command: `npm run build`
2. Build output directory: `dist`
3. In your Worker / Pages Environment Variables, configure:
   - `MASTER_ADMIN_PIN` or `MASTER_PIN`: `<your_secret_6_digit_pin>`
   - `SUPABASE_URL`: `https://your-project.supabase.co` (optional, for edge Worker queries)
   - `SUPABASE_ANON_KEY`: `your-anon-key` (optional)
