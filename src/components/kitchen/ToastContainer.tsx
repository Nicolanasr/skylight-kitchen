"use client";

import React from "react";

export type Toast = { id: number; message: string };

export default function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
    return (
        <div className="fixed top-4 right-4 z-50 space-y-2 left-4 text-center">
            {toasts.map((t) => (
                <div key={t.id} className="bg-yellow-500 text-white px-3 py-2 rounded shadow min-w-[200px] flex items-start gap-2">
                    <span className="flex-1 text-sm">{t.message}</span>
                    <button className="text-xs underline" onClick={() => onDismiss(t.id)}>
                        Dismiss
                    </button>
                </div>
            ))}
        </div>
    );
}

