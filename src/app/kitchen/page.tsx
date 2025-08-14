"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Order, MenuItem } from "@/types";

export default function KitchenPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [menus, setMenus] = useState<MenuItem[]>([]);

    // Helper to sort orders by status
    const sortOrders = (orders: Order[]) => {
        const orderPriority: Record<string, number> = {
            pending: 0,
            preparing: 1,
            served: 2,
            paid: 3,
        };
        return orders.sort((a, b) => orderPriority[a.status] - orderPriority[b.status]);
    };

    const fetchMenus = async () => {
        const { data } = await supabase.from("menus").select("*");
        if (data) setMenus(data);
    };

    const fetchOrders = async () => {
        const { data } = await supabase
            .from("orders")
            .select("*")
            .order("created_at", { ascending: false });
        if (data) setOrders(sortOrders(data));
    };

    useEffect(() => {
        fetchMenus();
        fetchOrders();

        const subscription = supabase
            .channel("orders")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "orders" },
                () => fetchOrders()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    const updateStatus = async (orderId: number, status: string) => {
        const { error } = await supabase
            .from("orders")
            .update({ status })
            .eq("id", orderId);

        if (error) {
            alert("Failed to update status: " + error.message);
        } else {
            setOrders((prev) =>
                sortOrders(
                    prev.map((order) =>
                        order.id === orderId ? { ...order, status } : order
                    )
                )
            );
        }
    };

    // Helper to get menu item name by id
    const getMenuName = (id: number) => {
        const menu = menus.find((m) => m.id === id);
        return menu ? menu.name : `Menu ID ${id}`;
    };

    return (
        <div className="p-4 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Kitchen Orders</h1>
            <div className="space-y-4">
                {orders.map((order) => (
                    <div key={order.id} className="p-4 border rounded shadow">
                        <p>
                            <strong>Table:</strong> {order.table_id}
                        </p>
                        <p>
                            <strong>Status:</strong>{" "}
                            <span
                                className={
                                    order.status === "pending"
                                        ? "text-yellow-600 font-semibold"
                                        : order.status === "preparing"
                                            ? "text-blue-600 font-semibold"
                                            : order.status === "served"
                                                ? "text-purple-600 font-semibold"
                                                : "text-green-600 font-semibold"
                                }
                            >
                                {order.status}
                            </span>
                        </p>

                        {order.comment && (
                            <p className="mt-2">
                                <strong>Comment:</strong> {order.comment}
                            </p>
                        )}

                        <div className="mt-2">
                            <strong>Items:</strong>
                            <ul className="list-disc list-inside">
                                {order.order_items?.map((item) => (
                                    <li key={item.id}>
                                        {getMenuName(item.menu_item_id)} x {item.quantity}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Dynamic buttons */}
                        <div className="mt-2 space-x-2">
                            {order.status === "pending" && (
                                <button
                                    className="px-3 py-1 bg-yellow-500 text-white rounded"
                                    onClick={() => updateStatus(order.id, "preparing")}
                                >
                                    Mark Preparing
                                </button>
                            )}
                            {order.status === "preparing" && (
                                <button
                                    className="px-3 py-1 bg-purple-500 text-white rounded"
                                    onClick={() => updateStatus(order.id, "served")}
                                >
                                    Mark Served
                                </button>
                            )}
                            {order.status === "served" && (
                                <button
                                    className="px-3 py-1 bg-green-500 text-white rounded"
                                    onClick={() => updateStatus(order.id, "paid")}
                                >
                                    Mark Paid
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
