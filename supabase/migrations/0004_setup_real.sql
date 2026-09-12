-- VetCampaignManager — 0004: setup real (NO es una migración del esquema)
--
-- Este script NO altera tablas. Crea los datos reales de tu clínica:
--   1. El tenant (la veterinaria)
--   2. Las 3 branches (sedes)
--   3. La membresía del owner (branch_id NULL = ve todas las sedes)
--   4. (Opcional) un set base de categorías + plantilla predeterminada
--      clonado a cada sede — las 3 nacen iguales y luego cada una
--      evoluciona por su lado.
--
-- CÓMO USARLO (en el SQL Editor de Supabase):
--   1. Edita la sección "EDITA AQUÍ" con tus valores reales.
--   2. Ejecuta UNA sola vez.
--   3. Para cada recepcionista, corre el bloque "Asignar recepcionista"
--      con su email y su sede (al final del archivo).
--
-- Requisito: los usuarios YA deben existir en Supabase Auth
-- (los invitaste desde Authentication → Users).

do $$
declare
  -- ── EDITA ESTOS VALORES ──────────────────────────────────────────────────
  v_tenant_name  text := 'ArielsClinic';          -- nombre visible
  v_tenant_slug  text := 'arielsclinic';          -- slug único, minúsculas
  v_country_code text := '+51';
  v_owner_email  text := 'vet_ariel@hotmail.com'; -- tu usuario (ve todas)
  v_branch_names text[] := ARRAY['San Martin', 'Los Olivos', 'San Miguel'];
  v_seed_base    boolean := true;                   -- clonar categorías base
  -- ────────────────────────────────────────────────────────────────────────

  v_tenant_id bigint;
  v_owner_id  uuid;
  v_branch_id bigint;
  b           record;
begin
  -- ── 1. Tenant ──
  insert into public.tenants (slug, name, default_country_code)
  values (v_tenant_slug, v_tenant_name, v_country_code)
  returning id into v_tenant_id;

  -- ── 2. Owner: debe existir en auth.users (lo invitaste desde el panel) ──
  select u.id into v_owner_id
  from auth.users u
  where lower(u.email) = lower(v_owner_email)
  limit 1;
  if v_owner_id is null then
    raise exception 'No existe el usuario % en auth.users. Invítalo primero desde Authentication.', v_owner_email;
  end if;

  insert into public.tenant_members (tenant_id, user_id, role, branch_id)
  values (v_tenant_id, v_owner_id, 'owner', null)
  on conflict (tenant_id, user_id) do nothing;

  -- ── 3. Branches ──
  for b in select unnest(v_branch_names) as name
  loop
    insert into public.branches (tenant_id, name)
    values (v_tenant_id, b.name)
    returning id into v_branch_id;

    -- ── 4. (Opcional) set base de categorías + plantilla por sede ──
    if v_seed_base then
      insert into public.categories (id, tenant_id, branch_id, name) values
        ('cat_' || v_tenant_slug || '_' || v_branch_id || '_vacuna',      v_tenant_id, v_branch_id, 'Vacuna'),
        ('cat_' || v_tenant_slug || '_' || v_branch_id || '_antipulgas',  v_tenant_id, v_branch_id, 'Antipulgas'),
        ('cat_' || v_tenant_slug || '_' || v_branch_id || '_hidratacion', v_tenant_id, v_branch_id, 'Hidratación');

      insert into public.message_templates (id, tenant_id, branch_id, category_id, name, body, is_default)
      values (
        'tpl_' || v_tenant_slug || '_' || v_branch_id || '_default',
        v_tenant_id, v_branch_id, null,
        'Predeterminada',
        'Hola {{owner}} 👋' || chr(10) || chr(10) ||
        'Te escribimos de ' || v_tenant_name || ' (' || b.name || ') porque {{pet}} tiene pendiente {{category}}.' || chr(10) ||
        '¿Podrías agendar una cita esta semana? Quedamos atentos.',
        true
      );
    end if;
  end loop;

  raise notice 'Tenant % (%) creado con % sede(s). Owner: %',
    v_tenant_name, v_tenant_slug, array_length(v_branch_names, 1), v_owner_email;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Asignar recepcionista (ejecuta UNA vez por usuario, editando los valores)
-- ─────────────────────────────────────────────────────────────────────────────

-- insert into public.tenant_members (tenant_id, user_id, role, branch_id)
-- select t.id, u.id, 'recepcionista', b.id
-- from public.tenants t
-- join public.branches  b on b.tenant_id = t.id and b.name = 'Sede Centro'   -- ← sede del usuario
-- join auth.users       u on lower(u.email) = lower('recepcionista1@tuveterinaria.com')   -- ← email del usuario
-- where t.slug = 'tu-veterinaria'                                           -- ← slug de arriba
-- on conflict (tenant_id, user_id) do update set branch_id = excluded.branch_id, role = excluded.role;
