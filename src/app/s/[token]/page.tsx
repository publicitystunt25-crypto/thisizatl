import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SubmitForm from "@/app/submit/SubmitForm";
import { getTrustedSubmitter } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Partner Submission",
  robots: { index: false, follow: false },
};

// Private submit link for a trusted partner (e.g. a publicist). Same form as
// /submit, but the approval email goes straight to the partner.
export default async function TrustedSubmitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const submitter = await getTrustedSubmitter(token);
  if (!submitter) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">Submit a Story</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-zinc-600">
          Hi {submitter.name.split(" ")[0]}. Fill this out for the artist or person you want featured and we&rsquo;ll
          write it up. When you submit, the approval link is emailed straight to you. Review it, approve it, and it
          goes live.
        </p>
        <SubmitForm trustedToken={token} />
      </main>
      <SiteFooter />
    </div>
  );
}
