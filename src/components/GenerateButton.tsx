"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LogEntry {
  status: "published" | "skipped" | "error";
  title: string;
  detail: string;
}

export default function GenerateButton() {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<LogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    setError(null);
    setLog(null);
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
    <div className="mb-8">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded bg-black text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Pulling Atlanta music news…" : "Run news pipeline now"}
      </button>

      {error && (
        <div className="mt-3 rounded bg-red-50 border border-red-200 text-red-800 text-sm p-3">
          {error}
        </div>
      )}

      {log && (
        <div className="mt-3 text-sm space-y-1">
          {log.map((entry, i) => (
            <div
              key={i}
              className={
                entry.status === "published"
                  ? "text-green-700"
                  : entry.status === "error"
                  ? "text-red-700"
                  : "text-gray-500"
              }
            >
              [{entry.status}] {entry.title} — {entry.detail}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
