'use client';

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MenuItem } from "@/types";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function TablePage({ params }: { params: Promise<{ tableId: string }> }) {
    const { tableId } = React.use(params); // unwrap the promise
    const router = useRouter();

    const [menu, setMenu] = useState<MenuItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [cart, setCart] = useState<{ [key: number]: number }>({});
    const [comment, setComment] = useState<string>("");

    useEffect(() => {
        async function fetchMenu() {
            const { data } = await supabase.from("menus").select("*");
            setMenu(data || []);
        }
        fetchMenu();
    }, []);

    const categories = Array.from(new Set(menu.map(item => item.category)));

    const addToCart = (id: number) => {
        setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    };

    const submitOrder = async () => {
        if (Object.keys(cart).length === 0) return;

        const orderItems = Object.entries(cart).map(([menu_item_id, quantity]) => ({
            menu_item_id: Number(menu_item_id),
            quantity,
        }));

        await supabase.from("orders").insert([{
            table_id: tableId,
            order_items: orderItems,
            status: "pending",
            comment: comment || null,
        }]);

        setCart({});
        setComment("");
        alert("Order submitted!");
    };

    return (
        <div className="relative min-h-screen bg-gray-50">
            {/* Logo at the top */}
            <header className="flex items-center justify-center py-4 bg-white shadow sticky top-0 z-50">
                <Image
                    src="/logo.png" // replace with your logo path
                    alt="Restaurant Logo"
                    width={150}
                    height={50}
                    className="object-contain"
                />
            </header>

            <main className="p-4 max-w-5xl mx-auto">
                <h1 className="text-2xl font-bold mb-4 text-center">Table {tableId}</h1>

                {/* Categories Filter */}
                <div className="flex gap-2 mb-6 overflow-x-auto whitespace-nowrap">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-3 py-1 rounded ${selectedCategory === null ? "bg-blue-500 text-white" : "bg-gray-200"}`}
                    >
                        All
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-3 py-1 rounded ${selectedCategory === cat ? "bg-blue-500 text-white" : "bg-gray-200"}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Menu Grid */}
                {selectedCategory ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {menu.filter(item => item.category === selectedCategory).map(item => (
                            <div key={item.id} className="p-4 border rounded shadow flex flex-col">
                                {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-48 object-cover rounded mb-2" />}
                                <h2 className="font-semibold text-lg">{item.name}</h2>
                                {item.description && <p className="text-sm text-gray-600 mb-1">{item.description}</p>}
                                <p className="font-bold mt-1">${item.price.toFixed(2)}</p>
                                <button className="mt-2 px-3 py-1 bg-blue-500 text-white rounded" onClick={() => addToCart(item.id)}>Add</button>
                            </div>
                        ))}
                    </div>
                ) : (
                    categories.map(cat => {
                        const items = menu.filter(item => item.category === cat);
                        if (items.length === 0) return null;
                        return (
                            <div key={cat} className="mb-6">
                                <h2 className="text-xl font-bold mb-2">{cat}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {items.map(item => (
                                        <div key={item.id} className="p-4 border rounded shadow flex flex-col">
                                            {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-48 object-cover rounded mb-2" />}
                                            <h3 className="font-semibold text-lg">{item.name}</h3>
                                            {item.description && <p className="text-sm text-gray-600 mb-1">{item.description}</p>}
                                            <p className="font-bold mt-1">${item.price.toFixed(2)}</p>
                                            <button className="mt-2 px-3 py-1 bg-blue-500 text-white rounded" onClick={() => addToCart(item.id)}>Add</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })
                )}

                {/* Cart Summary */}
                {Object.keys(cart).length > 0 && (
                    <div className="mt-6 p-4 border rounded bg-gray-50" id="summary">
                        <h3 className="font-semibold mb-2">Order Summary</h3>
                        <ul className="space-y-1">
                            {Object.entries(cart).map(([id, qty]) => {
                                const item = menu.find(m => m.id === Number(id));
                                if (!item) return null;
                                return (
                                    <li key={id} className="flex justify-between">
                                        <span>{item.name} x {qty}</span>
                                        <span>${(item.price * qty).toFixed(2)}</span>
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="mt-3">
                            <label className="block mb-1 font-medium">Add a comment (optional):</label>
                            <textarea
                                className="w-full border rounded p-2"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="E.g., No onions, extra spicy..."
                                rows={3}
                            />
                        </div>

                        <p className="font-bold mt-2 text-right">
                            Total: ${Object.entries(cart).reduce((acc, [id, qty]) => {
                                const item = menu.find(m => m.id === Number(id));
                                return acc + (item ? item.price * qty : 0);
                            }, 0).toFixed(2)}
                        </p>

                        <button
                            className="mt-3 w-full px-4 py-2 bg-green-500 text-white rounded"
                            onClick={submitOrder}
                        >
                            Submit Order
                        </button>
                    </div>
                )}
            </main>

            {/* Floating Order Summary Button */}
            <button
                onClick={() => router.push("#summary")}
                className="fixed bottom-6 right-6 bg-green-500 text-white px-4 py-3 rounded-full shadow-lg hover:bg-green-600 transition-colors z-50"
            >
                Order Summary
            </button>
        </div>
    );
}
