-- VetCampaignManager — initial schema
-- Multi-tenant SaaS for veterinary clinics. Every business table has
-- tenant_id + RLS so a clinic can only see its own data.

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────

create type tenant_role as enum ('owner', 'admin', 'recepcionista');

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers (security definer, run with table owner privileges to avoid RLS
-- recursion when looking up the current user's tenant memberships)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.current_user_tenant_ids()
returns setof bigint
language sql
stable
security definer
set search_path = ''
as $$
  select tenant_id from public.tenant_members
  where user_id = (select auth.uid())
$$;

create or replace function public.current_user_role(target_tenant_id bigint)
returns tenant_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.tenant_members
  where tenant_id = target_tenant_id
    and user_id = (select auth.uid())
  limit 1
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tenants (one row per veterinary clinic)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.tenants (
  id bigint primary key generated always as identity,
  slug text not null unique,
  name text not null,
  default_country_code text not null default '+51',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Tenant members (link auth.users to tenants with a role)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.tenant_members (
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role tenant_role not null default 'recepcionista',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index tenant_members_user_id_idx on public.tenant_members(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Categories (per tenant)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.categories (
  id text primary key,                                  -- nanoid generated client-side
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index categories_tenant_id_idx on public.categories(tenant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Message templates (per tenant)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.message_templates (
  id text primary key,                                  -- nanoid
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  category_id text null references public.categories(id) on delete set null,
  name text not null,
  body text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index message_templates_tenant_id_idx on public.message_templates(tenant_id);

-- Enforce: at most one default template per tenant
create unique index message_templates_one_default_per_tenant
  on public.message_templates(tenant_id)
  where is_default = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- Clinic settings (server-side secrets: webhook URL, HMAC key)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.clinic_settings (
  tenant_id bigint primary key references public.tenants(id) on delete cascade,
  webhook_url text not null default '',
  hmac_secret text not null default '',                 -- used to sign payloads
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Campaigns (historical record of each send)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.campaigns (
  id text primary key,                                  -- nanoid
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  sent_by uuid not null references auth.users(id),
  total_recipients int not null,
  enabled_recipients int not null,
  invalid_recipients int not null,
  duplicate_recipients int not null,
  payload jsonb not null,                               -- the exact payload sent
  status text not null check (status in ('sent', 'failed')),
  error_message text null,
  created_at timestamptz not null default now()
);

create index campaigns_tenant_id_idx on public.campaigns(tenant_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Audit log (generic action log for compliance / debugging)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.audit_log (
  id bigint primary key generated always as identity,
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  action text not null,                                 -- 'settings.update', 'campaign.send', ...
  entity_type text null,                                -- 'campaign', 'template', etc.
  entity_id text null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index audit_log_tenant_id_idx on public.audit_log(tenant_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper macro: enable RLS + force all access to use policies
alter table public.tenants              enable row level security;
alter table public.tenant_members       enable row level security;
alter table public.categories          enable row level security;
alter table public.message_templates   enable row level security;
alter table public.clinic_settings     enable row level security;
alter table public.campaigns           enable row level security;
alter table public.audit_log           enable row level security;

-- ── tenants ───────────────────────────────────────────────────────────────────
-- Read: only members of the tenant
create policy "tenant members can read their tenant"
  on public.tenants for select
  to authenticated
  using (id in (select public.current_user_tenant_ids()));

-- Update: only owners
create policy "owners can update their tenant"
  on public.tenants for update
  to authenticated
  using (public.current_user_role(id) = 'owner')
  with check (public.current_user_role(id) = 'owner');

-- Insert: anyone authenticated can create a tenant (they become the owner via
-- a trigger below). This is how new clinics sign up.
create policy "authenticated users can create tenants"
  on public.tenants for insert
  to authenticated
  with check (true);

-- Delete: only owners
create policy "owners can delete their tenant"
  on public.tenants for delete
  to authenticated
  using (public.current_user_role(id) = 'owner');

-- ── tenant_members ────────────────────────────────────────────────────────────
create policy "members can read their tenant's member list"
  on public.tenant_members for select
  to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()));

create policy "owners and admins can manage members"
  on public.tenant_members for all
  to authenticated
  using (public.current_user_role(tenant_id) in ('owner', 'admin'))
  with check (public.current_user_role(tenant_id) in ('owner', 'admin'));

-- ── categories ───────────────────────────────────────────────────────────────
create policy "members can read their tenant's categories"
  on public.categories for select
  to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()));

create policy "members can manage categories"
  on public.categories for all
  to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));

-- ── message_templates ────────────────────────────────────────────────────────
create policy "members can read their tenant's templates"
  on public.message_templates for select
  to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()));

create policy "members can manage templates"
  on public.message_templates for all
  to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));

-- ── clinic_settings ──────────────────────────────────────────────────────────
-- Only owners and admins can read the webhook URL (secret).
create policy "owners and admins can read clinic settings"
  on public.clinic_settings for select
  to authenticated
  using (public.current_user_role(tenant_id) in ('owner', 'admin'));

create policy "owners and admins can manage clinic settings"
  on public.clinic_settings for all
  to authenticated
  using (public.current_user_role(tenant_id) in ('owner', 'admin'))
  with check (public.current_user_role(tenant_id) in ('owner', 'admin'));

-- ── campaigns ────────────────────────────────────────────────────────────────
create policy "members can read their tenant's campaigns"
  on public.campaigns for select
  to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()));

create policy "members can insert campaigns for their tenant"
  on public.campaigns for insert
  to authenticated
  with check (
    tenant_id in (select public.current_user_tenant_ids())
    and sent_by = (select auth.uid())
  );

-- ── audit_log ────────────────────────────────────────────────────────────────
create policy "owners and admins can read audit log"
  on public.audit_log for select
  to authenticated
  using (public.current_user_role(tenant_id) in ('owner', 'admin'));

create policy "members can insert audit log entries for their tenant"
  on public.audit_log for insert
  to authenticated
  with check (tenant_id in (select public.current_user_tenant_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: when a new tenant is created, the creator becomes its owner and
-- a clinic_settings row is created with an empty webhook URL.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tenant_members (tenant_id, user_id, role)
    values (new.id, auth.uid(), 'owner');

  insert into public.clinic_settings (tenant_id)
    values (new.id);

  return new;
end;
$$;

create trigger on_tenant_created
  after insert on public.tenants
  for each row execute function public.handle_new_tenant();

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: updated_at maintenance
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_updated_at
  before update on public.tenants
  for each row execute function public.touch_updated_at();

create trigger message_templates_updated_at
  before update on public.message_templates
  for each row execute function public.touch_updated_at();

create trigger clinic_settings_updated_at
  before update on public.clinic_settings
  for each row execute function public.touch_updated_at();