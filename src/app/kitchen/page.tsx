"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Order, OrderItem, MenuItem } from "@/types";
import ReceiptModal from "@/components/kitchen/ReceiptModal";
import EditOrderModal from "@/components/kitchen/EditOrderModal";
import PayModal from "@/components/kitchen/PayModal";
import StatusSection from "@/components/kitchen/StatusSection";
import SearchBar from "@/components/kitchen/SearchBar";
import { useNowTick } from "@/components/kitchen/hooks";
import { buildHighlighter, buildMenuIndex, formatDateBeirut, getOrderDiscount as utilGetOrderDiscount, getOrderSubtotal as utilGetOrderSubtotal } from "@/components/kitchen/utils";
import ToastContainer, { Toast } from "@/components/kitchen/ToastContainer";

export default function KitchenPage() {
    const nowTs = useNowTick(60000);
    const [orders, setOrders] = useState<Order[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
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
    const [receiptPaperWidth, setReceiptPaperWidth] = useState<'80mm' | '57mm' | '3.125in'>('80mm');
    // Paid modal state
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [payTableId, setPayTableId] = useState<string | null>(null);
    const [payNames, setPayNames] = useState<string[]>([]);
    const [paySelectedNames, setPaySelectedNames] = useState<Set<string>>(new Set());
    const [paySelectAll, setPaySelectAll] = useState<boolean>(true);
    // Collapsible paid tables
    const [paidExpanded, setPaidExpanded] = useState<Record<string, boolean>>({});
    // Collapsible groups removed: always show details expanded

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
    // New order indicators + toast/audio
    const [newOrderMeta, setNewOrderMeta] = useState<Record<number, { expiresAt: number; initialStatus: string }>>({});
    const [toasts, setToasts] = useState<Toast[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Helpers and indexes
    const menuIndex = useMemo(() => buildMenuIndex(menuItems), [menuItems]);
    const getOrderSubtotal = useCallback((order: Order) => utilGetOrderSubtotal(order, menuIndex), [menuIndex]);
    const getOrderDiscount = useCallback((order: Order, subtotal: number) => utilGetOrderDiscount(order, subtotal), []);

    // Fetch menu items for names
    useEffect(() => {
        async function fetchMenu() {
            const { data } = await supabase.from("menus").select("*");
            setMenuItems(data || []);
        }
        fetchMenu();
    }, []);

    // Preload notification audio
    useEffect(() => {
        const a = new Audio("/bell_ring.mp3");
        a.load();
        audioRef.current = a;
    }, []);

    // Fetch orders (latest first) and subscribe to real-time updates
    useEffect(() => {
        async function fetchOrders() {
            const { data } = await supabase
                .from("orders")
                .select("id,table_id,name,order_items,status,comment,disc_amt,disc_pct,created_at")
                .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // only last 24hrs
                .order("created_at", { ascending: false }); // latest first
            setOrders(data || []);
        }
        fetchOrders();

        const channel = supabase.channel("orders");
        // INSERT handler: play sound, toast, and mark as new for 10 minutes
        channel.on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "orders" },
            (payload) => {
                const newOrder = payload.new as Order;
                setOrders((prev) => {
                    const idx = prev.findIndex((o) => o.id === newOrder.id);
                    if (idx === -1) return [newOrder, ...prev];
                    const copy = [...prev];
                    copy[idx] = newOrder;
                    return copy;
                });
                const createdTs = new Date(`${newOrder.created_at}Z`).getTime();
                const expiresAt = createdTs + 10 * 60 * 1000;
                setNewOrderMeta((prev) => ({ ...prev, [newOrder.id]: { expiresAt, initialStatus: newOrder.status } }));
                const id = Date.now();
                setToasts((prev) => [...prev, { id, message: `New order #${newOrder.id} — Table ${newOrder.table_id}` }]);
                setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
                audioRef.current?.play().catch(() => { });
            }
        );
        // UPDATE handler: update list and clear new flag if status changed
        channel.on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "orders" },
            (payload) => {
                const updatedOrder = payload.new as Order;
                setOrders((prev) => {
                    const index = prev.findIndex((o) => o.id === updatedOrder.id);
                    if (index === -1) return [updatedOrder, ...prev];
                    const newOrders = [...prev];
                    newOrders[index] = updatedOrder;
                    return newOrders;
                });
                setNewOrderMeta((prev) => {
                    const meta = prev[updatedOrder.id];
                    if (meta && meta.initialStatus !== updatedOrder.status) {
                        const { [updatedOrder.id]: _, ...rest } = prev;
                        return rest;
                    }
                    return prev;
                });
            }
        );
        channel.subscribe();

        // Cleanup must be synchronous
        return () => {
            // call async cleanup but don't return its Promise
            supabase.removeChannel(channel).then(() => {
                console.log("Channel removed");
            });
        };
    }, []);

    // Periodically prune expired new-order flags
    useEffect(() => {
        setNewOrderMeta((prev) => {
            const next: typeof prev = {};
            for (const k in prev) {
                const id = Number(k);
                if (prev[id].expiresAt > nowTs) next[id] = prev[id];
            }
            return next;
        });
    }, [nowTs]);

    // Convert UTC to Beirut time
    const formatDate = useCallback((utcDate: string) => formatDateBeirut(utcDate), []);

    // Update order status
    const updateStatus = useCallback(async (order: Order, nextStatus: string) => {
        await supabase.from("orders").update({ status: nextStatus }).eq("id", order.id);
    }, []);

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
                const menu = menuIndex[oi.menu_item_id];
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

    const openReceiptForTable = useCallback((tableId: string) => {
        setReceiptScope("table");
        setReceiptTableId(tableId);
        setReceiptName(null);
        buildReceiptData(tableId);
        setIsReceiptOpen(true);
    }, [buildReceiptData]);

    const openReceiptForName = useCallback((tableId: string) => {
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
    }, [orders]);

    const handleSelectReceiptName = useCallback((name: string) => {
        if (!receiptTableId) return;
        setReceiptName(name);
        buildReceiptData(receiptTableId, name);
    }, [receiptTableId, orders]);

    // Open pay modal for a table (served orders only)
    const openPayModal = useCallback((tableId: string) => {
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
    }, [orders]);

    const togglePayName = useCallback((name: string) => {
        setPaySelectedNames((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            setPaySelectAll(next.size === payNames.length);
            return next;
        });
    }, [payNames.length]);

    const togglePaySelectAll = useCallback(() => {
        if (paySelectAll) {
            setPaySelectedNames(new Set());
            setPaySelectAll(false);
        } else {
            setPaySelectedNames(new Set(payNames));
            setPaySelectAll(true);
        }
    }, [paySelectAll, payNames]);

    const confirmPaySelected = useCallback(async () => {
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
    }, [payTableId, orders, paySelectAll, paySelectedNames]);

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
            @page { size: ${receiptPaperWidth} auto; margin: 5mm; }
            * { box-sizing: border-box; }
            body { width: calc(${receiptPaperWidth} - 10mm); margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; }
            .wrap { padding: 2mm; }
            .center { text-align: center; }
            .muted { color: #333; }
            .line { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; align-items: baseline; }
            .row .name { flex: 1 1 auto; padding-right: 6px; }
            .row .qty { flex: 0 0 auto; width: 80px; text-align: right; padding-right: 8px; }
            .row .amt { flex: 0 0 auto; width: 90px; text-align: right; }
            .total { font-weight: 700; }
            h1 { font-size: 14px; margin: 0 0 6px; }
            .meta { font-size: 11px; margin-bottom: 6px; }
        </style></head><body>
            <div class="wrap">
            <div class="center">
                <h1>Receipt</h1>
                <div class="meta muted">${new Date().toLocaleString()}</div>
                <div class="meta">${title}</div>
            </div>
            <div class="line"></div>
            ${rowsHtml || `<div class='muted'>No items</div>`}
            <div class="line"></div>
            <div class="row"><div class="name"></div><div class="qty">Subtotal</div><div class="amt">$${subtotal.toFixed(2)}</div></div>
            <div class="row"><div class="name"></div><div class="qty">Discount</div><div class="amt">-$${receiptDiscount.toFixed(2)}</div></div>
            <div class="row total"><div class="name"></div><div class="qty">Total</div><div class="amt">$${receiptTotal.toFixed(2)}</div></div>
            </div>
            <div class="line"></div>
            <div class="line"></div>
            <div style="text-align:center; ">
                Thank you for your visit! <br/>
                www.skylightvillagelb.com<br/>
                Tel: +961 70 66 99 33<br/>
                Follow us: @skylightvillage
            </div>
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

    // Search filtering: by item name, customer name, or table number
    const menuNameById = useMemo(() => {
        const m = new Map<number, string>();
        for (const key in menuIndex) {
            const id = Number(key);
            const mi = menuIndex[id];
            if (mi) m.set(mi.id, mi.name.toLowerCase());
        }
        return m;
    }, [menuIndex]);

    const q = searchQuery.trim().toLowerCase();
    const highlightItemName = useMemo(() => buildHighlighter(q), [q]);

    const filteredOrders = useMemo(() => {
        if (!q) return orders;
        return orders.filter((order) => {
            const tableMatch = order.table_id.toLowerCase().includes(q);
            const nameMatch = (order.name || "").toLowerCase().includes(q);
            const itemMatch = (order.order_items || []).some((it) => (menuNameById.get(it.menu_item_id) || "").includes(q));
            return tableMatch || nameMatch || itemMatch;
        });
    }, [orders, q, menuNameById]);

    // Group orders by status → table → name
    const ordersByStatusTableName = useMemo(() => {
        const map: Record<string, Record<string, Record<string, Order[]>>> = {};
        statuses.forEach((s) => (map[s] = {}));
        for (const order of filteredOrders) {
            const tableKey = order.table_id;
            const nameKey = order.name && order.name.trim() ? order.name.trim() : "Unknown";
            if (!map[order.status][tableKey]) map[order.status][tableKey] = {};
            if (!map[order.status][tableKey][nameKey]) map[order.status][tableKey][nameKey] = [];
            map[order.status][tableKey][nameKey].push(order);
        }
        return map;
    }, [filteredOrders]);

    const isOrderNew = useCallback(
        (order: Order) => {
            const meta = newOrderMeta[order.id];
            if (!meta) return false;
            if (order.status !== meta.initialStatus) return false;
            return nowTs < meta.expiresAt;
        },
        [newOrderMeta, nowTs]
    );

    return (
        <div className="p-4 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Kitchen Orders</h1>
            <SearchBar value={searchQuery} onDebouncedChange={setSearchQuery} onClear={() => setSearchQuery("")} />

            {statuses.map((status) => (
                <StatusSection
                    key={status}
                    status={status}
                    tablesMap={ordersByStatusTableName[status]}
                    paidExpanded={paidExpanded}
                    setPaidExpanded={setPaidExpanded}
                    menuIndex={menuIndex}
                    highlightItemName={highlightItemName}
                    formatDate={formatDate}
                    getOrderSubtotal={getOrderSubtotal}
                    getOrderDiscount={getOrderDiscount}
                    updateStatus={updateStatus}
                    onEdit={(order: Order) => {
                        setEditOrder(order);
                        setEditItems(order.order_items ? [...order.order_items] : []);
                        setEditName(order.name || '');
                        setEditComment(order.comment || '');
                        setEditDiscAmount(order.disc_amt || 0);
                        setEditDiscPercent(order.disc_pct || 0);
                        setAddItemId(null);
                        setAddQty(1);
                        setIsEditOpen(true);
                    }}
                    onOpenReceiptForTable={openReceiptForTable}
                    onOpenReceiptForName={openReceiptForName}
                    onOpenPayModal={openPayModal}
                    nowTs={nowTs}
                    isOrderNew={isOrderNew}
                />
            ))}

            <ReceiptModal
                isOpen={isReceiptOpen}
                scope={receiptScope}
                tableId={receiptTableId}
                name={receiptName}
                namesForTable={receiptNamesForTable}
                items={receiptItems}
                discount={receiptDiscount}
                total={receiptTotal}
                paperWidth={receiptPaperWidth}
                onClose={() => setIsReceiptOpen(false)}
                onSelectName={handleSelectReceiptName}
                onPrint={printCurrentReceipt}
                setPaperWidth={setReceiptPaperWidth}
                highlightItemName={highlightItemName}
            />

            <EditOrderModal
                isOpen={isEditOpen}
                order={editOrder}
                menuItems={menuItems}
                editItems={editItems}
                setEditItems={setEditItems}
                editName={editName}
                setEditName={setEditName}
                editComment={editComment}
                setEditComment={setEditComment}
                editDiscAmount={editDiscAmount}
                setEditDiscAmount={setEditDiscAmount}
                editDiscPercent={editDiscPercent}
                setEditDiscPercent={setEditDiscPercent}
                addItemId={addItemId}
                setAddItemId={setAddItemId}
                addQty={addQty}
                setAddQty={setAddQty}
                setIsOpen={setIsEditOpen}
                setOrders={setOrders}
            />

            <PayModal
                isOpen={isPayModalOpen}
                tableId={payTableId}
                names={payNames}
                selectedNames={paySelectedNames}
                selectAll={paySelectAll}
                onToggleName={togglePayName}
                onToggleAll={togglePaySelectAll}
                onConfirm={confirmPaySelected}
                onClose={() => setIsPayModalOpen(false)}
            />
            <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
        </div>
    );
}
