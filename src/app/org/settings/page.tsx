"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useOrganization } from '@/components/useOrganization';

export default function OrgSettingsPage() {
  const { organizationId, slug, loading, error } = useOrganization();
  type Org = { id: string; name: string; slug: string; logo_url?: string | null; brand_name?: string | null; receipt_header?: string | null; receipt_footer?: string | null; tax_rate?: number | null; service_rate?: number | null };
  type Venue = { id: string; name: string; slug: string };
  type Member = { id: string; user_id: string; role: string };
  const [org, setOrg] = useState<Org | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueSlug, setNewVenueSlug] = useState('');
  const [savingVenue, setSavingVenue] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    async function load() {
      const { data: orgRow } = await supabase.from('organizations').select('id,name,slug,logo_url,brand_name,receipt_header,receipt_footer,tax_rate,service_rate').eq('id', organizationId).maybeSingle();
      setOrg((orgRow as Org | null) ?? null);
      const { data: v } = await supabase.from('venues').select('id,name,slug').eq('organization_id', organizationId).order('created_at', { ascending: true });
      setVenues((v as Venue[] | null) ?? []);
      const { data: m } = await supabase.from('org_members').select('id,user_id,role').eq('organization_id', organizationId);
      setMembers((m as Member[] | null) ?? []);
    }
    load();
  }, [organizationId]);

  const addVenue = async () => {
    if (!organizationId || !newVenueName || !newVenueSlug) return;
    setSavingVenue(true);
    const { error } = await supabase.from('venues').insert([{ organization_id: organizationId, name: newVenueName, slug: newVenueSlug }]);
    setSavingVenue(false);
    if (error) return alert(error.message);
    setNewVenueName('');
    setNewVenueSlug('');
    const { data: v } = await supabase.from('venues').select('id,name,slug').eq('organization_id', organizationId).order('created_at', { ascending: true });
    setVenues((v as Venue[] | null) ?? []);
  };

  if (loading) return <div className="p-4">Loading…</div>;
  if (error || !organizationId) return <div className="p-4">No organization found for subdomain “{slug}”.</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Organization Settings</h1>
      {org && (
        <div className="mb-6 p-4 border rounded bg-white">
          <div className="font-medium">{org.name}</div>
          <div className="text-sm text-gray-600">Slug: {org.slug}</div>
          <div className="text-sm text-gray-600">ID: {org.id}</div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Brand Name (for header/receipts)</label>
              <input className="w-full border rounded p-2" value={org.brand_name ?? ''} onChange={(e) => setOrg({ ...(org as Org), brand_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm mb-1">Logo URL</label>
              <input className="w-full border rounded p-2" placeholder="https://..." value={org.logo_url ?? ''} onChange={(e) => setOrg({ ...(org as Org), logo_url: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm mb-1">Receipt Header (optional)</label>
              <input className="w-full border rounded p-2" value={org.receipt_header ?? ''} onChange={(e) => setOrg({ ...(org as Org), receipt_header: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm mb-1">Receipt Footer (optional)</label>
              <input className="w-full border rounded p-2" value={org.receipt_footer ?? ''} onChange={(e) => setOrg({ ...(org as Org), receipt_footer: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm mb-1">Tax Rate (%)</label>
              <input type="number" className="w-full border rounded p-2" value={org.tax_rate ?? 0} onChange={(e) => setOrg({ ...(org as Org), tax_rate: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm mb-1">Service Rate (%)</label>
              <input type="number" className="w-full border rounded p-2" value={org.service_rate ?? 0} onChange={(e) => setOrg({ ...(org as Org), service_rate: Number(e.target.value) })} />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className="px-3 py-2 rounded text-white bg-green-600 hover:bg-green-700"
              onClick={async () => {
                if (!organizationId || !org) return;
                const { error: err } = await supabase
                  .from('organizations')
                  .update({
                    brand_name: org.brand_name ?? null,
                    logo_url: org.logo_url ?? null,
                    receipt_header: org.receipt_header ?? null,
                    receipt_footer: org.receipt_footer ?? null,
                    tax_rate: org.tax_rate ?? 0,
                    service_rate: org.service_rate ?? 0,
                  })
                  .eq('id', organizationId);
                if (err) alert(err.message); else alert('Saved branding settings');
              }}
            >
              Save Branding
            </button>
            {org.logo_url && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Preview:</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={org.logo_url} alt="Logo" className="h-8 object-contain" />
              </div>
            )}
          </div>
        </div>
      )}

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Venues</h2>
        <div className="space-y-2 mb-4">
          {venues.map(v => (
            <div key={v.id} className="p-3 border rounded bg-white flex items-center justify-between">
              <div>
                <div className="font-medium">{v.name}</div>
                <div className="text-sm text-gray-600">Slug: {v.slug}</div>
              </div>
            </div>
          ))}
          {venues.length === 0 && <div className="text-gray-600">No venues yet.</div>}
        </div>
        <div className="p-4 border rounded bg-white">
          <h3 className="font-medium mb-2">Add Venue</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input className="border rounded p-2" placeholder="Name" value={newVenueName} onChange={(e) => setNewVenueName(e.target.value)} />
            <input className="border rounded p-2" placeholder="Slug (e.g., main)" value={newVenueSlug} onChange={(e) => setNewVenueSlug(e.target.value)} />
            <button onClick={addVenue} disabled={savingVenue} className={`px-3 py-2 rounded text-white ${savingVenue ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}>Add</button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Members</h2>
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="p-3 border rounded bg-white flex items-center justify-between">
              <div>
                <div className="text-sm">User: {m.user_id}</div>
                <div className="text-sm text-gray-600">Role: {m.role}</div>
              </div>
            </div>
          ))}
          {members.length === 0 && <div className="text-gray-600">No members yet.</div>}
        </div>
      </section>
    </div>
  );
}
