"use client";

import { useEffect, useMemo, useState } from "react";

function formatMs(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function useCountdown(expiresAtIso: string, active: boolean) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active]);

  return useMemo(() => {
    const expiresAt = new Date(expiresAtIso).getTime();
    const remainingMs = Math.max(0, expiresAt - now);

    return {
      remainingMs,
      expired: remainingMs <= 0,
      label: formatMs(remainingMs),
    };
  }, [expiresAtIso, now]);
}
