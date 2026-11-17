import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SubmitForm from "./SubmitForm";

export const metadata: Metadata = {
  title: "Submit Your Music",
  description: "Atlanta artists and local figures: submit your story and get featured on ThisIzATL.",
};

export default async function SubmitPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const forFriend = (await searchParams).for === "friend";
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
        <p className="mt-2 text-sm text-zinc-500">
          Publicist, manager, or brand pitching an artist, release, or event?
          Send a{" "}
          <a href="/pitch" className="text-brand-dark hover:underline">
            coverage request
          </a>{" "}
          instead.
        </p>

        {forFriend && (
          <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
            You&rsquo;re submitting on a friend&rsquo;s behalf. Use <strong>their</strong> name, links and
            details below, and their email if you have it so we can let them know when it&rsquo;s live.
          </p>
        )}

        <SubmitForm />
      </main>

      <SiteFooter />
    </div>
  );
}
