"use client";

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useOrganization } from '@/components/useOrganization';
import type { MenuItem, MenuOptionGroup } from '@/types';

export default function OrgMenuPage() {
  const { organizationId, slug, loading, error } = useOrganization();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<MenuItem>>({ name: '', price: 0, category: '', description: '', image_url: '', is_available: true });
  const [optionsEditorFor, setOptionsEditorFor] = useState<number | null>(null);
  const [optionsJson, setOptionsJson] = useState<string>('');

  const loadMenu = async () => {
    if (!organizationId) return;
    const { data } = await supabase.from('menus').select('*').eq('organization_id', organizationId).order('category', { ascending: true }).order('name', { ascending: true });
    setMenu((data as MenuItem[] | null) ?? []);
  };

  useEffect(() => { loadMenu(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [organizationId]);

  const saveItem = async () => {
    if (!organizationId || !form.name || form.price == null) return;
    setSaving(true);
    const payload = {
      organization_id: organizationId,
      name: form.name,
      price: Number(form.price) || 0,
      category: form.category || 'General',
      description: form.description || null,
      image_url: form.image_url || null,
      is_available: form.is_available ?? true,
    };
    const { error: err } = await supabase.from('menus').insert([payload]);
    setSaving(false);
    if (err) return alert(err.message);
    setForm({ name: '', price: 0, category: '', description: '', image_url: '' });
    await loadMenu();
  };

  const updateItem = async (it: MenuItem) => {
    const { error: err } = await supabase.from('menus').update({
      name: it.name,
      price: it.price,
      category: it.category,
      description: it.description ?? null,
      image_url: it.image_url ?? null,
      is_available: it.is_available ?? true,
      options: it.options ?? null,
    }).eq('id', it.id);
    if (err) alert(err.message);
  };

  const deleteItem = async (id: number) => {
    if (!confirm('Delete this item?')) return;
    const { error: err } = await supabase.from('menus').delete().eq('id', id);
    if (err) alert(err.message); else setMenu(menu.filter(m => m.id !== id));
  };

  if (loading) return <div className="p-4">Loading…</div>;
  if (error || !organizationId) return <div className="p-4">No organization found for “{slug}”.</div>;

  const lowered = search.trim().toLowerCase();
  const filtered = lowered
    ? menu.filter(m => (m.name.toLowerCase().includes(lowered) || (m.category || '').toLowerCase().includes(lowered)))
    : menu;
  const categories = Array.from(new Set(filtered.map(m => m.category))).sort();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Menu Management</h1>
      <div className="p-4 border rounded bg-white mb-6">
        <div className="mb-3">
          <input
            className="w-full md:w-80 border rounded p-2 h-10 text-sm"
            placeholder="Search items or categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <label className="text-xs text-gray-600 md:col-span-3">
            <div className="mb-1">Name</div>
            <input className="w-full border rounded p-2 h-10 text-sm" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="text-xs text-gray-600 md:col-span-2">
            <div className="mb-1">Price</div>
            <input type="number" className="w-full border rounded p-2 h-10 text-sm" value={form.price ?? 0} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-gray-600 md:col-span-3">
            <div className="mb-1">Category</div>
            <input className="w-full border rounded p-2 h-10 text-sm" value={form.category ?? ''} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </label>
          <label className="text-xs text-gray-600 md:col-span-3">
            <div className="mb-1">Image URL</div>
            <input className="w-full border rounded p-2 h-10 text-sm" value={form.image_url ?? ''} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-1">
            <input type="checkbox" className="h-4 w-4" checked={!!form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} />
            Available
          </label>
          <button onClick={saveItem} disabled={saving || !form.name} className={`md:col-span-12 h-10 px-4 rounded text-white ${saving || !form.name ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}>Add Item</button>
          <label className="text-xs text-gray-600 md:col-span-12">
            <div className="mb-1">Description (optional)</div>
            <textarea className="w-full border rounded p-2 text-sm" value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
        </div>
      </div>

      {categories.map(cat => (
        <div key={cat} className="mb-5">
          <h2 className="text-xl font-semibold mb-2">{cat}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.filter(m => m.category === cat).map(it => (
              <div key={it.id} className="p-3 border rounded bg-white flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <label className="text-xs text-gray-600 md:col-span-3">
                    <div className="mb-1">Name</div>
                    <input className="w-full border rounded p-2 h-10 text-sm" value={it.name} onChange={(e) => setMenu(prev => prev.map(p => p.id === it.id ? { ...p, name: e.target.value } : p))} />
                  </label>
                  <label className="text-xs text-gray-600 md:col-span-2">
                    <div className="mb-1">Price</div>
                    <input type="number" className="w-full border rounded p-2 h-10 text-sm" value={it.price} onChange={(e) => setMenu(prev => prev.map(p => p.id === it.id ? { ...p, price: Number(e.target.value) } : p))} />
                  </label>
                  <label className="text-xs text-gray-600 md:col-span-3">
                    <div className="mb-1">Category</div>
                    <input className="w-full border rounded p-2 h-10 text-sm" value={it.category} onChange={(e) => setMenu(prev => prev.map(p => p.id === it.id ? { ...p, category: e.target.value } : p))} />
                  </label>
                  <label className="text-xs text-gray-600 md:col-span-3">
                    <div className="mb-1">Image URL</div>
                    <input className="w-full border rounded p-2 h-10 text-sm" value={it.image_url ?? ''} onChange={(e) => setMenu(prev => prev.map(p => p.id === it.id ? { ...p, image_url: e.target.value } : p))} />
                  </label>
                  <label className="flex items-center gap-2 text-sm md:col-span-1">
                    <input type="checkbox" className="h-4 w-4" checked={it.is_available ?? true} onChange={(e) => setMenu(prev => prev.map(p => p.id === it.id ? { ...p, is_available: e.target.checked } : p))} />
                    Available
                  </label>
                  <div className="flex gap-2 justify-end md:col-span-12">
                    <button className="h-10 px-3 bg-purple-600 text-white rounded" onClick={() => { setOptionsEditorFor(it.id); setOptionsJson(JSON.stringify(it.options ?? [], null, 2)); }}>Options</button>
                    <button className="h-10 px-3 bg-green-600 text-white rounded" onClick={() => updateItem(it)}>Save</button>
                    <button className="h-10 px-3 bg-red-600 text-white rounded" onClick={() => deleteItem(it.id)}>Delete</button>
                  </div>
                </div>
                <label className="text-xs text-gray-600">
                  <div className="mb-1">Description</div>
                  <textarea className="w-full border rounded p-2 text-sm" value={it.description ?? ''} onChange={(e) => setMenu(prev => prev.map(p => p.id === it.id ? { ...p, description: e.target.value } : p))} />
                </label>
              </div>
            ))}
            {menu.filter(m => m.category === cat).length === 0 && (
              <div className="text-gray-600">No items in this category.</div>
            )}
          </div>
        </div>
      ))}
      {categories.length === 0 && <div className="text-gray-600">No menu items yet.</div>}

      {optionsEditorFor !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow w-11/12 max-w-2xl max-h-[85vh] overflow-auto p-4 relative">
            <button className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded" onClick={() => setOptionsEditorFor(null)}>Close</button>
            <h2 className="text-lg font-semibold mb-2">Edit Options</h2>
            <p className="text-sm text-gray-600 mb-2">Provide JSON array of option groups. Example:</p>
            <pre className="bg-gray-100 p-2 text-xs overflow-auto mb-2">{`[
  {"id":"toppings","name":"Toppings","max_select":2,"options":[{"id":"extra_cheese","name":"Extra Cheese","price_delta":1.5},{"id":"olives","name":"Olives","price_delta":1}]}
]`}</pre>
            <textarea className="w-full h-64 border rounded p-2 font-mono text-xs" value={optionsJson} onChange={(e) => setOptionsJson(e.target.value)} />
            <div className="mt-3 flex justify-end gap-2">
              <button className="px-3 py-2 bg-gray-200 rounded" onClick={() => setOptionsEditorFor(null)}>Cancel</button>
              <button className="px-3 py-2 bg-green-600 text-white rounded" onClick={async () => {
                try {
                  const parsed = JSON.parse(optionsJson) as MenuOptionGroup[];
                  const id = optionsEditorFor!;
                  const target = menu.find(m => m.id === id);
                  if (!target) return;
                  const next: MenuItem = { ...target, options: parsed } as MenuItem;
                  setMenu(prev => prev.map(p => p.id === id ? next : p));
                  await updateItem(next);
                  setOptionsEditorFor(null);
                } catch (e) {
                  alert('Invalid JSON: ' + (e as Error).message);
                }
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
