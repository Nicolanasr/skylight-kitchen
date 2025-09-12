"use client";

import React from "react";

type ChangeStatusModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (status: "pending" | "preparing" | "served") => void | Promise<void>;
};

export default function ChangeStatusModal({ isOpen, onClose, onSelect }: ChangeStatusModalProps) {
    if (!isOpen) return null;
    const statuses: Array<"pending" | "preparing" | "served"> = ["pending", "preparing", "served"];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={onClose} />
            <div className="relative bg-white rounded shadow-lg w-full max-w-sm p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Change Order Status</h3>
                    <button className="text-gray-500" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <div className="space-y-2">
                    {statuses.map((s) => (
                        <button
                            key={s}
                            className="w-full text-left px-3 py-2 border rounded capitalize hover:bg-gray-50"
                            onClick={() => onSelect(s)}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

