"use client";

import React, { memo } from "react";
import { MenuItem, Order } from "@/types";
import NameGroup from "./NameGroup";
import TableHeaderActions from "./TableHeaderActions";

export type StatusSectionProps = {
  status: string;
  tablesMap: Record<string, Record<string, Order[]>>;
  paidExpanded: Record<string, boolean>;
  setPaidExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  menuIndex: Record<number, MenuItem | undefined>;
  highlightItemName: (text: string) => React.ReactNode;
  formatDate: (utc: string) => string;
  getOrderSubtotal: (order: Order) => number;
  getOrderDiscount: (order: Order, subtotal: number) => number;
  updateStatus: (order: Order, nextStatus: string) => void | Promise<void>;
  onEdit: (order: Order) => void;
  onOpenReceiptForTable: (tableId: string) => void;
  onOpenReceiptForName: (tableId: string) => void;
  onOpenPayModal: (tableId: string) => void;
  nowTs?: number;
  isOrderNew?: (order: Order) => boolean;
};

function StatusSectionBase({
  status,
  tablesMap,
  paidExpanded,
  setPaidExpanded,
  menuIndex,
  highlightItemName,
  formatDate,
  getOrderSubtotal,
  getOrderDiscount,
  updateStatus,
  onEdit,
  onOpenReceiptForTable,
  onOpenReceiptForName,
  onOpenPayModal,
  nowTs,
  isOrderNew,
}: StatusSectionProps) {
  const tableEntries = Object.entries(tablesMap).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: "base" }));

  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-2 capitalize">{status}</h2>
      {tableEntries.length === 0 && <p className="text-gray-500">No orders</p>}

      {tableEntries.map(([tableId, namesMap]) => {
        const expKey = `${status}:${tableId}`;
        const content = (
          <div className="mt-2">
            {Object.entries(namesMap)
              .sort(([a], [b]) => a.localeCompare(b))
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
                  updateStatus={updateStatus}
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
