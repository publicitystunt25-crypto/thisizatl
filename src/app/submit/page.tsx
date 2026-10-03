import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SubmitForm from "./SubmitForm";
import NominateForm from "./NominateForm";

export const metadata: Metadata = {
  title: "Submit Your Music",
  description: "Atlanta artists and local figures: submit your story and get featured on ThisIzATL.",
};

export default function SubmitPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
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

        <section className="mt-14 border-t border-zinc-200 pt-10">
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
      </main>

      <SiteFooter />
    </div>
  );
}
