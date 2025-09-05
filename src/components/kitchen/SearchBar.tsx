"use client";

import React, { useEffect, useState } from "react";

export type SearchBarProps = {
  value: string;
  onDebouncedChange: (v: string) => void;
  onClear: () => void;
  debounceMs?: number;
};

export default function SearchBar({ value, onDebouncedChange, onClear, debounceMs = 200 }: SearchBarProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    const id = setTimeout(() => onDebouncedChange(local), debounceMs);
    return () => clearTimeout(id);
  }, [local, debounceMs, onDebouncedChange]);

  return (
    <div className="mb-4 flex items-center gap-2">
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className="w-full max-w-md border rounded px-3 py-2"
        placeholder="Search items, name, or table #"
      />
      {local && (
        <button className="px-3 py-2 bg-gray-200 rounded" onClick={() => { setLocal(""); onClear(); }}>
          Clear
        </button>
      )}
    </div>
  );
}

