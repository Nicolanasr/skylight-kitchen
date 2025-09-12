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
                                    <td className="table-cell">{'$' + line.toFixed(2)}</td>
                                    <td className="table-cell">{'$' + (item.quantity * parseFloat(line.toFixed(2).toString()))}</td>
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
