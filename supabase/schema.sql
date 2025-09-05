-- Multitenancy skeleton for Supabase (run in SQL editor)
-- Safe to run incrementally; uses IF NOT EXISTS where possible

-- 1) Organizations and Venues
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

-- 2) RBAC: organization membership
create type if not exists public.role as enum ('owner', 'manager', 'server', 'kitchen');

create table if not exists public.org_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.role not null default 'owner',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- 3) Audit log (basic)
create table if not exists public.audit_logs (
  id bigserial primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  entity text,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- 4) Add tenant columns to existing tables (menus, orders, notifications)
-- These statements are resilient if the columns already exist.
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'menus' and column_name = 'organization_id'
  ) then
    alter table public.menus add column organization_id uuid references public.organizations(id);
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'organization_id'
  ) then
    alter table public.orders add column organization_id uuid references public.organizations(id);
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'organization_id'
  ) then
    alter table public.notifications add column organization_id uuid references public.organizations(id);
  end if;
end $$;

-- 5) Helper function to resolve organization by subdomain slug
create or replace view public.organization_by_host as
  select o.* from public.organizations o; -- extend later to map to custom domains

-- Public helper to resolve organization id by slug (for anon table guests)
create or replace function public.get_org_id_by_slug(slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  select id into org_id from public.organizations where organizations.slug = get_org_id_by_slug.slug;
  return org_id;
end;$$;
grant execute on function public.get_org_id_by_slug(text) to anon, authenticated;

-- 6) RLS: Enable and add basic policies
alter table public.organizations enable row level security;
alter table public.venues enable row level security;
alter table public.org_members enable row level security;
alter table public.audit_logs enable row level security;

-- Existing tables (if present)
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='menus') then
    execute 'alter table public.menus enable row level security';
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='orders') then
    execute 'alter table public.orders enable row level security';
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='notifications') then
    execute 'alter table public.notifications enable row level security';
  end if;
end $$;

-- Policy helpers
create or replace function public.current_org_ids()
returns setof uuid language sql stable as $$
  select organization_id from public.org_members where user_id = auth.uid()
$$;

-- Organizations: members can read their org; owners/managers can update
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select using (
  exists (
    select 1 from public.org_members m
    where m.organization_id = organizations.id
      and m.user_id = auth.uid()
  )
);

drop policy if exists org_modify on public.organizations;
create policy org_modify on public.organizations for update using (
  exists (
    select 1 from public.org_members m
    where m.organization_id = organizations.id
      and m.user_id = auth.uid()
      and m.role in ('owner','manager')
  )
);

-- Venues: members can select within their org
drop policy if exists venues_select on public.venues;
create policy venues_select on public.venues for select using (
  exists (
    select 1 from public.org_members m
    where m.organization_id = venues.organization_id
      and m.user_id = auth.uid()
  )
);

-- Org members: a member can see memberships in their org
drop policy if exists org_members_select on public.org_members;
create policy org_members_select on public.org_members for select using (
  user_id = auth.uid()
);

-- Audit logs: members can read their org's logs; inserts allowed to any authenticated user when logging their org
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select using (
  exists (
    select 1 from public.org_members m
    where m.organization_id = audit_logs.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert with check (
  auth.uid() is not null and exists (
    select 1 from public.org_members m
    where m.organization_id = audit_logs.organization_id
      and m.user_id = auth.uid()
  )
);

-- Menus/Orders/Notifications: scope by organization_id; allow read/write for members
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='menus') then
    drop policy if exists menus_rw on public.menus;
    drop policy if exists menus_select on public.menus;
    drop policy if exists menus_write on public.menus;
    create policy menus_select on public.menus for select using (
      auth.role() = 'anon' or exists (
        select 1 from public.org_members m
        where m.organization_id = menus.organization_id
          and m.user_id = auth.uid()
      )
    );
    create policy menus_write on public.menus for all using (
      exists (
        select 1 from public.org_members m
        where m.organization_id = menus.organization_id
          and m.user_id = auth.uid()
      )
    ) with check (
      exists (
        select 1 from public.org_members m
        where m.organization_id = menus.organization_id
          and m.user_id = auth.uid()
      )
    );
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='orders') then
    drop policy if exists orders_rw on public.orders;
    drop policy if exists orders_select on public.orders;
    drop policy if exists orders_insert on public.orders;
    drop policy if exists orders_write on public.orders;
    create policy orders_select on public.orders for select using (
      auth.role() = 'anon' or exists (
        select 1 from public.org_members m
        where m.organization_id = orders.organization_id
          and m.user_id = auth.uid()
      )
    );
    create policy orders_insert on public.orders for insert with check (
      auth.role() = 'anon' or exists (
        select 1 from public.org_members m
        where m.organization_id = orders.organization_id
          and m.user_id = auth.uid()
      )
    );
    create policy orders_write on public.orders for update using (
      exists (
        select 1 from public.org_members m
        where m.organization_id = orders.organization_id
          and m.user_id = auth.uid()
      )
    ) with check (
      exists (
        select 1 from public.org_members m
        where m.organization_id = orders.organization_id
          and m.user_id = auth.uid()
      )
    );
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='notifications') then
    drop policy if exists notifications_rw on public.notifications;
    drop policy if exists notifications_select on public.notifications;
    drop policy if exists notifications_insert on public.notifications;
    drop policy if exists notifications_write on public.notifications;
    create policy notifications_select on public.notifications for select using (
      auth.role() = 'anon' or exists (
        select 1 from public.org_members m
        where m.organization_id = notifications.organization_id
          and m.user_id = auth.uid()
      )
    );
    create policy notifications_insert on public.notifications for insert with check (
      auth.role() = 'anon' or exists (
        select 1 from public.org_members m
        where m.organization_id = notifications.organization_id
          and m.user_id = auth.uid()
      )
    );
    create policy notifications_write on public.notifications for update using (
      exists (
        select 1 from public.org_members m
        where m.organization_id = notifications.organization_id
          and m.user_id = auth.uid()
      )
    ) with check (
      exists (
        select 1 from public.org_members m
        where m.organization_id = notifications.organization_id
          and m.user_id = auth.uid()
      )
    );
  end if;
end $$;

-- Venues: add write policy for org members
drop policy if exists venues_write on public.venues;
create policy venues_write on public.venues for all using (
  exists (
    select 1 from public.org_members m
    where m.organization_id = venues.organization_id
      and m.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.org_members m
    where m.organization_id = venues.organization_id
      and m.user_id = auth.uid()
  )
);

-- 7) Seed a demo organization (optional; remove in prod)
-- insert into public.organizations (slug, name) values ('demo', 'Demo Org') on conflict do nothing;

-- After creating an organization, backfill organization_id into existing rows as needed:
-- update public.menus set organization_id = (select id from public.organizations where slug = 'demo') where organization_id is null;
-- update public.orders set organization_id = (select id from public.organizations where slug = 'demo') where organization_id is null;
-- update public.notifications set organization_id = (select id from public.organizations where slug = 'demo') where organization_id is null;

-- 8) Simple audit helper function (optional)
create or replace function public.log_audit(_org uuid, _action text, _entity text, _entity_id text, _details jsonb)
returns void language plpgsql security definer as $$
begin
  insert into public.audit_logs(organization_id, user_id, action, entity, entity_id, details)
  values (_org, auth.uid(), _action, _entity, _entity_id, _details);
end;$$;
