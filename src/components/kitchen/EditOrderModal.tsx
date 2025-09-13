"use client";

import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MenuItem, Order, OrderItem } from "@/types";

export type EditOrderModalProps = {
    isOpen: boolean;
    order: Order | null;
    menuItems: MenuItem[];
    editItems: OrderItem[];
    setEditItems: React.Dispatch<React.SetStateAction<OrderItem[]>>;
    editName: string;
    setEditName: (v: string) => void;
    editComment: string;
    setEditComment: (v: string) => void;
    editDiscAmount: number;
    setEditDiscAmount: (v: number) => void;
    editDiscPercent: number;
    setEditDiscPercent: (v: number) => void;
    addItemId: number | null;
    setAddItemId: (v: number | null) => void;
    addQty: number;
    setAddQty: (v: number) => void;
    setIsOpen: (v: boolean) => void;
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
};

export default function EditOrderModal({
    isOpen,
    order,
    menuItems,
    editItems,
    setEditItems,
    editName,
    setEditName,
    editComment,
    setEditComment,
    editDiscAmount,
    setEditDiscAmount,
    editDiscPercent,
    setEditDiscPercent,
    addItemId,
    setAddItemId,
    addQty,
    setAddQty,
    setIsOpen,
    setOrders,
}: EditOrderModalProps) {
    if (!isOpen || !order) return null;

    // New item picker state (like CreateOrderModal)
    const [search, setSearch] = useState<string>("");
    const categories = useMemo(() => {
        const set = new Set<string>();
        for (const m of menuItems) {
            const cat = m?.category && m.category.trim() ? m.category.trim() : "Uncategorized";
            set.add(cat);
        }
        return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
    }, [menuItems]);
    const [category, setCategory] = useState<string>("All");

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return menuItems.filter((m) => {
            const mCat = m?.category && m.category.trim() ? m.category.trim() : "Uncategorized";
            const catOk = category === "All" || mCat === category;
            const qOk = !q || m.name.toLowerCase().includes(q);
            return catOk && qOk;
        });
    }, [menuItems, category, search]);

    const subtotal = editItems.reduce((sum, it) => {
        const m = menuItems.find((mm) => mm.id === it.menu_item_id);
        return sum + (m ? m.price * it.quantity : 0);
    }, 0);
    const rawDiscount = editDiscPercent > 0 ? (subtotal * editDiscPercent) / 100 : editDiscAmount;
    const cappedDiscount = Math.min(rawDiscount, subtotal);
    const total = Math.max(0, subtotal - cappedDiscount);

    const save = async () => {
        if (!order) return;
        const sub = editItems.reduce((sum, it) => {
            const m = menuItems.find((mm) => mm.id === it.menu_item_id);
            return sum + (m ? m.price * it.quantity : 0);
        }, 0);
        const safeAmount = Math.min(editDiscAmount, sub);
        const payload: {
            order_items: OrderItem[];
            name: string | null;
            comment: string | null;
            disc_amt: number | null;
            disc_pct: number | null;
        } = {
            order_items: editItems,
            name: editName || null,
            comment: editComment || null,
            disc_amt: editDiscPercent > 0 ? 0 : safeAmount,
            disc_pct: editDiscPercent > 0 ? editDiscPercent : 0,
        };
        const { error } = await supabase.from("orders").update(payload).eq("id", order.id);
        if (error) {
            alert("Failed to save order: " + error.message);
            return;
        }
        setOrders((prev) => prev.map((o) => (o.id === order.id ? ({ ...o, ...payload } as Order) : o)));
        setIsOpen(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow w-11/12 max-w-lg max-h-[85vh] overflow-auto p-4 relative">
                <button className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded" onClick={() => setIsOpen(false)}>
                    Close
                </button>
                <h2 className="text-lg font-semibold mb-2">Edit Order #{order.id}</h2>

                <div className="mb-3 grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm">Name</label>
                        <input className="w-full border rounded p-2" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm">Table</label>
                        <input className="w-full border rounded p-2 bg-gray-100" value={order.table_id} readOnly />
                    </div>
                </div>

                <label className="block text-sm mb-1">Comment</label>
                <textarea className="w-full border rounded p-2 mb-3" value={editComment} onChange={(e) => setEditComment(e.target.value)} />

                <div className="mb-3">
                    <div className="font-medium mb-2">Items</div>
                    {editItems.length === 0 && <div className="text-sm text-gray-500">No items</div>}
                    {editItems.map((it, idx) => {
                        const menu = menuItems.find((m) => m.id === it.menu_item_id);
                        return (
                            <div key={`${it.menu_item_id}-${idx}`} className="flex items-center gap-2 mb-2">
                                <div className="flex-1">{menu?.name || `Item ${it.menu_item_id}`}</div>
                                <div className="flex items-center gap-1">
                                    <button
                                        className="px-2 py-1 bg-gray-200 rounded"
                                        onClick={() => {
                                            setEditItems((prev) =>
                                                prev
                                                    .map((p, i) => (i === idx ? { ...p, quantity: Math.max(0, p.quantity - 1) } : p))
                                                    .filter((p) => p.quantity > 0)
                                            );
                                        }}
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        className="w-14 border rounded p-1 text-center"
                                        value={it.quantity}
                                        onChange={(e) => {
                                            const q = Math.max(0, Number(e.target.value));
                                            setEditItems((prev) =>
                                                prev
                                                    .map((p, i) => (i === idx ? { ...p, quantity: q } : p))
                                                    .filter((p) => p.quantity > 0)
                                            );
                                        }}
                                    />
                                    <button
                                        className="px-2 py-1 bg-gray-200 rounded"
                                        onClick={() => {
                                            setEditItems((prev) => prev.map((p, i) => (i === idx ? { ...p, quantity: p.quantity + 1 } : p)));
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                                <button
                                    className="px-2 py-1 bg-red-500 text-white rounded"
                                    onClick={() => setEditItems((prev) => prev.filter((_, i) => i !== idx))}
                                >
                                    Remove
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Add new items (picker like CreateOrderModal) */}
                <div className="mb-4">
                    <div className="font-medium mb-2">Add Items</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                        <div className="md:col-span-1">
                            <label className="block text-xs text-gray-600">Search</label>
                            <input className="w-full border rounded p-2" placeholder="Search items" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs text-gray-600">Categories</label>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {categories.map((c) => (
                                    <button
                                        key={c}
                                        className={`px-3 py-1 rounded border ${category === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}
                                        onClick={() => setCategory(c)}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-2">
                        {filtered.map((mi) => (
                            <button
                                key={mi.id}
                                className="aspect-square border rounded p-2 flex flex-col items-center justify-center text-center hover:shadow"
                                onClick={() => {
                                    setEditItems((prev) => {
                                        const idx = prev.findIndex((p) => p.menu_item_id === mi.id);
                                        if (idx >= 0) return prev.map((p, i) => (i === idx ? { ...p, quantity: p.quantity + 1 } : p));
                                        return [
                                            ...prev,
                                            { id: Date.now() + mi.id, menu_item_id: mi.id, quantity: 1, status: 'pending' } as OrderItem,
                                        ];
                                    });
                                }}
                            >
                                <div className="font-medium line-clamp-2">{mi.name}</div>
                                <div className="text-sm text-gray-600 mt-1">${mi.price.toFixed(2)}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm">Discount Amount ($)</label>
                        <input
                            type="number"
                            className="w-full border rounded p-2"
                            value={editDiscAmount}
                            onChange={(e) => {
                                const v = Math.max(0, Number(e.target.value));
                                setEditDiscAmount(v);
                                if (v > 0) setEditDiscPercent(0);
                            }}
                        />
                    </div>
                    <div>
                        <label className="block text-sm">Discount Percent (%)</label>
                        <input
                            type="number"
                            max={100}
                            className="w-full border rounded p-2"
                            value={editDiscPercent}
                            onChange={(e) => {
                                const v = Math.max(0, Math.min(100, Number(e.target.value)));
                                setEditDiscPercent(v);
                                if (v > 0) setEditDiscAmount(0);
                            }}
                        />
                    </div>
                </div>

                <div className="mt-3 text-sm">
                    <div>Subtotal: ${subtotal.toFixed(2)}</div>
                    {cappedDiscount > 0 && <div>Discount: -${cappedDiscount.toFixed(2)}</div>}
                    <div className="font-semibold">Total: ${total.toFixed(2)}</div>
                    {editDiscAmount > subtotal && (
                        <div className="text-xs text-red-600">Discount amount cannot exceed subtotal; it will be capped.</div>
                    )}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setIsOpen(false)}>
                        Cancel
                    </button>
                    <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={save}>
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
