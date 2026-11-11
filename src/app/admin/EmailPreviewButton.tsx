"use client";

import { useFormStatus } from "react-dom";

// Sends a real email to an outside person, so it asks first.
export default function EmailPreviewButton({ email, sentLabel }: { email: string; sentLabel: string | null }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title={sentLabel ? `Review link last emailed ${sentLabel}` : `Email a review link to ${email}`}
      onClick={(e) => {
        const message = sentLabel
          ? `A review link was already emailed to ${email} on ${sentLabel}. Send it again?`
          : `Email a review link to ${email}? They'll be able to approve it, schedule it, or request changes.`;
        if (!window.confirm(message)) e.preventDefault();
      }}
      className="font-medium text-brand-dark hover:underline disabled:opacity-60"
    >
      {pending ? "Sending…" : sentLabel ? "Send for approval ✓" : "Send for approval"}
    </button>
  );
}
