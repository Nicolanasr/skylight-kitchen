"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrganization } from "@/components/useOrganization";
import { supabase } from "@/lib/supabase";
import { getCurrentTenant } from "@/lib/tenant";

type Tbl = { id: string; table_id: string; label?: string | null };

export default function OrgTablesPage() {
  const { organizationId, slug, loading, error } = useOrganization();
  const [tables, setTables] = useState<Tbl[]>([]);
  const [tableId, setTableId] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      const { data } = await supabase
        .from('tables')
        .select('id,table_id,label')
        .eq('organization_id', organizationId)
        .order('table_id', { ascending: true });
      setTables((data as Tbl[] | null) ?? []);
    })();
  }, [organizationId]);

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    return `${origin}/t/${slug}/table/`;
  }, [slug]);

  const addTable = async () => {
    if (!organizationId || !tableId) return;
    setSaving(true);
    const { error: err } = await supabase
      .from('tables')
      .insert([{ organization_id: organizationId, table_id: tableId, label: label || null }]);
    setSaving(false);
    if (err) return alert(err.message);
    setTableId("");
    setLabel("");
    const { data } = await supabase
      .from('tables')
      .select('id,table_id,label')
      .eq('organization_id', organizationId)
      .order('table_id', { ascending: true });
    setTables((data as Tbl[] | null) ?? []);
  };

  if (loading) return <div className="p-4">Loading…</div>;
  if (error || !organizationId) return <div className="p-4">No organization found for “{slug}”.</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Tables & QR Codes</h1>

      <div className="p-4 border rounded bg-white mb-6 grid grid-cols-1 md:grid-cols-3 gap-2">
        <input className="border rounded p-2" placeholder="Table ID (e.g., 12)" value={tableId} onChange={(e) => setTableId(e.target.value)} />
        <input className="border rounded p-2" placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button onClick={addTable} disabled={saving || !tableId} className={`px-3 py-2 rounded text-white ${saving || !tableId ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}>Add Table</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tables.map(t => (
          <div key={t.id} className="p-4 border rounded bg-white flex flex-col items-center gap-2">
            <div className="font-semibold">Table {t.table_id}</div>
            {t.label && <div className="text-sm text-gray-600">{t.label}</div>}
            {/* Preview QR */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`QR Table ${t.table_id}`}
              width={180}
              height={180}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(baseUrl + t.table_id)}`}
              className="rounded"
            />
            <div className="text-xs text-gray-500 break-all text-center">{`${baseUrl}${t.table_id}`}</div>
            <div className="flex gap-2 mt-2">
            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => {
              const html = `<!doctype html><html><head><meta charset='utf-8'><title>QR Table ${t.table_id}</title>
              <style>body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:16px;text-align:center}.qr{margin-top:12px}</style>
              </head><body>
                <div><div><strong>Table ${t.table_id}</strong></div><div>${t.label ?? ''}</div></div>
                <div class='qr'></div>
                <div style='margin-top:8px;font-size:12px;color:#555'>${baseUrl}${t.table_id}</div>
              </body></html>`;
              const w = window.open('', 'PRINT', 'height=700,width=520');
              if (!w) return;
              w.document.write(html);
              const mount = w.document.querySelector('.qr');
              if (mount) {
                const canvas = document.createElement('canvas');
                // Render QR via qrcode.react is not trivial in new window; fallback to image API
                const img = w.document.createElement('img');
                img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(baseUrl + t.table_id)}`;
                mount.appendChild(img);
              }
              w.document.close(); w.focus(); w.print(); w.close();
            }}>Print</button>
            <button className="px-3 py-1 bg-red-600 text-white rounded" onClick={async () => {
              if (!confirm(`Delete table ${t.table_id}?`)) return;
              const { error: err } = await supabase.from('tables').delete().eq('id', t.id);
              if (err) return alert(err.message);
              setTables(prev => prev.filter(x => x.id !== t.id));
            }}>Delete</button>
            </div>
          </div>
        ))}
        {tables.length === 0 && (
          <div className="text-gray-600">No tables yet. Add a few above.</div>
        )}
      </div>
    </div>
  );
}
