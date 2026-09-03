"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface LogEntry {
  status: "published" | "skipped" | "error";
  title: string;
  detail: string;
}

export default function GenerateButton({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<LogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setLog(null);
    setOpen(true);
    try {
      const res = await fetch("/api/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unknown error");
      } else {
        setLog(data.log);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={handleClick}
        disabled={loading}
        className={
          compact
            ? "inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 disabled:opacity-50"
            : "rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        }
      >
        <svg
          className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" strokeLinecap="round" />
          <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {loading ? "Running…" : "Run pipeline"}
      </button>

      {open && (error || log) && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-lg border border-zinc-200 bg-white p-3 text-xs shadow-lg">
          {error && <div className="text-red-700">{error}</div>}
          {log && (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {log.map((entry, i) => (
                <div
                  key={i}
                  className={
                    entry.status === "published"
                      ? "text-green-700"
                      : entry.status === "error"
                      ? "text-red-700"
                      : "text-zinc-500"
                  }
                >
                  <span className="font-semibold">[{entry.status}]</span>{" "}
                  {entry.title} — {entry.detail}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
