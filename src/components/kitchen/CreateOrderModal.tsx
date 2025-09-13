"use client";

import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MenuItem, Order, OrderItem } from "@/types";

type CreateOrderModalProps = {
    isOpen: boolean;
    onClose: () => void;
    menuItems: MenuItem[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
};

export default function CreateOrderModal({ isOpen, onClose, menuItems, setOrders }: CreateOrderModalProps) {
    const [tableId, setTableId] = useState<string>("");
    const [name, setName] = useState<string>("");
    const [comment, setComment] = useState<string>("");
    const [search, setSearch] = useState<string>("");
    const categories = useMemo(() => {
        const set = new Set<string>();
        for (const m of menuItems) {
            const cat = m?.category && m.category.trim() ? m.category.trim() : "Uncategorized";
            set.add(cat);
        }
        return [
            "All",
            ...Array.from(set).sort((a, b) => a.localeCompare(b)),
        ];
    }, [menuItems]);
    const [category, setCategory] = useState<string>("All");

    const [cart, setCart] = useState<Record<number, number>>({});
    const [submitting, setSubmitting] = useState(false);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return menuItems.filter((m) => {
            const mCat = m?.category && m.category.trim() ? m.category.trim() : "Uncategorized";
            const catOk = category === "All" || mCat === category;
            const qOk = !q || m.name.toLowerCase().includes(q);
            return catOk && qOk;
        });
    }, [menuItems, category, search]);

    const subtotal = useMemo(() => {
        let sum = 0;
        for (const id in cart) {
            const mi = menuItems.find((m) => m.id === Number(id));
            if (mi) sum += mi.price * cart[Number(id)];
        }
        return sum;
    }, [cart, menuItems]);

    if (!isOpen) return null;

    const addToCart = (menuId: number) => {
        setCart((prev) => ({ ...prev, [menuId]: (prev[menuId] ?? 0) + 1 }));
    };
    const removeFromCart = (menuId: number) => {
        setCart((prev) => {
            const qty = (prev[menuId] ?? 0) - 1;
            const next = { ...prev };
            if (qty <= 0) delete next[menuId]; else next[menuId] = qty;
            return next;
        });
    };
    const deleteFromCart = (menuId: number) => {
        setCart((prev) => {
            const next = { ...prev };
            delete next[menuId];
            return next;
        });
    };

    const clearAll = () => {
        setTableId("");
        setName("");
        setComment("");
        setSearch("");
        setCategory("All");
        setCart({});
    };

    const submit = async () => {
        if (!tableId.trim()) { alert("Please enter a table number"); return; }
        const entries = Object.entries(cart);
        if (entries.length === 0) { alert("Please add items to the order"); return; }
        setSubmitting(true);
        try {
            const orderItems: OrderItem[] = entries.map(([k, qty]) => ({
                id: Date.now() + Number(k),
                menu_item_id: Number(k),
                quantity: qty,
                status: "pending",
            }));
            const payload = {
                table_id: tableId.trim(),
                name: name.trim() ? name.trim() : null,
                comment: comment.trim() ? comment.trim() : null,
                order_items: orderItems,
                status: "pending" as const,
                disc_amt: 0,
                disc_pct: 0,
            };
            const { data, error } = await supabase
                .from("orders")
                .insert(payload)
                .select("id,table_id,name,order_items,status,comment,disc_amt,disc_pct,created_at")
                .single();
            if (error) throw error;
            if (data) {
                setOrders((prev) => [...prev, data as Order]);
                clearAll();
                onClose();
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            alert("Failed to create order: " + (e?.message || String(e)));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded shadow-lg w-11/12 max-w-5xl h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b flex-none">
                    <h3 className="text-lg font-semibold">Create Order</h3>
                    <button className="px-2 py-1 bg-gray-100 rounded" onClick={onClose}>Close</button>
                </div>

                <div className="p-4 space-y-3 overflow-auto flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs text-gray-600">Table</label>
                            <input className="w-full border rounded p-2" placeholder="e.g. 5" value={tableId} onChange={(e) => setTableId(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-600">Customer</label>
                            <input className="w-full border rounded p-2" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-600">Search</label>
                            <input className="w-full border rounded p-2" placeholder="Search items" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                    </div>

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

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-2">
                        {filtered.map((mi) => (
                            <button
                                key={mi.id}
                                className="aspect-square border rounded p-2 flex flex-col items-center justify-center text-center hover:shadow"
                                onClick={() => addToCart(mi.id)}
                            >
                                <div className="font-medium line-clamp-2">{mi.name}</div>
                                <div className="text-sm text-gray-600 mt-1">${mi.price.toFixed(2)}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Fixed bottom cart and submit */}
                <div className="border-t p-3 flex-none">
                    <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold">Cart</h4>
                                <div className="text-sm">Subtotal: ${subtotal.toFixed(2)}</div>
                            </div>
                            {Object.keys(cart).length === 0 && (
                                <div className="text-sm text-gray-500">No items yet. Click an item to add.</div>
                            )}
                            <div className="max-h-40 overflow-auto pr-1">
                                {Object.entries(cart).map(([id, qty]) => {
                                    const mi = menuItems.find((m) => m.id === Number(id));
                                    if (!mi) return null;
                                    return (
                                        <div key={id} className="flex items-center gap-2 py-1 border-b last:border-b-0">
                                            <div className="flex-1 truncate" title={mi.name}>{mi.name}</div>
                                            <div className="w-24 text-right">${(mi.price * qty).toFixed(2)}</div>
                                            <div className="flex items-center gap-1">
                                                <button className="px-2 py-1 bg-gray-200 rounded" onClick={() => removeFromCart(Number(id))}>-</button>
                                                <span className="w-6 text-center">{qty}</span>
                                                <button className="px-2 py-1 bg-gray-200 rounded" onClick={() => addToCart(Number(id))}>+</button>
                                            </div>
                                            <button className="px-2 py-1 bg-red-500 text-white rounded" onClick={() => deleteFromCart(Number(id))}>Remove</button>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-2">
                                <label className="block text-xs text-gray-600">Comment</label>
                                <textarea className="w-full border rounded p-2" value={comment} onChange={(e) => setComment(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 w-48">
                            <button className="px-3 py-2 bg-gray-200 rounded w-full" onClick={onClose}>Cancel</button>
                            <button className="px-4 py-2 bg-green-600 text-white rounded w-full" disabled={submitting} onClick={submit}>
                                {submitting ? 'Submitting...' : 'Submit Order'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
