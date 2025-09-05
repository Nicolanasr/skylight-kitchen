"use client";

import React from "react";

type ReceiptItem = {
    itemName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
};

export type ReceiptModalProps = {
    isOpen: boolean;
    scope: "table" | "name" | null;
    tableId: string | null;
    name: string | null;
    namesForTable: string[];
    items: ReceiptItem[];
    discount: number;
    total: number;
    paperWidth: "80mm" | "57mm" | "3.125in";
    onClose: () => void;
    onSelectName: (name: string) => void;
    onPrint: () => void;
    setPaperWidth: (w: "80mm" | "57mm" | "3.125in") => void;
    highlightItemName: (text: string) => React.ReactNode;
};

export default function ReceiptModal({
    isOpen,
    scope,
    tableId,
    name,
    namesForTable,
    items,
    discount,
    total,
    paperWidth,
    onClose,
    onSelectName,
    onPrint,
    setPaperWidth,
    highlightItemName,
}: ReceiptModalProps) {
    if (!isOpen) return null;

    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow w-11/12 max-w-2xl max-h-[85vh] overflow-auto p-4">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-semibold">Receipt</h2>
                    <div className="flex items-center gap-2">
                        <label className="text-sm">Paper</label>
                        <select
                            className="border rounded px-2 py-1 text-sm"
                            value={paperWidth}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            onChange={(e) => setPaperWidth(e.target.value as any)}
                        >
                            <option value="80mm">80mm</option>
                            <option value="57mm">57mm</option>
                            <option value="3.125in">3.125in</option>
                        </select>
                    </div>
                </div>

                <div className="text-sm text-gray-600 mb-2">
                    {scope === "name"
                        ? `Table ${tableId} — Select a name`
                        : `Table ${tableId}`}
                </div>

                {scope === "name" && (
                    <div className="mb-3">
                        <label className="block text-sm mb-1">Customer</label>
                        <select
                            className="border rounded p-2 w-full"
                            value={name ?? ""}
                            onChange={(e) => onSelectName(e.target.value)}
                        >
                            <option value="" disabled>
                                Select name...
                            </option>
                            {namesForTable.map((n) => (
                                <option key={n} value={n}>
                                    {n}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {items.length > 0 ? (
                    <div className="text-sm">
                        <div className="border-t border-dashed my-2"></div>
                        {items.map((it, idx) => (
                            <div key={idx} className="flex items-baseline">
                                <div className="flex-1 pr-2">{highlightItemName(it.itemName)}</div>
                                <div className="w-12 text-right">x {it.quantity}</div>
                                <div className="w-16 text-right">{`$${it.lineTotal.toFixed(2)}`}</div>
                            </div>
                        ))}
                        <div className="border-t border-dashed my-2"></div>
                        <div className="flex text-xs">
                            <div className="flex-1"></div>
                            <div className="w-24 text-right">Subtotal</div>
                            <div className="w-20 text-right">{`$${subtotal.toFixed(2)}`}</div>
                        </div>
                        <div className="flex text-xs">
                            <div className="flex-1"></div>
                            <div className="w-24 text-right">Discount</div>
                            <div className="w-20 text-right">{`-$${discount.toFixed(2)}`}</div>
                        </div>
                        <div className="flex font-semibold">
                            <div className="flex-1"></div>
                            <div className="w-24 text-right">Total</div>
                            <div className="w-20 text-right">{`$${total.toFixed(2)}`}</div>
                        </div>
                    </div>
                ) : scope === "name" && name === null ? null : (
                    <p className="text-sm text-gray-500">No items to display.</p>
                )}

                <div className="mt-4 flex justify-end gap-2">
                    <button className="px-3 py-1 bg-gray-200 rounded" onClick={onClose}>
                        Close
                    </button>
                    <button
                        className="px-3 py-1 bg-green-600 text-white rounded"
                        onClick={onPrint}
                    >
                        Print
                    </button>
                </div>
            </div>
        </div>
    );
}

