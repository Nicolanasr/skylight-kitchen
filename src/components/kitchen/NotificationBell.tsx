"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type NotificationItem = {
    id: number;
    message: string;
    created_at: string;
    type?: string | null;
};

export type NotificationBellProps = {
    items: NotificationItem[];
    unreadIds: Set<number>;
    onMarkRead: (id: number) => void;
    onMarkAllRead: () => void;
    nowTs?: number;
    connected?: boolean;
};

export default function NotificationBell({ items, unreadIds, onMarkRead, onMarkAllRead, nowTs, connected }: NotificationBellProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (!ref.current) return;
            if (!ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("click", onClick);
        return () => document.removeEventListener("click", onClick);
    }, []);

    const unreadCount = unreadIds.size;
    const sorted = useMemo(() => [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [items]);

    const formatRelative = (iso: string) => {
        const ts = Date.parse(iso);
        if (Number.isNaN(ts)) return "";
        const now = nowTs ?? Date.now();
        const diff = Math.max(0, now - ts);
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return "just now";
        if (minutes < 60) return `${minutes} min ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hrs ago`;
        const days = Math.floor(hours / 24);
        return `${days} days ago`;
    };

    return (
        <div className="relative" ref={ref}>
            <button className="relative px-3 py-2 rounded bg-gray-100 hover:bg-gray-200" onClick={() => setOpen((v) => !v)} aria-label="Notifications">
                <span>🔔</span>
                <span className={`absolute -bottom-1 -left-1 w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} title={connected ? 'Realtime connected' : 'Realtime disconnected'} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {unreadCount}
                    </span>
                )}
            </button>
            {open && (
                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto bg-white border rounded shadow z-50">
                    <div className="p-2 flex items-center justify-between border-b bg-gray-50">
                        <div className="font-semibold text-sm">Notifications</div>
                        <button className="text-xs underline" onClick={onMarkAllRead} disabled={unreadCount === 0}>
                            Mark all as read
                        </button>
                    </div>
                    {sorted.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500">No notifications</div>
                    ) : (
                        <ul className="divide-y">
                            {sorted.map((n) => {
                                const isUnread = unreadIds.has(n.id);
                                return (
                                    <li key={n.id} className={`p-3 cursor-pointer ${isUnread ? "bg-yellow-50" : ""}`} onClick={() => onMarkRead(n.id)}>
                                        <div className="text-sm">{n.message}</div>
                                        <div className="text-xs text-gray-500">{formatRelative(n.created_at)}</div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
