/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/components/useOrganization";
// import { orgFilter } from "@/lib/org-scope";
import { Order, OrderItem, MenuItem } from "@/types";
import ReceiptModal from "@/components/kitchen/ReceiptModal";
import EditOrderModal from "@/components/kitchen/EditOrderModal";
import PayModal from "@/components/kitchen/PayModal";
import StatusSection from "@/components/kitchen/StatusSection";
import SearchBar from "@/components/kitchen/SearchBar";
import { useNowTick } from "@/components/kitchen/hooks";
import { buildHighlighter, buildMenuIndex, formatDateBeirut, getOrderDiscount as utilGetOrderDiscount, getOrderSubtotal as utilGetOrderSubtotal } from "@/components/kitchen/utils";
import ToastContainer, { Toast } from "@/components/kitchen/ToastContainer";
import NotificationBell from "@/components/kitchen/NotificationBell";
import KeepAwakeToggle from "@/components/kitchen/KeepAwakeToggle";

export default function KitchenPage() {
    const { organizationId, loading: orgLoading, slug, isMember } = useOrganization();
    const nowTs = useNowTick(60000);
    const [orders, setOrders] = useState<Order[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    // Quick filters
    const [sinceHours, setSinceHours] = useState<number>(24);
    const [onlyNew, setOnlyNew] = useState<boolean>(false);
    const [onlyComments, setOnlyComments] = useState<boolean>(false);
    const [tableFilter, setTableFilter] = useState<string>("");
    // Date filters removed (default to last 24h in initial fetch)
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
    const [payAmountsByName, setPayAmountsByName] = useState<Record<string, number>>({});
    const [payGrandTotal, setPayGrandTotal] = useState<number>(0);
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
    // Notification center state (DB-backed)
    const [notifications, setNotifications] = useState<{ id: number; message: string; created_at: string; type?: string | null; read_at: string | null }[]>([]);
    const [notifBcConnected, setNotifBcConnected] = useState<boolean>(false);
    const [notifDbConnected, setNotifDbConnected] = useState<boolean>(false);
    // Org branding and rates
    const [orgBrand, setOrgBrand] = useState<{ brand_name?: string | null; logo_url?: string | null; receipt_header?: string | null; receipt_footer?: string | null; tax_rate?: number | null; service_rate?: number | null } | null>(null);

    // Helpers and indexes
    const menuIndex = useMemo(() => buildMenuIndex(menuItems), [menuItems]);
    const getOrderSubtotal = useCallback((order: Order) => utilGetOrderSubtotal(order, menuIndex), [menuIndex]);
    const getOrderDiscount = useCallback((order: Order, subtotal: number) => utilGetOrderDiscount(order, subtotal), []);

    // Fetch menu items for names
    useEffect(() => {
        if (!organizationId) return;
        async function fetchMenu() {
            const { data } = await supabase.from("menus").select("*").eq('organization_id', organizationId);
            setMenuItems(data || []);
        }
        fetchMenu();
    }, [organizationId]);

    // Preload notification audio
    useEffect(() => {
        const a = new Audio("/bell_ring.mp3");
        a.load();
        audioRef.current = a;
    }, []);

    // Fetch org branding and rates
    useEffect(() => {
        if (!organizationId) return;
        let cancelled = false;
        (async () => {
            const { data } = await supabase
                .from('organizations')
                .select('brand_name,logo_url,receipt_header,receipt_footer,tax_rate,service_rate')
                .eq('id', organizationId)
                .maybeSingle();
            if (!cancelled) setOrgBrand((data as typeof orgBrand) ?? null);
        })();
        return () => { cancelled = true; };
    }, [organizationId]);

    // Unread IDs are derived from notifications with null read_at
    const unreadIds = useMemo(() => new Set<number>(notifications.filter(n => !n.read_at).map(n => n.id)), [notifications]);

    // Subscribe to orders realtime updates
    useEffect(() => {
        // Keep realtime unchanged; RLS still enforces visibility
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
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    // Initial fetch: last 24 hours
    useEffect(() => {
        if (!organizationId) return;
        async function fetchOrders() {
            const { data } = await supabase
                .from("orders")
                .select("id,table_id,name,order_items,status,comment,disc_amt,disc_pct,created_at")
                .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .eq('organization_id', organizationId)
                .order("created_at", { ascending: false });
            setOrders(data || []);
        }
        fetchOrders();
    }, [organizationId]);

    type Notif = { id: number; message: string; created_at: string; type?: string | null; read_at: string | null };

    // Notifications feed: fetch and subscribe
    useEffect(() => {
        if (!organizationId) return;
        async function fetchNotifications() {
            const { data } = await supabase
                .from("notifications")
                .select("id,message,created_at,type,read_at")
                .eq('organization_id', organizationId)
                .order("created_at", { ascending: false })
                .limit(200);
            setNotifications((data as Notif[] | null) ?? []);
        }
        fetchNotifications();

        // Broadcast channel for realtime without DB replication
        const bc = supabase.channel('kitchen:notifications', { config: { broadcast: { self: false } } });
        bc.on('broadcast', { event: 'new' }, (payload: { payload: { id?: number; message: string; created_at: string; read_at?: string | null; type?: string | null } }) => {
            const n = payload.payload;
            setNotifications((prev) => [{ id: n.id ?? Date.now(), message: n.message, created_at: n.created_at, type: n.type ?? 'order.new', read_at: n.read_at ?? null }, ...prev]);
        });
        bc.subscribe((status) => setNotifBcConnected(status === 'SUBSCRIBED'));

        // Also try Postgres Changes (if replication is later enabled)
        const pc = supabase.channel('postgres:notifications');
        pc.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload: RealtimePostgresChangesPayload<Notif>) => {
            const n = payload.new as Notif | null | undefined;
            if (!n) return;
            setNotifications((prev: Notif[]) => {
                const idx = prev.findIndex((x) => x.id === n.id);
                if (idx === -1) return [n, ...prev];
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...n };
                return copy;
            });
        });
        pc.subscribe((status) => setNotifDbConnected(status === 'SUBSCRIBED'));

        return () => { supabase.removeChannel(bc); supabase.removeChannel(pc); };
    }, [organizationId]);

    // Fallback polling when not connected to any realtime channel
    useEffect(() => {
        const anyConnected = notifBcConnected || notifDbConnected;
        if (anyConnected) return; // polling only when not connected
        let stop = false;
        async function poll() {
            if (stop) return;
            try {
                if (!organizationId) return;
                const { data } = await supabase
                    .from('notifications')
                    .select('id,message,created_at,type,read_at')
                    .eq('organization_id', organizationId)
                    .order('created_at', { ascending: false })
                    .limit(200);
                setNotifications((data as Notif[] | null) ?? []);
            } catch { }
            setTimeout(poll, 5000);
        }
        poll();
        return () => { stop = true; };
    }, [notifBcConnected, notifDbConnected, organizationId]);

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
        // compute amounts per name and grand total for served orders
        const amounts: Record<string, number> = {};
        let gtotal = 0;
        orders
            .filter((o) => o.table_id === tableId && o.status === 'served')
            .forEach((o) => {
                const subtotal = getOrderSubtotal(o);
                const discount = getOrderDiscount(o, subtotal);
                const total = Math.max(0, subtotal - discount);
                const n = o.name && o.name.trim() ? o.name.trim() : 'Unknown';
                amounts[n] = (amounts[n] ?? 0) + total;
                gtotal += total;
            });
        setPayAmountsByName(amounts);
        setPayGrandTotal(gtotal);
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

    const confirmPaySelected = useCallback(async ({ method, cashier }: { method: string; cashier?: string | null }) => {
        if (!payTableId) return;
        const eligible = orders.filter(
            (o) => o.table_id === payTableId && o.status === "served" && (paySelectAll || paySelectedNames.has(o.name && o.name.trim() ? o.name.trim() : "Unknown"))
        );
        const ids = eligible.map((o) => o.id);
        if (ids.length === 0) {
            setIsPayModalOpen(false);
            return;
        }
        // Attempt to record payment row (optional schema)
        try {
            const total = paySelectAll ? payGrandTotal : Array.from(paySelectedNames).reduce((s, n) => s + (payAmountsByName[n] ?? 0), 0);
            await supabase.from('payments')
                .insert([{
                    organization_id: organizationId,
                    table_id: payTableId,
                    names: paySelectAll ? null : Array.from(paySelectedNames),
                    amount: total,
                    method,
                    cashier: cashier ?? null,
                }]);
        } catch (_e) {
            // ignore if table does not exist; we'll still mark orders paid
        }
        const { error } = await supabase.from("orders").update({ status: "paid" }).in("id", ids);
        if (!error) {
            // update local state optimistically
            setOrders((prev) => prev.map((o) => (ids.includes(o.id) ? { ...o, status: "paid" } : o)));
        } else {
            alert("Failed to mark paid: " + error.message);
        }
        setIsPayModalOpen(false);
    }, [payTableId, orders, paySelectAll, paySelectedNames, payGrandTotal, payAmountsByName, organizationId]);

    // Compute selected total for PayModal via a hook to keep hooks order stable
    const paySelectedTotal = useMemo(() => {
        if (paySelectAll) return payGrandTotal;
        let sum = 0;
        for (const n of paySelectedNames) sum += payAmountsByName[n] ?? 0;
        return sum;
    }, [paySelectAll, paySelectedNames, payAmountsByName, payGrandTotal]);

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
        const discount = receiptDiscount;
        const afterDiscount = Math.max(0, subtotal - discount);
        const taxRate = Math.max(0, orgBrand?.tax_rate ?? 0);
        const serviceRate = Math.max(0, orgBrand?.service_rate ?? 0);
        const taxAmt = (afterDiscount * taxRate) / 100;
        const serviceAmt = (afterDiscount * serviceRate) / 100;
        const grand = afterDiscount + taxAmt + serviceAmt;

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
            .brand { margin-bottom: 6px; }
            .brand img { max-height: 40px; object-fit: contain; }
        </style></head><body>
            <div class="wrap">
            <div class="center">
                <div class="brand">${orgBrand?.logo_url ? `<img src='${orgBrand.logo_url}' alt='Logo' />` : (orgBrand?.brand_name ? `<strong>${orgBrand.brand_name}</strong>` : '')}</div>
                <h1>Receipt${orgBrand?.brand_name ? ` — ${orgBrand.brand_name}` : ''}</h1>
                <div class="meta muted">${new Date().toLocaleString()}</div>
                <div class="meta">${title}</div>
                ${orgBrand?.receipt_header ? `<div class=\"meta\">${orgBrand.receipt_header}</div>` : ''}
            </div>
            <div class="line"></div>
            ${rowsHtml || `<div class='muted'>No items</div>`}
            <div class="line"></div>
            <div class="row"><div class="name"></div><div class="qty">Subtotal</div><div class="amt">$${subtotal.toFixed(2)}</div></div>
            <div class="row"><div class="name"></div><div class="qty">Discount</div><div class="amt">-$${discount.toFixed(2)}</div></div>
            <div class="row"><div class="name"></div><div class="qty">Tax (${taxRate.toFixed(2)}%)</div><div class="amt">$${taxAmt.toFixed(2)}</div></div>
            <div class="row"><div class="name"></div><div class="qty">Service (${serviceRate.toFixed(2)}%)</div><div class="amt">$${serviceAmt.toFixed(2)}</div></div>
            <div class="row total"><div class="name"></div><div class="qty">Total</div><div class="amt">$${grand.toFixed(2)}</div></div>
            </div>
            <div class="line"></div>
            ${orgBrand?.receipt_footer ? `<div style=\"text-align:center;\">${orgBrand.receipt_footer}</div>` : ''}
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

    // Helper: determine if an order is still "new"
    const isOrderNew = useCallback(
        (order: Order) => {
            const meta = newOrderMeta[order.id];
            if (!meta) return false;
            if (order.status !== meta.initialStatus) return false;
            return nowTs < meta.expiresAt;
        },
        [newOrderMeta, nowTs]
    );

    const filteredOrders = useMemo(() => {
        const cutoff = Date.now() - sinceHours * 60 * 60 * 1000;
        const base = orders.filter(o => new Date(o.created_at + 'Z').getTime() >= cutoff);
        const tableNorm = tableFilter.trim().toLowerCase();
        let out = base;
        if (q) {
            const tableMatchInfo = /^table\s+(\S+)/i.exec(q);
            const orderIdMatch = /^#?(\d+)$/i.exec(q);
            out = out.filter((order) => {
                const nameMatch = (order.name || "").toLowerCase().includes(q);
                const itemMatch = (order.order_items || []).some((it) => (menuNameById.get(it.menu_item_id) || "").includes(q));
                const idMatch = orderIdMatch ? order.id === Number(orderIdMatch[1]) : false;
                const tableMatch = tableMatchInfo ? order.table_id.toLowerCase() === tableMatchInfo[1].toLowerCase() : false;
                return nameMatch || itemMatch || idMatch || tableMatch;
            });
        }
        if (tableNorm) out = out.filter(o => o.table_id.toLowerCase() === tableNorm);
        if (onlyComments) out = out.filter(o => !!o.comment && o.comment.trim().length > 0);
        if (onlyNew && isOrderNew) out = out.filter(o => isOrderNew(o));
        return out;
    }, [orders, q, menuNameById, sinceHours, tableFilter, onlyComments, onlyNew, isOrderNew]);

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

    if (orgLoading) return <div className="p-4">Loading…</div>;
    if (!organizationId) return <div className="p-4">No organization found for “{slug}”.</div>;
    if (isMember === false) return <div className="p-4">You don’t have access to organization “{slug}”. Ask an owner/manager to add you.</div>;

    return (
        <div className="p-4 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4 gap-3">
                <h1 className="text-2xl font-bold">Kitchen Orders</h1>
                <NotificationBell
                    items={notifications}
                    unreadIds={unreadIds}
                    onMarkRead={async (id) => {
                        await supabase.rpc('mark_notification_read', { n_id: id });
                        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
                    }}
                    onMarkAllRead={async () => {
                        await supabase.rpc('mark_all_notifications_read');
                        const ts = new Date().toISOString();
                        setNotifications(prev => prev.map(n => n.read_at ? n : { ...n, read_at: ts }));
                    }}
                    nowTs={nowTs}
                    connected={notifBcConnected || notifDbConnected}
                />
                <KeepAwakeToggle />
            </div>
            <SearchBar value={searchQuery} onDebouncedChange={setSearchQuery} onClear={() => setSearchQuery("")} />
            <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
                <label className="flex items-center gap-2">Since
                    <select className="border rounded p-1" value={sinceHours} onChange={(e) => setSinceHours(Number(e.target.value))}>
                        <option value={2}>2h</option>
                        <option value={6}>6h</option>
                        <option value={12}>12h</option>
                        <option value={24}>24h</option>
                        <option value={72}>72h</option>
                    </select>
                </label>
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> Only new
                </label>
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={onlyComments} onChange={(e) => setOnlyComments(e.target.checked)} /> With comments
                </label>
                <label className="flex items-center gap-2">Table
                    <input className="border rounded p-1" placeholder="e.g., 12" value={tableFilter} onChange={(e) => setTableFilter(e.target.value)} />
                </label>
            </div>

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
                amountsByName={payAmountsByName}
                selectedTotal={paySelectedTotal}
                grandTotal={payGrandTotal}
            />
            <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
        </div>
    );
}
