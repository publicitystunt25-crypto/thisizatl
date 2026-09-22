"use client";

import { useFormStatus } from "react-dom";

// Saving (photo resize/focus-detection, plus a Facebook share on publish)
// can take several seconds with no visible feedback otherwise -- without
// this, a slow save reads as "nothing happened" and gets clicked again,
// creating duplicate posts (and duplicate Facebook posts) for the same
// article.
export default function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving… this can take a few seconds" : label}
    </button>
  );
}
