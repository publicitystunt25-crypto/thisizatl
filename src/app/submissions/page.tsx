import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SubmitForm from "./SubmitForm";

export const metadata: Metadata = {
  title: "Submit Your Music (Test)",
  robots: { index: false, follow: false },
};

export default function TestSubmissionsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          This is a test version of the submission form with the photo upload restored, used to check
          whether uploads are still being blocked. It is not linked from the site.
        </div>
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
          Get Featured on ThisIzATL
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-zinc-600">
          Atlanta artist with new music out, or another local figure worth
          featuring? Tell us about yourself below and we&rsquo;ll write you
          up. Submissions are reviewed before they go live, so make sure
          everything below is accurate.
        </p>

        <SubmitForm />
      </main>

      <SiteFooter />
    </div>
  );
}
