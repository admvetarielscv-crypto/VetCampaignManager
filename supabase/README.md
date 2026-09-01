# Supabase setup

## 1. Create a project

1. Go to https://supabase.com/dashboard and create a new project
2. Copy the **Project URL** and **anon public key** from Settings → API

## 2. Configure environment

Copy `.env.example` to `.env` and fill in:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

The app boots in **localStorage mode** if these vars are empty, and switches
to **Supabase mode** automatically when both are set (`HAS_SUPABASE` flag).

## 3. Apply migrations

Open the Supabase SQL Editor and run each migration file in `migrations/` in
order:

1. `0001_init_schema.sql` — tables, enums, RLS policies, triggers
2. `0002_seed_demo.sql` — optional: a demo tenant with sample categories

Alternatively, install the [Supabase CLI](https://supabase.com/docs/guides/cli)
and run `supabase db push` against a linked project.

## 4. Enable auth providers

Settings → Authentication → Providers:

- Enable **Email** (magic link by default — no passwords to manage)
- Optional: enable **Google** / **Apple** for one-click login

## 5. Multi-tenancy model

- Every table has `tenant_id` and RLS policies
- `public.current_user_tenant_ids()` returns tenants the current user belongs to
- `public.current_user_role(tenant_id)` returns the user's role in a tenant
- Users can create new tenants (they automatically become `owner` via trigger)
- Tenant owners can invite other users via email (via Supabase's built-in auth)

## Roles

| Role | Can |
|---|---|
| `owner` | Everything: settings, members, billing, delete tenant |
| `admin` | Manage members, settings, campaigns; cannot delete tenant |
| `recepcionista` | Send campaigns, manage categories/templates |