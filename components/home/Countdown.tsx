"use client";

import { useEffect, useState } from "react";

function parts(msLeft: number) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return [
    ["DAYS", Math.floor(s / 86400)],
    ["HRS", Math.floor((s % 86400) / 3600)],
    ["MIN", Math.floor((s % 3600) / 60)],
    ["SEC", s % 60],
  ] as const;
}

export default function Countdown({ closesAt }: { closesAt: string }) {
  // Render dashes on the server; start ticking after hydration.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = now === null ? null : new Date(closesAt).getTime() - now;

  return (
    <div className="flex gap-8">
      {parts(remaining ?? 0).map(([unit, value]) => (
        <div key={unit}>
          <div className="display text-3xl tabular-nums">
            {remaining === null ? "--" : String(value).padStart(2, "0")}
          </div>
          <div className="label mt-2 text-muted">{unit}</div>
        </div>
      ))}
    </div>
  );
}
