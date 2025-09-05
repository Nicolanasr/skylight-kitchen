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
            <label key={n} className="flex items-center gap-2">
              <input type="checkbox" checked={selectedNames.has(n)} onChange={() => onToggleName(n)} />
              <span>{n}</span>
            </label>
          ))}
          {names.length === 0 && (
            <p className="text-sm text-gray-500">No served orders to mark as paid.</p>
          )}
        </div>
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

