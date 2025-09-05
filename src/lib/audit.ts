import { supabase } from "@/lib/supabase";

export type AuditPayload = {
  organization_id: string;
  action: string;
  entity?: string;
  entity_id?: string;
  details?: Record<string, unknown>;
};

export async function logAudit(input: AuditPayload) {
  // Best effort; ignore failures in UI paths
  try {
    await supabase.from('audit_logs').insert([{
      organization_id: input.organization_id,
      action: input.action,
      entity: input.entity ?? null,
      entity_id: input.entity_id ?? null,
      details: input.details ?? null,
    }]);
  } catch (_e) {
    // no-op
  }
}

