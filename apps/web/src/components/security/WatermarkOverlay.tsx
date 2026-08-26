"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/stores/auth";
import { useSecurityStore } from "@/stores/security";

export default function WatermarkOverlay() {
  const enabled = useSecurityStore((s) => s.watermarkEnabled);
  const email = useAuthStore((s) => s.user?.email ?? "");

  const tiles = useMemo(() => {
    const rows: { top: string; left: string; rotate: number; text: string }[] = [];
    if (!enabled) return rows;
    const stamp = `${email || "restricted"} · ${new Date().toLocaleString()}`;
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        rows.push({
          top: `${row * 12.5}%`,
          left: `${col * 20 - 6}%`,
          rotate: -24,
          text: stamp,
        });
      }
    }
    return rows;
  }, [enabled, email]) as readonly { top: string; left: string; rotate: number; text: string }[];

  if (!enabled) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] select-none overflow-hidden"
    >
      {tiles.map((tile, index) => (
        <span
          key={index}
          className="absolute whitespace-nowrap font-mono text-xs text-white/[0.05]"
          style={{ top: tile.top, left: tile.left, transform: `rotate(${tile.rotate}deg)` }}
        >
          {tile.text}
        </span>
      ))}
    </div>
  );
}
