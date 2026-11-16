import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SubmitForm from "@/app/submit/SubmitForm";
import type { TrustedSubmitter } from "@/lib/db";

// The page body for a trusted partner's submit link (private /s/<token> or a
// public vanity link like /tia). Same form as /submit, but the approval email
// goes straight to the partner.
export default function TrustedSubmitView({ submitter }: { submitter: TrustedSubmitter }) {
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
        <SubmitForm trustedToken={submitter.token} />
      </main>
      <SiteFooter />
    </div>
  );
}
