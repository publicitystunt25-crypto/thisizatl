"use client";

import { useState } from "react";
import NominateForm from "./NominateForm";

type Choice = "submit" | "send" | "tell" | null;

// After choosing to nominate a friend there are three ways to go: fill in the
// submission form for them, send them the form to fill in themselves, or just
// tell us who they are.
export default function NominateChoices({
  submitUrl,
  brandName,
  placeName,
}: {
  submitUrl: string;
  brandName: string;
  placeName: string;
}) {
  const [choice, setChoice] = useState<Choice>(null);
  const [copied, setCopied] = useState(false);

  const message = `Check out ${brandName}: they feature artists in ${placeName}. You can submit your music here: ${submitUrl}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(`Get featured on ${brandName}`)}&body=${encodeURIComponent(message)}`;
  const textHref = `sms:?&body=${encodeURIComponent(message)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(submitUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", submitUrl);
    }
  }

  async function shareLink() {
    try {
      await navigator.share({ title: `Get featured on ${brandName}`, text: message, url: submitUrl });
    } catch {
      // cancelled or unsupported: nothing to do
    }
  }

  const card =
    "w-full rounded-xl border border-zinc-300 bg-white p-4 text-left hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400";
  const button =
    "inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800";

  if (choice === "tell") {
    return (
      <div>
        <button type="button" onClick={() => setChoice(null)} className="mt-6 text-sm text-zinc-600 underline">
          &larr; Back to your options
        </button>
        <NominateForm />
      </div>
    );
  }

  if (choice === "send") {
    return (
      <div className="mt-6">
        <button type="button" onClick={() => setChoice(null)} className="text-sm text-zinc-600 underline">
          &larr; Back to your options
        </button>
        <h2 className="mt-3 font-display text-xl font-bold text-ink">Send them the submission form</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Pick how you want to send it. A message with the link is ready to go, and you choose who gets it.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={emailHref} className={button}>Email it</a>
          <a href={textHref} className={button}>Text it</a>
          <button type="button" onClick={copyLink} className={button}>
            {copied ? "Copied!" : "Copy link"}
          </button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button type="button" onClick={shareLink} className={button}>Share&hellip;</button>
          )}
        </div>
        <p className="mt-3 break-all text-xs text-zinc-500">{submitUrl}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <a href={`/submit?for=friend`} className={`${card} block`}>
        <span className="block font-medium text-ink">Submit for them</span>
        <span className="mt-1 block text-sm text-zinc-600">
          Fill out the submission form on their behalf. You&rsquo;ll need their details and links.
        </span>
      </a>
      <button type="button" onClick={() => setChoice("send")} className={card}>
        <span className="block font-medium text-ink">Send them the submission form</span>
        <span className="mt-1 block text-sm text-zinc-600">
          Email or text them the link so they can submit themselves.
        </span>
      </button>
      <button type="button" onClick={() => setChoice("tell")} className={card}>
        <span className="block font-medium text-ink">Just tell us who they are</span>
        <span className="mt-1 block text-sm text-zinc-600">
          Leave their name, and an email or Instagram if you have it. We&rsquo;ll reach out.
        </span>
      </button>
    </div>
  );
}
