"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useOrganization } from '@/components/useOrganization';

export default function OrgSettingsPage() {
  const { organizationId, slug, loading, error } = useOrganization();
  type Org = { id: string; name: string; slug: string };
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
      const { data: orgRow } = await supabase.from('organizations').select('id,name,slug').eq('id', organizationId).maybeSingle();
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
