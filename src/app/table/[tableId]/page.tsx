/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MenuItem } from "@/types";
import Image from "next/image";
import { TiShoppingCart } from "react-icons/ti";

type OrderItem = {
    menu_item_id: number;
    quantity: number;
};

export default function TablePage({ params }: { params: Promise<{ tableId: string }> }) {
    const { tableId } = React.use(params);

    const [menu, setMenu] = useState<MenuItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [cart, setCart] = useState<{ [key: number]: number }>({});
    const [comment, setComment] = useState<string>("");
    const [showSummary, setShowSummary] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [showNameDropdown, setShowNameDropdown] = useState(false);

    // Add at the top of the component
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [todayOrders, setTodayOrders] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'cart' | 'today'>('cart');

    const [orderName, setOrderName] = useState('');
    const [previousNames, setPreviousNames] = useState<string[]>([]);
    // Fetch previous names for this table
    useEffect(() => {
        async function fetchPreviousNames() {
            const { data } = await supabase
                .from('orders')
                .select('name')
                .eq('table_id', tableId)
                .not('name', 'is', null);

            const names = Array.from(new Set(data?.map(o => o.name!).filter(Boolean)));
            setPreviousNames(names);
        }

        if (showSummary) fetchPreviousNames();
    }, [showSummary, tableId]);

    // Fetch today's orders
    useEffect(() => {
        if (!showSummary) return;

        async function fetchTodayOrders() {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // start of today

            const { data } = await supabase
                .from("orders")
                .select("*")
                .eq("table_id", tableId)
                .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // only last 24hrs
                .order("created_at", { ascending: false });

            setTodayOrders(data || []);
        }

        fetchTodayOrders();
    }, [showSummary, tableId]);

    // Fetch menu
    useEffect(() => {
        async function fetchMenu() {
            const { data } = await supabase.from("menus").select("*");
            setMenu(data || []);
        }
        fetchMenu();
    }, []);

    // Persist cart (and optional fields) in localStorage by table
    useEffect(() => {
        if (!tableId) return;
        try {
            const raw = localStorage.getItem(`cart:${tableId}`);
            if (raw) {
                const parsed = JSON.parse(raw) as { cart?: { [key: number]: number }; comment?: string; orderName?: string };
                if (parsed.cart) setCart(parsed.cart);
                if (parsed.comment) setComment(parsed.comment);
                if (parsed.orderName) setOrderName(parsed.orderName);
            }
        } catch (_e) {
            // ignore parse errors
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableId]);

    useEffect(() => {
        if (!tableId) return;
        try {
            const payload = JSON.stringify({ cart, comment, orderName });
            localStorage.setItem(`cart:${tableId}`, payload);
        } catch (_e) {
            // ignore storage errors (quota, etc.)
        }
    }, [tableId, cart, comment, orderName]);


    const categories = Array.from(new Set(menu.map(item => item.category)));

    const addToCart = (id: number) => {
        setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    };

    const removeFromCart = (id: number) => {
        setCart(prev => {
            const updated = { ...prev };
            if (updated[id] > 1) {
                updated[id] -= 1;
            } else {
                delete updated[id];
            }
            return updated;
        });
    };

    const submitOrder = async () => {
        if (Object.keys(cart).length === 0) return;

        setIsSubmitting(true);

        const orderPayload = {
            table_id: tableId,
            order_items: Object.entries(cart).map(([id, qty]) => ({
                menu_item_id: Number(id),
                quantity: qty,
            })),
            status: 'pending',
            comment: comment || null,
            name: orderName || null,
        };

        const { error } = await supabase.from('orders').insert([orderPayload]);

        if (error) {
            alert('Error submitting order: ' + error.message);
        } else {
            setCart({});
            setComment('');
            setOrderName('');
            try { localStorage.removeItem(`cart:${tableId}`); } catch (_e) { }
            alert('Order submitted!');
        }

        setActiveTab("cart")
        setShowSummary(false)
        setIsSubmitting(false);
    };

    const totalItems = Object.values(cart).reduce((acc, qty) => acc + qty, 0);

    return (
        <div className="relative min-h-screen bg-gray-50">
            <header className="flex items-center justify-center py-4 bg-white shadow sticky top-0 z-50">
                <Image
                    src="/Skylight-logo.png"
                    alt="Restaurant Logo"
                    width={150}
                    height={50}
                    className="object-contain invert-100"
                />
            </header>

            <main className="p-4 max-w-5xl mx-auto">
                <h1 className="text-2xl font-bold mb-4 text-center">Table {tableId}</h1>

                {/* Categories Filter */}
                <div className="flex gap-2 mb-6 flex-wrap justify-center whitespace-nowrap">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-3 py-1 rounded ${selectedCategory === null ? "bg-blue-500 text-white" : "bg-gray-200"}`}
                    >
                        All
                    </button>
                    {categories.map(cat => (
                        cat !== null && <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-3 py-1 rounded ${selectedCategory === cat ? "bg-blue-500 text-white" : "bg-gray-200"}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Menu Grid */}
                {(selectedCategory ? menu.filter(item => item.category === selectedCategory) : menu).map(item => {
                    const qty = cart[item.id] || 0;
                    if (item.category === null) return null;
                    return (
                        <div key={item.id} className="p-4 border rounded shadow flex flex-col mb-4">
                            {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-48 object-cover rounded mb-2" />}
                            <h2 className="font-semibold text-lg">{item.name}</h2>
                            {item.description && <p className="text-sm text-gray-600 mb-1">{item.description}</p>}
                            <p className="font-bold mt-1">${item.price.toFixed(2)}</p>

                            {qty === 0 ? (
                                <button
                                    className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
                                    onClick={() => addToCart(item.id)}
                                >
                                    Add
                                </button>
                            ) : (
                                <div className="mt-3 inline-flex items-center gap-3">
                                    <button
                                        className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                                        onClick={() => removeFromCart(item.id)}
                                        aria-label={`Decrease ${item.name}`}
                                    >
                                        -
                                    </button>
                                    <span className="min-w-[2ch] text-center font-medium">{qty}</span>
                                    <button
                                        className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                                        onClick={() => addToCart(item.id)}
                                        aria-label={`Increase ${item.name}`}
                                    >
                                        +
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </main>

            {/* Floating Order Summary Button */}
            <button
                onClick={() => setShowSummary(true)}
                className="fixed bottom-6 right-6 bg-green-500 text-white px-4 py-3 rounded-full shadow-lg hover:bg-green-600 transition-colors z-50 "
            >
                <TiShoppingCart className="text-4xl" />
                {totalItems > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {totalItems}
                    </span>
                )}
            </button>

            {/* Modal / Popup for Order Summary */}
            {showSummary && (
                <div className="fixed inset-0 bg-[#000000ab] flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded shadow-lg w-11/12 md:w-2/3 max-h-[80vh] overflow-y-auto relative">
                        <h3 className="font-semibold text-xl mb-4">Order Summary</h3>

                        {/* Tabs */}
                        <div className="flex border-b mb-4">
                            <button
                                onClick={() => setActiveTab('cart')}
                                className={`px-4 py-2 ${activeTab === 'cart' ? "border-b-2 border-blue-500 font-semibold" : ""}`}
                            >
                                Current Cart
                            </button>
                            <button
                                onClick={() => setActiveTab('today')}
                                className={`px-4 py-2 ${activeTab === 'today' ? "border-b-2 border-blue-500 font-semibold" : ""}`}
                            >
                                My Orders
                            </button>
                        </div>

                        <button
                            onClick={() => setShowSummary(false)}
                            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 absolute top-0 right-0 z-10"
                        >
                            X
                        </button>

                        {/* Tab Content */}
                        {activeTab === 'cart' && (
                            <>
                                {Object.keys(cart).length === 0 ? (
                                    <p>Your cart is empty.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {Object.entries(cart).map(([id, qty]) => {
                                            const item = menu.find(m => m.id === Number(id));
                                            if (!item) return null;
                                            return (
                                                <li key={id} className="flex justify-between items-center">
                                                    <span className="font-medium">{item.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => removeFromCart(Number(id))}
                                                            className="px-4 py-1 bg-gray-200 rounded hover:bg-gray-300"
                                                            aria-label={`Decrease ${item.name}`}
                                                        >
                                                            -
                                                        </button>
                                                        <span className="min-w-[2ch] text-center font-medium">{qty}</span>
                                                        <button
                                                            onClick={() => addToCart(Number(id))}
                                                            className="px-4 py-1 bg-gray-200 rounded hover:bg-gray-300"
                                                            aria-label={`Increase ${item.name}`}
                                                        >
                                                            +
                                                        </button>
                                                        <span className="ml-3">${(item.price * qty).toFixed(2)}</span>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}

                                <div className="mb-4 relative mt-6">
                                    <label className="block font-medium mb-1">Name (optional)</label>
                                    <input
                                        type="text"
                                        value={orderName}
                                        onChange={(e) => {
                                            setOrderName(e.target.value.toLowerCase());
                                            setShowNameDropdown(true);
                                        }}
                                        onFocus={() => setShowNameDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowNameDropdown(false), 200)} // delay to allow click
                                        className="w-full border rounded p-2"
                                        placeholder="Type a name or select from previous"
                                    />

                                    {/* Dropdown list */}
                                    {showNameDropdown && previousNames.length > 0 && (
                                        <ul className="absolute z-50 w-full bg-white border rounded shadow mt-1 max-h-40 overflow-y-auto">
                                            {previousNames
                                                .filter((n) => n.toLowerCase().includes(orderName.toLowerCase()))
                                                .map((n, idx) => (
                                                    <li
                                                        key={idx}
                                                        onClick={() => {
                                                            setOrderName(n);
                                                            setShowNameDropdown(false);
                                                        }}
                                                        className="px-2 py-1 hover:bg-blue-100 cursor-pointer"
                                                    >
                                                        {n}
                                                    </li>
                                                ))}
                                        </ul>
                                    )}
                                </div>

                                <div className="mt-4">
                                    <label className="block mb-1 font-medium">Add a comment (optional):</label>
                                    <input
                                        className="w-full border rounded p-2"
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder="E.g., No onions, extra spicy..."
                                    />
                                </div>

                                <p className="font-bold mt-4 text-right">
                                    Total: ${Object.entries(cart).reduce((acc, [id, qty]) => {
                                        const item = menu.find(m => m.id === Number(id));
                                        return acc + (item ? item.price * qty : 0);
                                    }, 0).toFixed(2)}
                                </p>

                                <div className="mt-4 flex gap-2 justify-end">
                                    <button
                                        onClick={submitOrder}
                                        className={`px-4 py-2 ${isSubmitting ? "bg-green-100" : "bg-green-500"} text-white rounded hover:bg-green-600`}
                                        disabled={isSubmitting}
                                    >
                                        Submit Order
                                    </button>
                                </div>
                            </>
                        )}

                        {activeTab === 'today' && (
                            <>
                                {todayOrders.length === 0 ? (
                                    <p>No orders for today.</p>
                                ) : (
                                    todayOrders.map(order => (
                                        <div key={order.id} className="border rounded p-3 mb-3">
                                            <div className="flex justify-between mb-2 items-center">
                                                <span className="font-semibold">Order #{order.id} - {order.name}</span>
                                                <span className={`capitalize ${order.status === 'pending' ? 'text-yellow-500' : order.status === 'completed' ? 'text-green-500' : 'text-gray-500'}`}>
                                                    {order.status}
                                                </span>
                                            </div>

                                            <ul className="mb-2">
                                                {order.order_items.map((oi: OrderItem) => {
                                                    const item = menu.find(m => m.id === oi.menu_item_id);
                                                    if (!item) return null;
                                                    return (
                                                        <li key={Math.random()} className="flex justify-between">
                                                            <span>{item.name} x {oi.quantity}</span>
                                                            <span>${(item.price * oi.quantity).toFixed(2)}</span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>

                                            <p className="font-bold text-right">
                                                Total: ${order.order_items.reduce((acc: number, oi: OrderItem) => {
                                                    const item = menu.find(m => m.id === oi.menu_item_id);
                                                    return acc + (item ? item.price * oi.quantity : 0);
                                                }, 0).toFixed(2)}
                                            </p>

                                            {order.comment && <p className="italic text-gray-500">Comment: {order.comment}</p>}

                                        </div>
                                    ))
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
