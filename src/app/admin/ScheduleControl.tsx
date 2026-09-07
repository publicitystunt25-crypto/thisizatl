"use client";

import { useState } from "react";

export default function ScheduleControl({
  minValue,
  action,
}: {
  minValue: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-medium text-blue-700 hover:underline"
      >
        Schedule
      </button>
    );
  }

  return (
    <form action={action} className="flex w-full basis-full flex-wrap items-center gap-1">
      <input
        type="datetime-local"
        name="scheduledFor"
        required
        min={minValue}
        autoFocus
        className="rounded border border-zinc-300 px-1 py-0.5 text-xs"
      />
      <button type="submit" className="font-medium text-blue-700 hover:underline">
        Confirm
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-zinc-400 hover:underline"
      >
        Cancel
      </button>
    </form>
  );
}
