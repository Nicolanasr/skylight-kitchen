"use client";

import React from "react";
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

          <div className="flex items-center gap-2 mt-2">
            <select
              className="border rounded p-2"
              value={addItemId ?? ""}
              onChange={(e) => setAddItemId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Add item...</option>
              {menuItems.map((mi) => (
                <option key={mi.id} value={mi.id}>
                  {mi.name} (${mi.price.toFixed(2)})
                </option>
              ))}
            </select>
            <input type="number" className="w-20 border rounded p-2" value={addQty} onChange={(e) => setAddQty(Number(e.target.value))} />
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded"
              onClick={() => {
                if (!addItemId) return;
                const existingIdx = editItems.findIndex((x) => x.menu_item_id === addItemId);
                if (existingIdx >= 0) {
                  setEditItems((prev) => prev.map((p, i) => (i === existingIdx ? { ...p, quantity: p.quantity + addQty } : p)));
                } else {
                  setEditItems((prev) => [...prev, { id: Date.now(), menu_item_id: addItemId, quantity: addQty } as OrderItem]);
                }
                setAddItemId(null);
                setAddQty(1);
              }}
            >
              Add
            </button>
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

