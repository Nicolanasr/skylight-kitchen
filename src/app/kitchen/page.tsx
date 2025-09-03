"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Order, OrderItem, MenuItem } from "@/types";

export default function KitchenPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [receiptScope, setReceiptScope] = useState<"table" | "name" | null>(null);
    const [receiptTableId, setReceiptTableId] = useState<string | null>(null);
    const [receiptName, setReceiptName] = useState<string | null>(null);
    const [receiptItems, setReceiptItems] = useState<
        { itemName: string; quantity: number; unitPrice: number; lineTotal: number }[]
    >([]);
    const [receiptTotal, setReceiptTotal] = useState(0);
    const [receiptDiscount, setReceiptDiscount] = useState(0);
    const [receiptNamesForTable, setReceiptNamesForTable] = useState<string[]>([]);
    // Paid modal state
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [payTableId, setPayTableId] = useState<string | null>(null);
    const [payNames, setPayNames] = useState<string[]>([]);
    const [paySelectedNames, setPaySelectedNames] = useState<Set<string>>(new Set());
    const [paySelectAll, setPaySelectAll] = useState<boolean>(true);
    // Collapsible paid tables
    const [paidExpanded, setPaidExpanded] = useState<Record<string, boolean>>({});

    // Edit order modal state
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editOrder, setEditOrder] = useState<Order | null>(null);
    const [editItems, setEditItems] = useState<OrderItem[]>([]);
    const [editName, setEditName] = useState<string>("");
    const [editComment, setEditComment] = useState<string>("");
    const [editDiscAmount, setEditDiscAmount] = useState<number>(0);
    const [editDiscPercent, setEditDiscPercent] = useState<number>(0);
    const [addItemId, setAddItemId] = useState<number | null>(null);
    const [addQty, setAddQty] = useState<number>(1);

    // Helpers for totals/discounts using new columns with legacy fallback
    const getOrderSubtotal = (order: Order) => {
        return (
            order.order_items?.reduce((sum, it) => {
                const m = menuItems.find((mm) => mm.id === it.menu_item_id);
                return sum + (m ? m.price * it.quantity : 0);
            }, 0) || 0
        );
    };

    const getOrderDiscount = (order: Order, subtotal: number) => {
        // prefer columns; fallback to legacy tags in comment if columns are null/0
        const pct = order.disc_pct && order.disc_pct > 0 ? order.disc_pct : 0;
        const amt = order.disc_amt && order.disc_amt > 0 ? order.disc_amt : 0;
        let discount = 0;
        if (pct > 0) discount = (subtotal * pct) / 100;
        else if (amt > 0) discount = amt;
        return Math.min(discount, subtotal);
    };

    // Fetch menu items for names
    useEffect(() => {
        async function fetchMenu() {
            const { data } = await supabase.from("menus").select("*");
            setMenuItems(data || []);
        }
        fetchMenu();
    }, []);

    // Fetch orders (latest first) and subscribe to real-time updates
    useEffect(() => {
        async function fetchOrders() {
            const { data } = await supabase
                .from("orders")
                .select("*")
                .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // only last 24hrs
                .order("created_at", { ascending: false }); // latest first
            setOrders(data || []);
        }
        fetchOrders();

        const subscription = supabase
            .channel("orders")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "orders" },
                (payload) => {
                    const updatedOrder = payload.new as Order;
                    setOrders((prev) => {
                        const index = prev.findIndex((o) => o.id === updatedOrder.id);
                        if (index === -1) return [updatedOrder, ...prev]; // new order first
                        const newOrders = [...prev];
                        newOrders[index] = updatedOrder;
                        return newOrders;
                    });
                }
            )
            .subscribe();

        // Cleanup must be synchronous
        return () => {
            // call async cleanup but don't return its Promise
            supabase.removeChannel(subscription).then(() => {
                console.log("Channel removed");
            });
        };
    }, []);

    // Convert UTC to Beirut time
    const formatDate = (utcDate: string) =>
        new Date(`${utcDate}Z`).toLocaleString("en-US", { timeZone: "Asia/Beirut" });

    // Update order status
    const updateStatus = async (order: Order, nextStatus: string) => {
        await supabase.from("orders").update({ status: nextStatus }).eq("id", order.id);
    };

    // legacy inline alert receipt removed; receipt handled via modal

    // Build aggregated receipt data (served orders only)
    const buildReceiptData = (tableId: string, name?: string | null) => {
        const servedOrders = orders.filter(
            (o) => o.table_id === tableId && o.status === "served" && (!name || (o.name || "Unknown") === name)
        );

        const byItem: Record<number, { itemName: string; quantity: number; unitPrice: number }> = {};
        let totalDiscount = 0;
        servedOrders.forEach((order) => {
            order.order_items?.forEach((oi) => {
                const menu = menuItems.find((m) => m.id === oi.menu_item_id);
                const itemName = menu?.name || "Unknown";
                const unitPrice = menu?.price || 0;
                if (!byItem[oi.menu_item_id]) {
                    byItem[oi.menu_item_id] = { itemName, quantity: 0, unitPrice };
                }
                byItem[oi.menu_item_id].quantity += oi.quantity;
            });
            // accumulate discount via new columns
            const subtotal = getOrderSubtotal(order);
            totalDiscount += getOrderDiscount(order, subtotal);
        });

        const items = Object.values(byItem)
            .map((v) => ({ ...v, lineTotal: v.unitPrice * v.quantity }))
            .sort((a, b) => a.itemName.localeCompare(b.itemName));
        const total = items.reduce((sum, it) => sum + it.lineTotal, 0);

        setReceiptItems(items);
        setReceiptDiscount(totalDiscount);
        setReceiptTotal(Math.max(0, total - totalDiscount));
    };

    const openReceiptForTable = (tableId: string) => {
        setReceiptScope("table");
        setReceiptTableId(tableId);
        setReceiptName(null);
        buildReceiptData(tableId);
        setIsReceiptOpen(true);
    };

    const openReceiptForName = (tableId: string) => {
        setReceiptScope("name");
        setReceiptTableId(tableId);
        // names available only among served orders for this table
        const names = Array.from(
            new Set(
                orders
                    .filter((o) => o.table_id === tableId && o.status === "served")
                    .map((o) => (o.name && o.name.trim() ? o.name.trim() : "Unknown"))
            )
        ).sort((a, b) => a.localeCompare(b));
        setReceiptNamesForTable(names);

        // if exactly one name, auto-select it
        if (names.length === 1) {
            const n = names[0];
            setReceiptName(n);
            buildReceiptData(tableId, n);
        } else {
            setReceiptName(null);
            setReceiptItems([]);
            setReceiptTotal(0);
        }
        setIsReceiptOpen(true);
    };

    const handleSelectReceiptName = (name: string) => {
        if (!receiptTableId) return;
        setReceiptName(name);
        buildReceiptData(receiptTableId, name);
    };

    // Open pay modal for a table (served orders only)
    const openPayModal = (tableId: string) => {
        setPayTableId(tableId);
        const names = Array.from(
            new Set(
                orders
                    .filter((o) => o.table_id === tableId && o.status === "served")
                    .map((o) => (o.name && o.name.trim() ? o.name.trim() : "Unknown"))
            )
        ).sort((a, b) => a.localeCompare(b));
        setPayNames(names);
        setPaySelectedNames(new Set(names));
        setPaySelectAll(true);
        setIsPayModalOpen(true);
    };

    const togglePayName = (name: string) => {
        setPaySelectedNames((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            setPaySelectAll(next.size === payNames.length);
            return next;
        });
    };

    const togglePaySelectAll = () => {
        if (paySelectAll) {
            setPaySelectedNames(new Set());
            setPaySelectAll(false);
        } else {
            setPaySelectedNames(new Set(payNames));
            setPaySelectAll(true);
        }
    };

    const confirmPaySelected = async () => {
        if (!payTableId) return;
        const eligible = orders.filter(
            (o) => o.table_id === payTableId && o.status === "served" && (paySelectAll || paySelectedNames.has(o.name && o.name.trim() ? o.name.trim() : "Unknown"))
        );
        const ids = eligible.map((o) => o.id);
        if (ids.length === 0) {
            setIsPayModalOpen(false);
            return;
        }
        const { error } = await supabase.from("orders").update({ status: "paid" }).in("id", ids);
        if (!error) {
            // update local state optimistically
            setOrders((prev) => prev.map((o) => (ids.includes(o.id) ? { ...o, status: "paid" } : o)));
        } else {
            alert("Failed to mark paid: " + error.message);
        }
        setIsPayModalOpen(false);
    };

    const printCurrentReceipt = () => {
        const title = receiptScope === "name"
            ? `Receipt — Table ${receiptTableId} — ${receiptName}`
            : `Receipt — Table ${receiptTableId}`;

        const rowsHtml = receiptItems
            .map(
                (it) => `
                <div class="row">
                    <div class="name">${it.itemName}</div>
                    <div class="qty">x ${it.quantity}</div>
                    <div class="amt">$${it.lineTotal.toFixed(2)}</div>
                </div>`
            )
            .join("");

        const subtotal = receiptItems.reduce((s, i) => s + i.lineTotal, 0);

        const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
        <style>
            @page { size: 80mm auto; margin: 5mm; }
            * { box-sizing: border-box; }
            body { width: 70mm; margin: 0 auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; }
            .center { text-align: center; }
            .muted { color: #333; }
            .line { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; align-items: baseline; }
            .row .name { flex: 1 1 auto; padding-right: 6px; }
            .row .qty { flex: 0 0 auto; width: 40px; text-align: right; }
            .row .amt { flex: 0 0 auto; width: 60px; text-align: right; }
            .total { font-weight: 700; }
            h1 { font-size: 14px; margin: 0 0 6px; }
            .meta { font-size: 11px; margin-bottom: 6px; }
        </style></head><body>
            <div class="center">
                <h1>Receipt</h1>
                <div class="meta muted">${new Date().toLocaleString()}</div>
                <div class="meta">${title}</div>
            </div>
            <div class="line"></div>
            ${rowsHtml || `<div class='muted'>No items</div>`}
            <div class="line"></div>
            <div class="row"><div class="name"></div><div class="qty">SubTotal</div><div class="amt">$${subtotal.toFixed(2)}</div></div>
            <div class="row"><div class="name"></div><div class="qty">Discount</div><div class="amt">-$${receiptDiscount.toFixed(2)}</div></div>
            <div class="row total"><div class="name"></div><div class="qty">Total</div><div class="amt">$${receiptTotal.toFixed(2)}</div></div>
        </body></html>`;

        const w = window.open("", "PRINT", "height=600,width=420");
        if (!w) return;
        w.document.write(html);
        w.document.close();
        w.focus();
        w.print();
        w.close();
    };

    // Define status order
    const statuses = ["pending", "preparing", "ready to be served", "served", "paid", "canceled"];

    // Group orders by status → table → name
    const ordersByStatusTableName: Record<string, Record<string, Record<string, Order[]>>> = {};
    statuses.forEach((status) => (ordersByStatusTableName[status] = {}));

    orders.forEach((order) => {
        const tableKey = order.table_id;
        const nameKey = order.name && order.name.trim() ? order.name.trim() : "Unknown";
        if (!ordersByStatusTableName[order.status][tableKey]) {
            ordersByStatusTableName[order.status][tableKey] = {};
        }
        if (!ordersByStatusTableName[order.status][tableKey][nameKey]) {
            ordersByStatusTableName[order.status][tableKey][nameKey] = [];
        }
        ordersByStatusTableName[order.status][tableKey][nameKey].push(order);
    });

    return (
        <div className="p-4 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Kitchen Orders</h1>

            {statuses.map((status) => (
                <div key={status} className="mb-6">
                    <h2 className="text-xl font-semibold mb-2 capitalize">{status}</h2>
                    {Object.keys(ordersByStatusTableName[status]).length === 0 && (
                        <p className="text-gray-500">No orders</p>
                    )}
                    {/* Group by table, then by name within each table */}
                    {Object.entries(ordersByStatusTableName[status])
                        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
                        .map(([tableId, namesMap]) => (
                            <div key={tableId} className="mb-4 p-3 border rounded bg-gray-50">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-semibold">Table {tableId}</h3>
                                    {/* Show Receipt button only if there are served orders */}
                                    {status == "served" && orders.some((o) => o.table_id === tableId && o.status === "served") && (
                                        <div className="flex gap-2">
                                            <button
                                                className="px-3 py-1 bg-gray-600 rounded text-white"
                                                onClick={() => openReceiptForTable(tableId)}
                                            >
                                                Receipt (Table)
                                            </button>
                                            <button
                                                className="px-3 py-1 bg-gray-600 rounded text-white"
                                                onClick={() => openReceiptForName(tableId)}
                                            >
                                                Receipt / Name
                                            </button>
                                            <button
                                                className="px-3 py-1 bg-green-600 rounded text-white"
                                                onClick={() => openPayModal(tableId)}
                                            >
                                                Mark Paid
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {(() => {
                                    const expKey = `${status}:${tableId}`;
                                    const list = (
                                        Object.entries(namesMap)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([name, nameOrders]) => (
                                                <div key={name} className="mb-3">
                                                    <h4 className="font-medium mb-2">Name: {name}</h4>
                                                    {nameOrders.map((order) => {
                                                        // Calculate minutes since order was created
                                                        const now = new Date();
                                                        const created = new Date(formatDate(order.created_at));
                                                        const diffMinutes = Math.floor((now.getTime() - created.getTime()) / 60000);

                                                        // Determine color
                                                        let timeColor = "text-green-600"; // 0-10
                                                        if (diffMinutes > 10 && diffMinutes <= 20) timeColor = "text-orange-500";
                                                        else if (diffMinutes > 20) timeColor = "text-red-600";

                                                        return (
                                                            <div key={order.id} className="p-2 mb-2 border rounded bg-white">
                                                                <p><strong>Order ID:</strong> {order.id}</p>
                                                                <p><strong>Table:</strong> {order.table_id}</p>
                                                                <p><strong>Name:</strong> {order.name || "Unknown"}</p>
                                                                <p>
                                                                    <strong>Date:</strong> {formatDate(order.created_at)} —{" "}
                                                                    <span className={timeColor}>Ordered {diffMinutes} min ago</span>
                                                                </p>
                                                                <p><strong>Comment:</strong> {order.comment || "None"}</p>
                                                                <p><strong>Items:</strong></p>
                                                                <ul className="ml-4 list-disc">
                                                                    {order.order_items?.map((item) => {
                                                                        const menu = menuItems.find((m) => m.id === item.menu_item_id);
                                                                        const unit = menu?.price || 0;
                                                                        const line = unit * item.quantity;
                                                                        return (
                                                                            <li key={item.menu_item_id}>
                                                                                {menu?.name || "Unknown"} x {item.quantity} — ${line.toFixed(2)}
                                                                            </li>
                                                                        );
                                                                    })}
                                                                </ul>
                                                                {(() => {
                                                                    const subtotal = getOrderSubtotal(order);
                                                                    const discount = getOrderDiscount(order, subtotal);
                                                                    const total = Math.max(0, subtotal - discount);
                                                                    return (
                                                                        <div className="mt-2 text-sm ml-4">
                                                                            <div>Subtotal: ${subtotal.toFixed(2)}</div>
                                                                            {discount > 0 && <div>Discount: -${discount.toFixed(2)}</div>}
                                                                            <div className="font-semibold">Total: ${total.toFixed(2)}</div>
                                                                        </div>
                                                                    );
                                                                })()}

                                                                <div className="mt-2 flex gap-2 flex-wrap">
                                                                    {status !== "paid" && (
                                                                        <button
                                                                            className="px-3 py-1 bg-purple-600 rounded text-white"
                                                                            onClick={() => {
                                                                                setEditOrder(order);
                                                                                setEditItems(order.order_items ? [...order.order_items] : []);
                                                                                setEditName(order.name || "");
                                                                                setEditComment(order.comment || "");
                                                                                setEditDiscAmount(order.disc_amt || 0);
                                                                                setEditDiscPercent(order.disc_pct || 0);
                                                                                setAddItemId(null);
                                                                                setAddQty(1);
                                                                                setIsEditOpen(true);
                                                                            }}
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                    )}
                                                                    {status === "pending" && (
                                                                        <button className="px-3 py-1 bg-yellow-400 rounded text-white" onClick={() => updateStatus(order, "preparing")}>
                                                                            Make Preparing
                                                                        </button>
                                                                    )}
                                                                    {status === "preparing" && (
                                                                        <button className="px-3 py-1 bg-blue-500 rounded text-white" onClick={() => updateStatus(order, "ready to be served")}>
                                                                            Make Ready to Serve
                                                                        </button>
                                                                    )}
                                                                    {status === "ready to be served" && (
                                                                        <button className="px-3 py-1 bg-orange-500 rounded text-white" onClick={() => updateStatus(order, "served")}>
                                                                            Make Served
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))
                                    );

                                    if (status === "paid" || status === "served") {
                                        return (
                                            <div>
                                                <button
                                                    className="px-2 py-1 bg-gray-200 rounded"
                                                    onClick={() =>
                                                        setPaidExpanded((prev) => ({
                                                            ...prev,
                                                            [expKey]: !prev[expKey],
                                                        }))
                                                    }
                                                >
                                                    {paidExpanded[expKey] ? "Hide" : "Show"} Details
                                                </button>
                                                {paidExpanded[expKey] && <div className="mt-2">{list}</div>}
                                            </div>
                                        );
                                    }

                                    return list;
                                })()}
                            </div>
                        ))}
                </div>
            ))}

            {/* Receipt Modal */}
            {isReceiptOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded shadow w-11/12 max-w-md max-h-[85vh] overflow-auto p-4 relative">
                        <button
                            className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded"
                            onClick={() => setIsReceiptOpen(false)}
                        >
                            Close
                        </button>

                        <h2 className="text-lg font-semibold mb-2">
                            {receiptScope === "name"
                                ? `Receipt — Table ${receiptTableId} — ${receiptName ?? "Select name"}`
                                : `Receipt — Table ${receiptTableId}`}
                        </h2>

                        {receiptScope === "name" && receiptName === null && (
                            <div className="mb-3">
                                <p className="text-sm text-gray-600 mb-2">Select a name:</p>
                                <div className="flex flex-wrap gap-2">
                                    {receiptNamesForTable.map((n) => (
                                        <button
                                            key={n}
                                            className="px-3 py-1 bg-blue-500 text-white rounded"
                                            onClick={() => handleSelectReceiptName(n)}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                    {receiptNamesForTable.length === 0 && (
                                        <span className="text-sm text-gray-500">No served orders</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {receiptItems.length > 0 ? (
                            <div>
                                {/* Receipt preview in thermal format */}
                                <div className="font-mono w-full max-w-[320px] mx-auto text-sm">
                                    <div className="text-center font-semibold">Receipt</div>
                                    <div className="text-center text-xs text-gray-600">{new Date().toLocaleString()}</div>
                                    <div className="text-center text-xs">
                                        {receiptScope === 'name' ? `Table ${receiptTableId} — ${receiptName}` : `Table ${receiptTableId}`}
                                    </div>
                                    <div className="border-t border-dashed my-2"></div>
                                    {receiptItems.map((it, idx) => (
                                        <div key={idx} className="flex items-baseline">
                                            <div className="flex-1 pr-2">{it.itemName}</div>
                                            <div className="w-12 text-right">x {it.quantity}</div>
                                            <div className="w-16 text-right">{`$${it.lineTotal.toFixed(2)}`}</div>
                                        </div>
                                    ))}
                                    <div className="border-t border-dashed my-2"></div>
                                    <div className="flex text-xs">
                                        <div className="flex-1"></div>
                                        <div className="w-24 text-right">Subtotal</div>
                                        <div className="w-20 text-right">{`$${receiptItems.reduce((s, i) => s + i.lineTotal, 0).toFixed(2)}`}</div>
                                    </div>
                                    <div className="flex text-xs">
                                        <div className="flex-1"></div>
                                        <div className="w-24 text-right">Discount</div>
                                        <div className="w-20 text-right">{`-$${receiptDiscount.toFixed(2)}`}</div>
                                    </div>
                                    <div className="flex font-semibold">
                                        <div className="flex-1"></div>
                                        <div className="w-24 text-right">Total</div>
                                        <div className="w-20 text-right">{`$${receiptTotal.toFixed(2)}`}</div>
                                    </div>
                                </div>

                                <div className="mt-4 flex justify-end gap-2">
                                    <button
                                        className="px-3 py-1 bg-gray-200 rounded"
                                        onClick={() => setIsReceiptOpen(false)}
                                    >
                                        Close
                                    </button>
                                    <button
                                        className="px-3 py-1 bg-green-600 text-white rounded"
                                        onClick={printCurrentReceipt}
                                    >
                                        Print
                                    </button>
                                </div>
                            </div>
                        ) : (
                            receiptScope === "name" && receiptName === null ? null : (
                                <p className="text-sm text-gray-500">No items to display.</p>
                            )
                        )}
                    </div>
                </div>
            )}

            {/* Edit Order Modal */}
            {isEditOpen && editOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded shadow w-11/12 max-w-lg max-h-[85vh] overflow-auto p-4 relative">
                        <button
                            className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded"
                            onClick={() => setIsEditOpen(false)}
                        >
                            Close
                        </button>
                        <h2 className="text-lg font-semibold mb-2">Edit Order #{editOrder.id}</h2>

                        <div className="mb-3 grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm">Name</label>
                                <input className="w-full border rounded p-2" value={editName} onChange={(e) => setEditName(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm">Table</label>
                                <input className="w-full border rounded p-2 bg-gray-100" value={editOrder.table_id} readOnly />
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
                                            <button className="px-2 py-1 bg-gray-200 rounded" onClick={() => {
                                                setEditItems((prev) => prev.map((p, i) => i === idx ? { ...p, quantity: Math.max(0, p.quantity - 1) } : p).filter(p => p.quantity > 0));
                                            }}>-</button>
                                            <input type="number" className="w-14 border rounded p-1 text-center" value={it.quantity} onChange={(e) => {
                                                const q = Math.max(0, Number(e.target.value));
                                                setEditItems((prev) => prev.map((p, i) => i === idx ? { ...p, quantity: q } : p).filter(p => p.quantity > 0));
                                            }} />
                                            <button className="px-2 py-1 bg-gray-200 rounded" onClick={() => {
                                                setEditItems((prev) => prev.map((p, i) => i === idx ? { ...p, quantity: p.quantity + 1 } : p));
                                            }}>+</button>
                                        </div>
                                        <button className="px-2 py-1 bg-red-500 text-white rounded" onClick={() => setEditItems((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
                                    </div>
                                );
                            })}

                            <div className="flex items-center gap-2 mt-2">
                                <select className="border rounded p-2" value={addItemId ?? ''} onChange={(e) => setAddItemId(e.target.value ? Number(e.target.value) : null)}>
                                    <option value="">Add item...</option>
                                    {menuItems.map(mi => (
                                        <option key={mi.id} value={mi.id}>{mi.name} (${mi.price.toFixed(2)})</option>
                                    ))}
                                </select>
                                <input type="number" className="w-20 border rounded p-2" value={addQty} onChange={(e) => setAddQty(Number(e.target.value))} />
                                <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => {
                                    if (!addItemId) return;
                                    const existingIdx = editItems.findIndex(x => x.menu_item_id === addItemId);
                                    if (existingIdx >= 0) {
                                        setEditItems(prev => prev.map((p, i) => i === existingIdx ? { ...p, quantity: p.quantity + addQty } : p));
                                    } else {
                                        setEditItems(prev => [...prev, { id: Date.now(), menu_item_id: addItemId, quantity: addQty } as OrderItem]);
                                    }
                                    setAddItemId(null);
                                    setAddQty(1);
                                }}>Add</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm">Discount Amount ($)</label>
                                <input type="number" className="w-full border rounded p-2" value={editDiscAmount} onChange={(e) => { setEditDiscAmount(Math.max(0, Number(e.target.value))); if (Number(e.target.value) > 0) setEditDiscPercent(0); }} />
                            </div>
                            <div>
                                <label className="block text-sm">Discount Percent (%)</label>
                                <input type="number" max={100} className="w-full border rounded p-2" value={editDiscPercent} onChange={(e) => { setEditDiscPercent(Math.max(0, Math.min(100, Number(e.target.value)))); if (Number(e.target.value) > 0) setEditDiscAmount(0); }} />
                            </div>
                        </div>

                        {(() => {
                            const subtotal = editItems.reduce((sum, it) => {
                                const m = menuItems.find((mm) => mm.id === it.menu_item_id);
                                return sum + (m ? m.price * it.quantity : 0);
                            }, 0);
                            const rawDiscount = editDiscPercent > 0 ? (subtotal * editDiscPercent) / 100 : editDiscAmount;
                            const cappedDiscount = Math.min(rawDiscount, subtotal);
                            const total = Math.max(0, subtotal - cappedDiscount);
                            return (
                                <div className="mt-3 text-sm">
                                    <div>Subtotal: ${subtotal.toFixed(2)}</div>
                                    {cappedDiscount > 0 && <div>Discount: -${cappedDiscount.toFixed(2)}</div>}
                                    <div className="font-semibold">Total: ${total.toFixed(2)}</div>
                                    {editDiscAmount > subtotal && (
                                        <div className="text-xs text-red-600">Discount amount cannot exceed subtotal; it will be capped.</div>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="mt-4 flex justify-end gap-2">
                            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setIsEditOpen(false)}>Cancel</button>
                            <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={async () => {
                                if (!editOrder) return;
                                // cap discount amount to subtotal to avoid exceeding order total
                                const subtotal = editItems.reduce((sum, it) => {
                                    const m = menuItems.find((mm) => mm.id === it.menu_item_id);
                                    return sum + (m ? m.price * it.quantity : 0);
                                }, 0);
                                const safeAmount = Math.min(editDiscAmount, subtotal);
                                const payload: {
                                    order_items: OrderItem[];
                                    name: string | null;
                                    comment: string | null;
                                    disc_amt: number | null;
                                    disc_pct: number | null;
                                } = {
                                    order_items: editItems,
                                    name: editName || null,
                                    comment: (editComment || null),
                                    disc_amt: editDiscPercent > 0 ? 0 : safeAmount,
                                    disc_pct: editDiscPercent > 0 ? editDiscPercent : 0,
                                };
                                const { error } = await supabase
                                    .from("orders")
                                    .update(payload)
                                    .eq("id", editOrder.id);
                                if (error) {
                                    alert("Failed to save order: " + error.message);
                                    return;
                                }
                                // update local state
                                setOrders(prev => prev.map(o => o.id === editOrder.id ? { ...o, ...payload } as Order : o));
                                setIsEditOpen(false);
                            }}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pay Modal */}
            {isPayModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded shadow w-11/12 max-w-md max-h-[85vh] overflow-auto p-4 relative">
                        <button
                            className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded"
                            onClick={() => setIsPayModalOpen(false)}
                        >
                            Close
                        </button>
                        <h2 className="text-lg font-semibold mb-2">Mark Paid — Table {payTableId}</h2>
                        <div className="mb-2 flex items-center gap-2">
                            <input id="pay-all" type="checkbox" checked={paySelectAll} onChange={togglePaySelectAll} />
                            <label htmlFor="pay-all">Select All</label>
                        </div>
                        <div className="space-y-2">
                            {payNames.map((n) => (
                                <label key={n} className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={paySelectedNames.has(n)}
                                        onChange={() => togglePayName(n)}
                                    />
                                    <span>{n}</span>
                                </label>
                            ))}
                            {payNames.length === 0 && (
                                <p className="text-sm text-gray-500">No served orders to mark as paid.</p>
                            )}
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setIsPayModalOpen(false)}>
                                Cancel
                            </button>
                            <button
                                className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50"
                                onClick={confirmPaySelected}
                                disabled={payNames.length === 0 || (!paySelectAll && paySelectedNames.size === 0)}
                            >
                                Confirm Paid
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
