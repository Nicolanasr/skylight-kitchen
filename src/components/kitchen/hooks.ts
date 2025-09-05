"use client";

import { useEffect, useState } from "react";

export function useNowTick(intervalMs = 60000) {
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return nowTs;
}

