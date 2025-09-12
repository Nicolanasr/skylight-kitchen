"use client";

import React, { memo } from "react";
import { MenuItem, Order } from "@/types";

export type OrderCardProps = {
    order: Order;
    status: string;
    menuIndex: Record<number, MenuItem | undefined>;
    highlightItemName: (text: string) => React.ReactNode;
    formatDate: (utc: string) => string;
    getOrderSubtotal: (order: Order) => number;
    getOrderDiscount: (order: Order, subtotal: number) => number;
    onEdit: (order: Order) => void;
    onOpenChangeStatus: (order: Order) => void;
    updateItemStatus: (order: Order, itemIndex: number, nextStatus: string) => void | Promise<void>;
    updateAllItemStatuses?: (order: Order, nextStatus: string) => void | Promise<void>;
    nowTs?: number;
    isNew?: boolean;
};

function OrderCardBase({
    order,
    status,
    menuIndex,
    highlightItemName,
    formatDate,
    getOrderSubtotal,
    getOrderDiscount,
    onEdit,
    onOpenChangeStatus,
    updateItemStatus,
    nowTs,
    isNew,
}: OrderCardProps) {
    const createdAt = new Date(`${order.created_at}Z`).getTime();
    const diffMinutes = Math.floor((((nowTs ?? Date.now()) - createdAt) / 60000));
    const timeColor = diffMinutes < 10 ? "text-green-600" : diffMinutes < 30 ? "text-yellow-600" : "text-red-600";

    const subtotal = getOrderSubtotal(order);
    const discount = getOrderDiscount(order, subtotal);
    const total = Math.max(0, subtotal - discount);

    const printByStation = async () => {
        try {
            // Group items by station
            const byStation: Record<string, { name: string; qty: number }[]> = {};
            for (const it of order.order_items || []) {
                const mi = menuIndex[it.menu_item_id];
                if (!mi) continue;
                const station = mi.station || "General";
                const itemName = mi.name || `Item ${it.menu_item_id}`;
                if (!byStation[station]) byStation[station] = [];
                const arr = byStation[station];
                const existing = arr.find((x) => x.name === itemName);
                if (existing) existing.qty += it.quantity; else arr.push({ name: itemName, qty: it.quantity });
            }

            const pages = Object.entries(byStation)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([station, items]) => {
                    const rows = items
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((row) => `
                            <tr>
                                <td class="nm">${row.name}</td>
                                <td class="qt">${row.qty}</td>
                            </tr>
                        `)
                        .join("\n");
                    const html = `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Order #${order.id} — ${station}</title>
    <style>
        * { box-sizing: border-box; }
        @page { size: 80mm auto; margin: 4mm; }
        body { width: 80mm; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', Arial, sans-serif; }
        .ticket { width: 100%; }
        .hdr { display: flex; justify-content: space-between; font-size: 12px; color: #444; margin-bottom: 6px; }
        .title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
        .meta { font-size: 14px; margin-bottom: 8px; }
        .items { width: 100%; border-collapse: collapse; }
        .items th, .items td { border-bottom: 1px dashed #999; padding: 6px 0; }
        .items th.nm, .items td.nm { text-align: left; font-size: 16px; }
        .items th.qt, .items td.qt { text-align: right; width: 60px; font-size: 16px; font-weight: 700; }
        .comment { margin-top: 8px; padding-top: 6px; border-top: 1px dashed #999; font-size: 14px; }
    </style>
</head>
<body>
    <div class="ticket">
        <div class="hdr"><div>Order #${order.id}</div><div>${formatDate(order.created_at)}</div></div>
        <div class="title">Station: ${station}</div>
        <div class="meta">Table: <strong>${order.table_id}</strong> — Customer: <strong>${order.name || 'Unknown'}</strong></div>
        <table class="items">
            <thead><tr><th class="nm">Item</th><th class="qt">Qty</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        ${order.comment ? `<div class="comment">Comment: ${order.comment}</div>` : ''}
    </div>
</body>
</html>`;
                    return html;
                });

            // Print each station as a separate job (helps auto-cutter cut per ticket)
            const printHtml = (html: string) => new Promise<void>((resolve) => {
                const w = window.open("", "PRINT", "height=600,width=420");
                if (!w) { resolve(); return; }
                w.document.write(html);
                w.document.close();
                // Give the browser a tick to layout before printing
                setTimeout(() => {
                    try { w.focus(); } catch { }
                    try { w.print(); } catch { }
                    // Close shortly after; many browsers block on print dialog
                    setTimeout(() => { try { w.close(); } catch { } resolve(); }, 300);
                }, 50);
            });

            for (const html of pages) {
                // eslint-disable-next-line no-await-in-loop
                await printHtml(html);
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Print failed', err);
        }
    };

    return (
        <div className="p-2 mb-2 border rounded bg-white" title={`Total: $${total.toFixed(2)}`}>
            <div className="text-sm">
                <div className="flex justify-between">

                    <div className="font-medium flex items-center gap-2">
                        <span>
                            #{order.id} - {formatDate(order.created_at)} — <span className={timeColor}>{diffMinutes} min ago</span>
                        </span>
                        {/** New badge */}
                        {Boolean(isNew) && (
                            <span className="inline-block text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">New</span>
                        )}
                    </div>

                    <div className="flex gap-2 flex-wrap items-center">
                        {status !== "paid" && (
                            <>
                                <button className="px-3 py-1 bg-purple-600 rounded text-white" onClick={() => onEdit(order)}>
                                    Edit
                                </button>
                                <button
                                    className="px-3 py-1 bg-gray-700 rounded text-white"
                                    onClick={() => onOpenChangeStatus(order)}
                                >
                                    Change Status
                                </button>
                                {status === 'pending' && (
                                    <button
                                        className="px-3 py-1 bg-amber-600 rounded text-white"
                                        onClick={printByStation}
                                    >
                                        Print Stations
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
                {order.comment && <div className="text-gray-700">Comments: {order.comment}</div>}
                <table className="table-auto w-full mt-4  border-b border-gray-400 p-4">
                    <thead className="w-full">
                        <tr className="w-full text-left border-b ">
                            <th className="">Item</th>
                            <th className="">QTY</th>
                            <th className="">Price</th>
                            <th className="">Price total</th>
                            <th className="">Status</th>
                            <th className="text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="w-full">
                        {order.order_items?.map((item, idx) => {
                            const menu = menuIndex[item.menu_item_id];
                            const unit = menu?.price || 0;
                            const line = unit * item.quantity;
                            return (
                                <tr key={item.menu_item_id} className="items-center gap-2 table-row pt-4 border-b border-gray-400">
                                    <td className="table-cell">
                                        {highlightItemName(menu?.name || "Unknown")}
                                    </td>
                                    <td className="table-cell">{item.quantity}</td>
                                    <td className="table-cell">{'$' + unit.toFixed(2)}</td>
                                    <td className="table-cell">{'$' + (item.quantity * parseFloat(unit.toFixed(2).toString()))}</td>
                                    <td className="table-cell">
                                        <select
                                            className="border rounded px-2 py-1 text-sm capitalize"
                                            value={item.status}
                                            disabled={status === "served" || status === "paid"}
                                            onChange={(e) => updateItemStatus(order, idx, e.target.value)}
                                        >
                                            {(["pending", "preparing", "served"] as const).map((s) => (
                                                <option key={s} value={s} className="capitalize">
                                                    {s}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="text-xs capitalize"></td>

                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

        </div>
    );
}

const OrderCard = memo(OrderCardBase);
export default OrderCard;
