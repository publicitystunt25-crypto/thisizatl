"use client";

import { useState } from "react";

export default function ScheduleControl({
  postTitle,
  minValue,
  action,
}: {
  postTitle: string;
  minValue: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-medium text-blue-700 hover:underline"
      >
        Schedule
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-base font-bold text-ink">
              Schedule &ldquo;{postTitle}&rdquo;
            </h3>
            <form action={action} className="mt-4 space-y-4">
              <input
                type="datetime-local"
                name="scheduledFor"
                required
                min={minValue}
                autoFocus
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
              <div className="flex justify-end gap-4 text-sm">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-zinc-500 hover:underline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-brand px-4 py-1.5 font-medium text-white hover:bg-brand-dark"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
