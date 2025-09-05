"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentTenant } from '@/lib/tenant';

export function useOrganization() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const { slug } = getCurrentTenant();

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      setIsMember(null);
      // First try RLS-scoped select (works only if user is a member)
      const { data, error } = await supabase.from('organizations').select('id, slug').eq('slug', slug).maybeSingle();
      if (data?.id) {
        if (!cancelled) {
          setOrganizationId(data.id);
          setIsMember(true);
          setLoading(false);
        }
        return;
      }
      // If not found (or blocked by RLS), fall back to public RPC to resolve ID by slug
      const rpc = await supabase.rpc('get_org_id_by_slug', { slug });
      if (!cancelled) {
        if (rpc.error) {
          setError(rpc.error.message);
          setOrganizationId(null);
          setIsMember(false);
        } else {
          setOrganizationId(rpc.data ?? null);
          // If we needed RPC, the user likely isn't a member
          setIsMember(false);
        }
        setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [slug]);

  return { organizationId, loading, error, slug, isMember };
}
