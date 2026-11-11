"use client";

import { useFormStatus } from "react-dom";

const buttonClasses =
  "rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60";

// Writing a draft takes several seconds (Claude writes it, then the photos are
// processed), so the button says so while it works.
export function DraftButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Writing draft… (can take up to a minute)" : "Make a draft article"}
    </button>
  );
}

export function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm("Delete this request and its photos? This can't be undone.")) e.preventDefault();
      }}
      className={`${buttonClasses} text-red-700 hover:bg-red-50`}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
