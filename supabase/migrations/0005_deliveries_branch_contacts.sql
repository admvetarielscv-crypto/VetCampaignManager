-- VetCampaignManager — 0005: delivery reports + branch-scoped contacts
--
-- Two changes:
--
-- 1. Contacts become BRANCH-scoped. Business decision: each sede has its own
--    client base (geographically separated), so the re-contact guard and
--    "do not contact" flags are per sede, not clinic-wide. The contacts table
--    is empty in every known install — recreating it is cleaner than evolving
--    constraints (and honest: no data is lost).
--
-- 2. campaign_deliveries: one row per ATTEMPTED message. Written by the app
--    at dispatch time with status 'queued'; n8n reports back per recipient
--    with 'delivered' | 'failed' (service role only — users never update).
--    Excluded/invalid/duplicate recipients have NO delivery row: they were
--    never attempted, and their counts live on the campaigns record.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Contacts (recreate, branch-scoped)
-- ─────────────────────────────────────────────────────────────────────────────

drop table if exists public.contacts cascade;

create table public.contacts (
  id text primary key,                                  -- nanoid, client-side
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  branch_id bigint not null references public.branches(id) on delete cascade,
  phone text not null,                                  -- E.164-like, e.g. +51...
  owner_name text not null default '',
  pet_name text not null default '',
  do_not_contact boolean not null default false,
  opt_out_at timestamptz null,
  last_contacted_at timestamptz null,                   -- last campaign received (this branch)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, branch_id, phone)
);

-- The guard query filters by branch + a list of phones: dedicated index.
create index contacts_branch_phone_idx on public.contacts(branch_id, phone);

alter table public.contacts enable row level security;

-- Branch-scoped access: a receptionist sees only their sede's client base;
-- owner/admin (branch_id NULL membership) sees every branch of the tenant.
create policy "members can read their branch's contacts"
  on public.contacts for select
  to authenticated
  using (branch_id in (select public.current_user_branch_ids()));

create policy "members can manage their branch's contacts"
  on public.contacts for all
  to authenticated
  using (branch_id in (select public.current_user_branch_ids()))
  with check (branch_id in (select public.current_user_branch_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Campaign deliveries (one row per attempted message)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.campaign_deliveries (
  campaign_id text not null references public.campaigns(id) on delete cascade,
  recipient_id text not null,                           -- the payload per-recipient id
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  branch_id bigint not null references public.branches(id) on delete cascade,
  phone text not null,
  status text not null check (status in
    ('queued', 'delivered', 'failed')),
  error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, recipient_id)
);

-- Dashboard query: per-campaign status counts.
create index campaign_deliveries_campaign_status_idx
  on public.campaign_deliveries(campaign_id, status);

-- Contact history lookups by phone (join point for replies, S3).
create index campaign_deliveries_phone_idx
  on public.campaign_deliveries(phone, created_at desc);

alter table public.campaign_deliveries enable row level security;

-- Read: tenant-wide (the consolidated dashboard is tenant-level).
create policy "members can read their tenant's deliveries"
  on public.campaign_deliveries for select
  to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()));

-- Insert: only the branch running the campaign.
create policy "members can insert their branch's deliveries"
  on public.campaign_deliveries for insert
  to authenticated
  with check (branch_id in (select public.current_user_branch_ids()));

-- NO update/delete policy for authenticated users on purpose: only the
-- backend (n8n with the secret key, which bypasses RLS) reports delivery
-- results. A compromised browser session can never fake delivery statuses.

create trigger campaign_deliveries_updated_at
  before update on public.campaign_deliveries
  for each row execute function public.touch_updated_at();
