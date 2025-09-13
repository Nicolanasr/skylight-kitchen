"use client";

import React from "react";

type ExtraModalProps = {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children?: React.ReactNode;
};

export default function ExtraModal({ isOpen, onClose, title = "Extra Modal", children }: ExtraModalProps) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded shadow-lg w-11/12 max-w-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button className="px-2 py-1 bg-gray-100 rounded" onClick={onClose}>Close</button>
                </div>
                <div className="text-sm text-gray-700">
                    {children ?? (
                        <p>This is a new modal. Put your content here.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

