"use client";

import React, { useEffect, useRef, useState } from 'react';

// Minimal type for WakeLock sentinel without adding lib dom typings
type WakeLockSentinel = { release: () => Promise<void> } | null;

export default function KeepAwakeToggle() {
    const [enabled, setEnabled] = useState(false);
    const wakeLockRef = useRef<WakeLockSentinel>(null);

    useEffect(() => {
        let released = false;
        async function requestLock() {
            try {
                const wl = await navigator.wakeLock?.request('screen');
                wakeLockRef.current = wl;
                wl?.addEventListener?.('release', () => {
                    if (!released) setEnabled(false);
                });
            } catch (_) {
                // ignore
            }
        }
        if (enabled) requestLock();
        return () => {
            released = true;
            try { wakeLockRef.current?.release?.(); } catch (_) { }
            wakeLockRef.current = null;
        };
    }, [enabled]);

    return (
        <button
            className={`px-2 py-1 rounded ${enabled ? 'bg-amber-500 text-white' : 'bg-gray-200'}`}
            title="Prevent screen sleep"
            onClick={() => setEnabled((v) => !v)}
        >
            {enabled ? 'Keep Awake: On' : 'Keep Awake'}
        </button>
    );
}
