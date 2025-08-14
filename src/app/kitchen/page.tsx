"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Order, OrderItem, MenuItem } from "@/types";

export default function KitchenPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

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
        new Date(utcDate).toLocaleString("en-US", { timeZone: "Asia/Beirut" });

    // Update order status
    const updateStatus = async (order: Order, nextStatus: string) => {
        await supabase.from("orders").update({ status: nextStatus }).eq("id", order.id);
    };

    // Show receipt (only for served orders)
    const showReceipt = (tableId: string) => {
        // Get all served orders for this table
        const servedOrders = orders.filter(
            (o) => o.table_id === tableId && o.status === "served"
        );

        if (servedOrders.length === 0) {
            alert(`No served orders for Table ${tableId}`);
            return;
        }

        let totalAmount = 0;
        const orderDetails = servedOrders
            .map((order) => {
                const itemsList = order.order_items
                    ?.map((item: OrderItem) => {
                        const menu = menuItems.find((m) => m.id === item.menu_item_id);
                        const price = menu?.price || 0; // menu item price
                        const itemTotal = price * item.quantity;
                        totalAmount += itemTotal;
                        return `${menu?.name || "Unknown"} x ${item.quantity} - $${itemTotal.toFixed(
                            2
                        )}`;
                    })
                    .join("\n");

                return `Order #${order.id} - Date: ${formatDate(order.created_at)}\nItems:\n${itemsList}\nComment: ${order.comment || "None"
                    }`;
            })
            .join("\n\n");

        alert(
            `Receipt for Table ${tableId}\n\n${orderDetails}\n\nTotal Amount: $${totalAmount.toFixed(
                2
            )}`
        );
    };

    // Define status order
    const statuses = ["pending", "preparing", "ready to be served", "served", "paid"];

    // Group orders by status → table
    const ordersByStatus: Record<string, Record<string, Order[]>> = {};
    statuses.forEach((status) => (ordersByStatus[status] = {}));

    orders.forEach((order) => {
        if (!ordersByStatus[order.status][order.table_id]) {
            ordersByStatus[order.status][order.table_id] = [];
        }
        ordersByStatus[order.status][order.table_id].push(order);
    });

    return (
        <div className="p-4 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Kitchen Orders</h1>

            {statuses.map((status) => (
                <div key={status} className="mb-6">
                    <h2 className="text-xl font-semibold mb-2 capitalize">{status}</h2>
                    {Object.keys(ordersByStatus[status]).length === 0 && (
                        <p className="text-gray-500">No orders</p>
                    )}

                    {Object.entries(ordersByStatus[status]).map(([tableId, tableOrders]) => (
                        <div key={tableId} className="mb-4 p-3 border rounded bg-gray-50">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-semibold">Table {tableId}</h3>
                                {/* Show Receipt button only if there are served orders */}
                                {orders.some((o) => o.table_id === tableId && o.status === "served") && (
                                    <button
                                        className="px-3 py-1 bg-gray-600 rounded text-white"
                                        onClick={() => showReceipt(tableId)}
                                    >
                                        Show Receipt
                                    </button>
                                )}
                            </div>

                            {tableOrders.map((order) => (
                                <div key={order.id} className="p-2 mb-2 border rounded bg-white">
                                    <p><strong>Order ID:</strong> {order.id}</p>
                                    <p><strong>Date:</strong> {formatDate(order.created_at)}</p>
                                    <p><strong>Comment:</strong> {order.comment || "None"}</p>
                                    <p><strong>Items:</strong></p>
                                    <ul className="ml-4 list-disc">
                                        {order.order_items?.map((item) => {
                                            const menu = menuItems.find((m) => m.id === item.menu_item_id);
                                            return (
                                                <li key={item.menu_item_id}>
                                                    {menu?.name || "Unknown"} x {item.quantity}
                                                </li>
                                            );
                                        })}
                                    </ul>

                                    <div className="mt-2 flex gap-2">
                                        {status === "pending" && (
                                            <button
                                                className="px-3 py-1 bg-yellow-400 rounded text-white"
                                                onClick={() => updateStatus(order, "preparing")}
                                            >
                                                Make Preparing
                                            </button>
                                        )}
                                        {status === "preparing" && (
                                            <button
                                                className="px-3 py-1 bg-blue-500 rounded text-white"
                                                onClick={() => updateStatus(order, "ready to be served")}
                                            >
                                                Make Ready to Serve
                                            </button>
                                        )}
                                        {status === "ready to be served" && (
                                            <button
                                                className="px-3 py-1 bg-orange-500 rounded text-white"
                                                onClick={() => updateStatus(order, "served")}
                                            >
                                                Make Served
                                            </button>
                                        )}
                                        {status === "served" && (
                                            <button
                                                className="px-3 py-1 bg-green-500 rounded text-white"
                                                onClick={() => updateStatus(order, "paid")}
                                            >
                                                Make Paid
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
