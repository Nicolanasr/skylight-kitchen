"use client";

import React from "react";

export type TableHeaderActionsProps = {
  tableId: string;
  onReceiptTable: (tableId: string) => void;
  onReceiptName: (tableId: string) => void;
  onMarkPaid: (tableId: string) => void;
};

export default function TableHeaderActions({ tableId, onReceiptTable, onReceiptName, onMarkPaid }: TableHeaderActionsProps) {
  return (
    <div className="flex gap-2">
      <button className="px-3 py-1 bg-gray-600 rounded text-white" onClick={() => onReceiptTable(tableId)}>
        Receipt (Table)
      </button>
      <button className="px-3 py-1 bg-gray-600 rounded text-white" onClick={() => onReceiptName(tableId)}>
        Receipt / Name
      </button>
      <button className="px-3 py-1 bg-green-600 rounded text-white" onClick={() => onMarkPaid(tableId)}>
        Mark Paid
      </button>
    </div>
  );
}

