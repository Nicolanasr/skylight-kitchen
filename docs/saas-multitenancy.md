SaaS Multitenancy Skeleton (Supabase + Next.js)

Overview
- Adds Organizations, Venues, RBAC (org_members), tenant routing by subdomain, and a basic audit log.
- Provides a minimal sign-in page and an API endpoint to bootstrap a tenant for the current user.

1) Apply Database Schema
- Open Supabase SQL editor and run: `supabase/schema.sql` (copy/paste). This will:
  - Create `organizations`, `venues`, `org_members`, `audit_logs`, `role` enum.
  - Add `organization_id` to existing `menus`, `orders`, `notifications`.
  - Enable RLS and add member-scoped policies.
  - Provide helper `log_audit(org, action, entity, entity_id, details)`.

2) Backfill Existing Data
- Create your first org: `insert into organizations(slug, name) values ('demo', 'Demo Org');`
- Add yourself as member: `insert into org_members(organization_id, user_id, role) values ((select id from organizations where slug='demo'), '<your-auth.user.id>', 'owner');`
- Backfill org on existing rows:
  - `update menus set organization_id = (select id from organizations where slug = 'demo') where organization_id is null;`
  - `update orders set organization_id = (select id from organizations where slug = 'demo') where organization_id is null;`
  - `update notifications set organization_id = (select id from organizations where slug = 'demo') where organization_id is null;`

3) Local Dev Tenant Routing
- Subdomain routing: visit `demo.localhost:3000` to represent tenant `demo`.
- `src/middleware.ts` sets `x-tenant` header based on the host.
- `src/lib/tenant.ts` extracts tenant slug on the client. Configure default with `NEXT_PUBLIC_DEFAULT_TENANT`.

4) Auth
- Minimal page at `/sign-in` using Supabase email/password auth.
- Kitchen area is gated by `src/app/kitchen/layout.tsx` via `AuthGate`.

5) RBAC
- Database roles: `owner`, `manager`, `server`, `kitchen` via `public.role` enum.
- Memberships: `org_members` ties user to organization and role.
- Frontend helper: `src/lib/rbac.ts` with `can(role, permission)` for simple checks.

6) Tenant-Scoped Queries (Frontend)
- Use helpers in `src/lib/org-scope.ts`:
  - For selects/updates/deletes: `orgFilter(supabase.from('orders').select('*'), orgId)`
  - For inserts: `supabase.from('orders').insert([withOrg(payload, orgId)])`
- For a stricter model, enforce RLS policies and rely on `organization_id` attached to rows. Keep anon inserts if guests submit orders.

7) Bootstrap a Tenant via API (Optional)
- POST `/api/bootstrap-tenant` with JSON `{ orgSlug, orgName, venueName, venueSlug }` as an authenticated user.
- Returns `{ organization_id, venue_id }` and upserts your membership as `owner`.

Next Steps
- Gradually refactor queries in kitchen/table pages to filter by `organization_id`.
- Attach `organization_id` on inserts (orders, notifications) using `withOrg`.
- Add admin UI: manage org members, roles, venues, and branding per tenant.
- Add audit events to key actions (menu changes, order status changes).

