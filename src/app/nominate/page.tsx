import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import NominateChoices from "./NominateChoices";

export const metadata: Metadata = {
  title: "Nominate Someone",
  description: "Know someone in Atlanta we should highlight? Nominate them for ThisIzATL.",
};

export default function NominatePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
          Know Someone We Should Highlight?
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-zinc-600">
          Nominate an artist, creator, or local figure doing great things in
          Atlanta. Choose how you&rsquo;d like to nominate them below.
        </p>

        <NominateChoices submitUrl="https://thisizatl.com/submit" brandName="ThisIzATL" placeName="Atlanta" />
      </main>

      <SiteFooter />
    </div>
  );
}
