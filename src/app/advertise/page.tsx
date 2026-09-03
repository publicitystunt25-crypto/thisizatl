import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Advertise",
  description: "Advertise with ThisIzATL.",
};

export default function AdvertisePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
          Advertise with ThisIzATL
        </h1>

        <div className="mt-6 space-y-5 text-[17px] leading-relaxed text-zinc-800">
          <p>
            ThisIzATL reaches readers following Atlanta music, entertainment,
            and local culture. If you&rsquo;re a brand, artist, venue, or
            event promoter looking to get in front of that audience,
            we&rsquo;d like to hear from you.
          </p>

          <p>
            Reach out with what you have in mind — sponsored posts, banner
            placements, event promotion, or something else — and
            we&rsquo;ll follow up with details and rates.
          </p>

          <a
            href="mailto:info@thisizatl.com?subject=Advertising%20Inquiry"
            className="inline-block rounded-full bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
          >
            info@thisizatl.com
          </a>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
