"use client";

import { useFormStatus } from "react-dom";

// Writing the article (Claude) and processing the photo can take several
// seconds with zero visible feedback otherwise -- without this, people
// assume the click didn't register and submit again, creating duplicates.
export default function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-brand py-3 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Submitting… this can take a few seconds" : "Submit for Review"}
    </button>
  );
}
