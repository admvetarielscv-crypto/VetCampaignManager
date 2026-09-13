-- VetCampaignManager — 0003: multi-sede (branches)
--
-- 1 tenant = 1 veterinary business. 1 branch = 1 sede (physical location).
-- Operational CONFIG (categories, templates, webhook) is branch-scoped: each
-- sede manages its own. Business DATA (contacts, campaigns, audit log) is
-- tenant-scoped so the anti-spam guard and the consolidated dashboard work
-- across all sedes.
--
-- Run AFTER 0001_init_schema.sql. Assumes a FRESH database (no rows):
-- columns are added NOT NULL, which would fail over existing demo data.
-- Run order: 0001 → 0003. (0002_seed_demo.sql is intentionally skipped.)
--
-- Membership rule: tenant_members.branch_id
--   NULL   → owner/admin: may access EVERY branch of their tenant
--   set    → member is bound to that single branch

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Branches (one row per sede)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.branches (
  id bigint primary key generated always as identity,
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  name text not null,
  -- n8n webhook + HMAC secret live per branch: each sede has its own
  -- n8n/Evolution stack (see docs/GUIA-SEDES.md). Never exposed cross-branch.
  webhook_url text not null default '',
  hmac_secret text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index branches_tenant_id_idx on public.branches(tenant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Membership branch binding (NULL = sees all branches of the tenant)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.tenant_members
  add column branch_id bigint null references public.branches(id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Branch-scoped config: categories
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.categories
  add column branch_id bigint not null references public.branches(id) on delete cascade;

-- Replace tenant-only uniqueness with tenant+branch uniqueness: two sedes may
-- both have a category named "Vacuna" as independent rows.
alter table public.categories
  drop constraint categories_tenant_id_name_key;
alter table public.categories
  add constraint categories_tenant_branch_name_key unique (tenant_id, branch_id, name);

create index categories_branch_id_idx on public.categories(branch_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Branch-scoped config: message templates
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.message_templates
  add column branch_id bigint not null references public.branches(id) on delete cascade;

-- One default template per BRANCH (was per tenant).
drop index public.message_templates_one_default_per_tenant;
create unique index message_templates_one_default_per_branch
  on public.message_templates(tenant_id, branch_id)
  where is_default = true;

create index message_templates_branch_id_idx on public.message_templates(branch_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Campaigns: attribution + new counters from Fase A
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.campaigns
  add column branch_id bigint not null references public.branches(id) on delete cascade,
  add column excluded_recipients int not null default 0,
  add column mock boolean not null default false,
  add column source_file text null;

-- Dashboard per-sede queries filter tenant+branch and sort by date.
create index campaigns_tenant_branch_idx
  on public.campaigns(tenant_id, branch_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Contacts (tenant-scoped, shared across sedes)
--    Anti-spam is a business-wide concern: a client who says STOP is done for
--    every sede. Branch attribution of a contact happens via campaigns.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.contacts (
  id text primary key,                                  -- nanoid, client-side
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  phone text not null,                                  -- E.164-like, e.g. +51...
  owner_name text not null default '',
  pet_name text not null default '',
  do_not_contact boolean not null default false,
  opt_out_at timestamptz null,                          -- when the client opted out
  last_contacted_at timestamptz null,                   -- last campaign received
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, phone)
);

-- The unique (tenant_id, phone) index already serves tenant-scoped lookups
-- (leading column = tenant_id): no extra tenant index needed.

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS helpers (security definer — same pattern as 0001)
-- ─────────────────────────────────────────────────────────────────────────────

-- Branch ids the current user may access:
--   owner/admin (branch_id NULL) → every branch of their tenants
--   branch-bound member          → only their own branch
-- Set-returning via UNION: a CASE branch cannot host a multi-row subquery
-- (PostgreSQL error 21000 "more than one row returned by a subquery used as
-- an expression").
create or replace function public.current_user_branch_ids()
returns setof bigint
language sql
stable
security definer
set search_path = ''
as $$
  -- Owner/admin: every branch of the tenants where the user has a
  -- "sees-all" membership (branch_id NULL).
  select b.id
  from public.branches b
  where exists (
    select 1 from public.tenant_members m
    where m.user_id = (select auth.uid())
      and m.branch_id is null
      and m.tenant_id = b.tenant_id
  )
  union
  -- Branch-bound member: exactly their assigned branch.
  select m.branch_id
  from public.tenant_members m
  where m.user_id = (select auth.uid())
    and m.branch_id is not null
$$;

-- Name of one branch the user may access (branch context for the UI).
create or replace function public.current_user_branch_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select b.name from public.branches b
  where b.id = (select m.branch_id from public.tenant_members m
                where m.user_id = (select auth.uid()) and m.branch_id is not null
                limit 1);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RLS policies
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.branches           enable row level security;
alter table public.contacts           enable row level security;

-- ── branches ─────────────────────────────────────────────────────────────────
create policy "members can read their tenant's branches"
  on public.branches for select
  to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()));

create policy "owners and admins can manage branches"
  on public.branches for all
  to authenticated
  using (public.current_user_role(tenant_id) in ('owner', 'admin'))
  with check (public.current_user_role(tenant_id) in ('owner', 'admin'));

-- ── categories (replace tenant-only policies with branch-scoped ones) ───────
drop policy if exists "members can read their tenant's categories"
  on public.categories;
create policy "members can read their branch's categories"
  on public.categories for select
  to authenticated
  using (branch_id in (select public.current_user_branch_ids()));

drop policy if exists "members can manage categories"
  on public.categories;
create policy "members can manage their branch's categories"
  on public.categories for all
  to authenticated
  using (branch_id in (select public.current_user_branch_ids()))
  with check (branch_id in (select public.current_user_branch_ids()));

-- ── message_templates ────────────────────────────────────────────────────────
drop policy if exists "members can read their tenant's templates"
  on public.message_templates;
create policy "members can read their branch's templates"
  on public.message_templates for select
  to authenticated
  using (branch_id in (select public.current_user_branch_ids()));

drop policy if exists "members can manage templates"
  on public.message_templates;
create policy "members can manage their branch's templates"
  on public.message_templates for all
  to authenticated
  using (branch_id in (select public.current_user_branch_ids()))
  with check (branch_id in (select public.current_user_branch_ids()));

-- ── contacts (tenant-wide: any member reads/writes contacts of their tenant) ─
create policy "members can read their tenant's contacts"
  on public.contacts for select
  to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()));

create policy "members can manage their tenant's contacts"
  on public.contacts for all
  to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));

-- campaigns: existing tenant-wide policies from 0001 already cover select and
-- insert (branch attribution is data, not a security boundary — the
-- consolidated dashboard is tenant-level by design).

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. updated_at triggers (same pattern as 0001)
-- ─────────────────────────────────────────────────────────────────────────────

create trigger branches_updated_at
  before update on public.branches
  for each row execute function public.touch_updated_at();

create trigger contacts_updated_at
  before update on public.contacts
  for each row execute function public.touch_updated_at();
