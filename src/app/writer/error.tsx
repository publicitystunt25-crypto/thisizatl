"use client";

// Without this, a thrown error in a writer server action (a timeout, a bad
// upload, anything) left the page just sitting there with no feedback --
// indistinguishable from a genuinely stuck save. This turns that into a
// visible message with a way to try again instead of a silent dead end.
export default function WriterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
      <p className="font-display text-lg font-bold text-ink">Something went wrong saving that.</p>
      <p className="max-w-sm text-sm text-zinc-500">
        {error.message || "The save didn't go through. Your title and body may still be filled in if you go back."}
      </p>
      <button
        onClick={reset}
        className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
      >
        Try again
      </button>
    </div>
  );
}
