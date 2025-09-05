"use client";

import React from "react";

export type PayModalProps = {
  isOpen: boolean;
  tableId: string | null;
  names: string[];
  selectedNames: Set<string>;
  selectAll: boolean;
  onToggleName: (name: string) => void;
  onToggleAll: () => void;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  amountsByName?: Record<string, number>;
  selectedTotal?: number;
  grandTotal?: number;
};

export default function PayModal({
  isOpen,
  tableId,
  names,
  selectedNames,
  selectAll,
  onToggleName,
  onToggleAll,
  onConfirm,
  onClose,
  amountsByName,
  selectedTotal,
  grandTotal,
}: PayModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow w-11/12 max-w-md max-h-[85vh] overflow-auto p-4 relative">
        <button className="absolute top-2 right-2 px-2 py-1 bg-gray-200 rounded" onClick={onClose}>
          Close
        </button>
        <h2 className="text-lg font-semibold mb-2">Mark Paid — Table {tableId}</h2>
        <div className="mb-2 flex items-center gap-2">
          <input id="pay-all" type="checkbox" checked={selectAll} onChange={onToggleAll} />
          <label htmlFor="pay-all">Select All</label>
        </div>
        <div className="space-y-2">
          {names.map((n) => (
            <label key={n} className="flex items-center gap-2 justify-between">
              <input type="checkbox" checked={selectedNames.has(n)} onChange={() => onToggleName(n)} />
              <span className="flex-1 ml-1">{n}</span>
              {amountsByName && (
                <span className="text-sm tabular-nums">${(amountsByName[n] ?? 0).toFixed(2)}</span>
              )}
            </label>
          ))}
          {names.length === 0 && (
            <p className="text-sm text-gray-500">No served orders to mark as paid.</p>
          )}
        </div>
        {(amountsByName && names.length > 0) && (
          <div className="mt-3 border-t pt-2 text-sm flex flex-col gap-1">
            <div className="flex justify-between"><span>Selected Total</span><span className="font-medium">${(selectedTotal ?? 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Order Total</span><span className="font-semibold">${(grandTotal ?? 0).toFixed(2)}</span></div>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button className="px-3 py-1 bg-gray-200 rounded" onClick={onClose}>
            Cancel
          </button>
          <button
            className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50"
            onClick={onConfirm}
            disabled={names.length === 0 || (!selectAll && selectedNames.size === 0)}
          >
            Confirm Paid
          </button>
        </div>
      </div>
    </div>
  );
}
