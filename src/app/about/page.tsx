import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "About",
  description: "What ThisIzATL is and how it works.",
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
          About ThisIzATL
        </h1>

        <div className="mt-6 space-y-5 text-[17px] leading-relaxed text-zinc-800">
          <p>
            ThisIzATL covers Atlanta music, entertainment, and local news —
            written and published automatically. We pull from Atlanta&rsquo;s
            own outlets and a curated set of national outlets that regularly
            cover the city, and use Claude (Anthropic&rsquo;s AI) to turn the
            facts of each story into a short, original write-up.
          </p>

          <h2 className="font-display text-xl font-bold text-ink">
            How it works
          </h2>
          <p>
            Several times a day, our system checks a set of Atlanta-focused
            news sources for new stories. For each one, Claude extracts the
            underlying facts and writes an independent summary in its own
            words — never a copy-paste or a close paraphrase of the original
            reporting. Before publishing, it also runs a duplicate check
            against everything we&rsquo;ve already posted, so the same story
            from multiple outlets doesn&rsquo;t show up twice.
          </p>

          <h2 className="font-display text-xl font-bold text-ink">
            Sourcing &amp; credit
          </h2>
          <p>
            Every post on ThisIzATL links back to the original outlet(s) it
            was based on, visible at the bottom of the article. If you&rsquo;re
            one of those outlets and have a concern about how your reporting
            was used, please{" "}
            <a href="/contact" className="text-brand-dark hover:underline">
              reach out
            </a>{" "}
            — we take that seriously.
          </p>

          <h2 className="font-display text-xl font-bold text-ink">Photos</h2>
          <p>
            Article photos are stock images sourced from Pexels, chosen to
            match the story&rsquo;s topic — they are not photos of the actual
            people or events described, and each is credited to its
            photographer.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
