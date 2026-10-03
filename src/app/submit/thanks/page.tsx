import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ClearDraftOnMount from "../ClearDraftOnMount";
import NominateForm from "../NominateForm";

export const metadata: Metadata = {
  title: "Submission Received",
};

export default function SubmitThanksPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <ClearDraftOnMount />
      <SiteHeader />

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16 text-center">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
          Got it!
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-zinc-700">
          Your submission is in. Our team will review it and, once approved,
          your feature will go live on ThisIzATL.
        </p>

        <section className="mt-12 border-t border-zinc-200 pt-10 text-left">
          <h2 className="font-display text-2xl font-bold text-ink">
            Know Someone We Should Highlight?
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
            Nominate an artist, creator, or local figure doing great things in
            Atlanta. Just tell us who they are &mdash; add their email or
            Instagram if you have it so we can reach them.
          </p>
          <NominateForm />
        </section>

        <Link
          href="/"
          className="mt-10 inline-block rounded-full bg-brand px-6 py-2.5 font-medium text-white hover:bg-brand-dark"
        >
          Back to ThisIzATL
        </Link>
      </main>

      <SiteFooter />
    </div>
  );
}
