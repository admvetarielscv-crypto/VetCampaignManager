-- VetCampaignManager — demo seed
-- Creates a sample tenant with default categories and a default template.
-- Only runs if no tenants exist (idempotent, safe to re-run).

-- ── Helper: stable nanoid-style IDs for demo data ─────────────────────────────
-- In production these come from the client. For seeding we use fixed readable
-- IDs so the dev experience is predictable.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  demo_tenant_id bigint;
  cat_vacuna_id   text := 'cat_demo_vacuna';
  cat_antipul_id  text := 'cat_demo_antipulgas';
  cat_hidra_id    text := 'cat_demo_hidratacion';
  tpl_default_id  text := 'tpl_demo_default';
begin
  if exists (select 1 from public.tenants limit 1) then
    raise notice 'Demo seed skipped: tenants already exist.';
    return;
  end if;

  insert into public.tenants (slug, name, default_country_code)
    values ('clinica-demo', 'Clínica Demo', '+51')
    returning id into demo_tenant_id;

  insert into public.categories (id, tenant_id, name) values
    (cat_vacuna_id,  demo_tenant_id, 'Vacuna'),
    (cat_antipul_id, demo_tenant_id, 'Antipulgas'),
    (cat_hidra_id,   demo_tenant_id, 'Hidratación');

  insert into public.message_templates (id, tenant_id, category_id, name, body, is_default)
    values (
      tpl_default_id,
      demo_tenant_id,
      null,
      'Predeterminada',
      'Hola {{owner}} 👋' || chr(10) || chr(10) ||
      'Te escribimos de la clínica porque {{pet}} tiene pendiente {{category}}.' || chr(10) ||
      '¿Podrías agendar una cita esta semana? Quedamos atentos, gracias.',
      true
    );

  raise notice 'Demo seed created tenant id=%', demo_tenant_id;
end $$;