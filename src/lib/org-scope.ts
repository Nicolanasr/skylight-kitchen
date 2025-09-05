import { supabase } from '@/lib/supabase';

// Attach organization_id to insert payloads
export function withOrg<T extends Record<string, unknown>>(payload: T, organizationId: string): T & { organization_id: string } {
  return { ...payload, organization_id: organizationId } as T & { organization_id: string };
}

// Chain an org filter onto a query (select/update/delete)
export function orgFilter<Q extends { eq: (column: string, value: string) => Q }>(query: Q, organizationId: string): Q {
  return query.eq('organization_id', organizationId);
}

export { supabase };
