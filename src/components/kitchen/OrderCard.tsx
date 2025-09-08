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
    updateStatus: (order: Order, nextStatus: string) => void | Promise<void>;
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
    updateStatus,
    nowTs,
    isNew,
}: OrderCardProps) {
    const createdAt = new Date(`${order.created_at}Z`).getTime();
    const diffMinutes = Math.floor((((nowTs ?? Date.now()) - createdAt) / 60000));
    const timeColor = diffMinutes < 10 ? "text-green-600" : diffMinutes < 30 ? "text-yellow-600" : "text-red-600";

    const subtotal = getOrderSubtotal(order);
    const discount = getOrderDiscount(order, subtotal);
    const total = Math.max(0, subtotal - discount);

    return (
        <div className="p-2 mb-2 border rounded bg-white">
            <div className="text-sm">
                <div className="font-medium flex items-center gap-2">
                    <span>
                        #{order.id} - {formatDate(order.created_at)} — <span className={timeColor}>{diffMinutes} min ago</span>
                    </span>
                    {/** New badge */}
                    {Boolean(isNew) && (
                        <span className="inline-block text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">New</span>
                    )}
                </div>
                {order.comment && <div className="text-gray-700">Comments: {order.comment}</div>}
                <ul className="ml-4 list-disc mt-1">
                    {order.order_items?.map((item) => {
                        const menu = menuIndex[item.menu_item_id];
                        const unit = menu?.price || 0;
                        const line = unit * item.quantity;
                        return (
                            <li key={item.menu_item_id}>
                                <span className="mr-1">{highlightItemName(menu?.name || "Unknown")}</span>
                                x {item.quantity} — ${line.toFixed(2)}
                            </li>
                        );
                    })}
                </ul>
                <div className="mt-2 text-sm ml-4">
                    <div>Subtotal: ${subtotal.toFixed(2)}</div>
                    {discount > 0 && <div>Discount: -${discount.toFixed(2)}</div>}
                    <div className="font-semibold">Total: ${total.toFixed(2)}</div>
                </div>
            </div>

            <div className="mt-2 flex gap-2 flex-wrap">
                {status !== "paid" && (
                    <button className="px-3 py-1 bg-purple-600 rounded text-white" onClick={() => onEdit(order)}>
                        Edit
                    </button>
                )}
                {status === "pending" && (
                    <button className="px-3 py-1 bg-yellow-400 rounded text-white" onClick={() => updateStatus(order, "preparing")}>
                        Make Preparing
                    </button>
                )}
                {status === "preparing" && (
                    <button className="px-3 py-1 bg-blue-500 rounded text-white" onClick={() => updateStatus(order, "served")}>
                        Make Served
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
}

const OrderCard = memo(OrderCardBase);
export default OrderCard;
