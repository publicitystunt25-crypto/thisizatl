import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Submission Received",
};

export default function SubmitThanksPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16 text-center">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
          Got it!
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-zinc-700">
          Your submission is in. Our team will review it and, once approved,
          your feature will go live on ThisIzATL.
        </p>
        <p className="mt-4 text-[17px] leading-relaxed text-zinc-700">
          Don&rsquo;t forget to email a photo to{" "}
          <a href="mailto:info@thisizatl.com" className="font-medium text-brand-dark hover:underline">
            info@thisizatl.com
          </a>{" "}
          if you haven&rsquo;t already.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full bg-brand px-6 py-2.5 font-medium text-white hover:bg-brand-dark"
        >
          Back to ThisIzATL
        </Link>
      </main>

      <SiteFooter />
    </div>
  );
}
