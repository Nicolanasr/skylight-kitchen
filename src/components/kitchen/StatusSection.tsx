"use client";

import React, { memo } from "react";
import { MenuItem, Order, OrderItem } from "@/types";
import NameGroup from "./NameGroup";
import TableHeaderActions from "./TableHeaderActions";
import OrderCard from "./OrderCard";

export type StatusSectionProps = {
    status: string;
    tablesMap?: Record<string, Record<string, Order[]>>;
    orders?: Order[];
    paidExpanded: Record<string, boolean>;
    setPaidExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    menuIndex: Record<number, MenuItem | undefined>;
    highlightItemName: (text: string) => React.ReactNode;
    formatDate: (utc: string) => string;
    getOrderSubtotal: (order: Order) => number;
    getOrderDiscount: (order: Order, subtotal: number) => number;
    updateItemStatus: (order: Order, itemIndex: number, nextStatus: string) => void | Promise<void>;
    updateAllItemStatuses: (order: Order, nextStatus: string) => void | Promise<void>;
    onEdit: (order: Order) => void;
    onOpenChangeStatus: (order: Order) => void;
    onOpenReceiptForTable: (tableId: string) => void;
    onOpenReceiptForName: (tableId: string) => void;
    onOpenPayModal: (tableId: string) => void;
    nowTs?: number;
    isOrderNew?: (order: Order) => boolean;
};

function StatusSectionBase({
    status,
    tablesMap = {},
    orders,
    paidExpanded,
    setPaidExpanded,
    menuIndex,
    highlightItemName,
    formatDate,
    getOrderSubtotal,
    getOrderDiscount,
    updateItemStatus,
    updateAllItemStatuses,
    onEdit,
    onOpenReceiptForTable,
    onOpenChangeStatus,
    onOpenReceiptForName,
    onOpenPayModal,
    nowTs,
    isOrderNew,
}: StatusSectionProps) {
    if (orders) {
        return (
            <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2 capitalize">{status}</h2>
                {orders.length === 0 && <p className="text-gray-500">No orders</p>}
                {orders.map((order) => (
                    <div key={order.id} className="mb-3">
                        <div className="mb-1 font-medium">
                            Table {order.table_id} — {order.name || "Unknown"}
                        </div>
                        <OrderCard
                            order={order}
                            status={status}
                            menuIndex={menuIndex}
                            highlightItemName={highlightItemName}
                            formatDate={formatDate}
                            getOrderSubtotal={getOrderSubtotal}
                            getOrderDiscount={getOrderDiscount}
                            onEdit={onEdit}
                            onOpenChangeStatus={onOpenChangeStatus}
                            updateItemStatus={updateItemStatus}
                            updateAllItemStatuses={updateAllItemStatuses}
                            nowTs={nowTs}
                            isNew={isOrderNew ? isOrderNew(order) : false}
                        />
                    </div>
                ))}
            </div>
        );
    }

    const tableEntries = Object.entries(tablesMap).sort((a, b) =>
        String(a[0] ?? "").localeCompare(String(b[0] ?? ""), undefined, { numeric: true, sensitivity: "base" })
    );

    return (
        <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2 capitalize">{status}</h2>
            {tableEntries.length === 0 && <p className="text-gray-500">No orders</p>}

            {tableEntries.map(([tableId, namesMap]) => {
                const expKey = `${status}:${tableId}`;
                const content = (
                    <div className="mt-2">
                        {Object.entries(namesMap)
                            .sort(([a], [b]) => String(a ?? "").localeCompare(String(b ?? "")))
                            .map(([name, nameOrders]) => (
                                <NameGroup
                                    key={name}
                                    name={name}
                                    orders={nameOrders}
                                    status={status}
                                    menuIndex={menuIndex}
                                    highlightItemName={highlightItemName}
                                    formatDate={formatDate}
                                    getOrderSubtotal={getOrderSubtotal}
                                    getOrderDiscount={getOrderDiscount}
                                    onEdit={onEdit}
                                    updateItemStatus={updateItemStatus}
                                    onOpenChangeStatus={onOpenChangeStatus}
                                    nowTs={nowTs}
                                    isOrderNew={isOrderNew}
                                />
                            ))}
                    </div>
                );

                const tableHeaderActions = status === "served" && (
                    <TableHeaderActions
                        tableId={tableId}
                        onReceiptTable={onOpenReceiptForTable}
                        onReceiptName={onOpenReceiptForName}
                        onMarkPaid={onOpenPayModal}
                    />
                );

                const body = status === "paid" || status === "served" ? (
                    <>
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
                        {paidExpanded[expKey] && content}
                    </>
                ) : (
                    content
                );

                return (
                    <div key={tableId} className="mb-4 p-3 border rounded bg-gray-50">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-semibold">Table {tableId}</h3>
                            {tableHeaderActions}
                        </div>
                        {body}
                    </div>
                );
            })}
        </div>
    );
}

export default memo(StatusSectionBase);
