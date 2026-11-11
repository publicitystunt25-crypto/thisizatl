import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PitchForm from "./PitchForm";

export const metadata: Metadata = {
  title: "Request Coverage",
  description:
    "Artists, publicists, managers and brands: send ThisIzATL an interview, feature, premiere or event coverage request.",
};

export default function PitchPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">Request Coverage</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-zinc-600">
          Have a website feature, artist spotlight, premiere or event you want ThisIzATL to cover?
          Artists, publicists, managers, labels and brands are all welcome &mdash; tell us what you
          have and link your press kit if you&rsquo;ve got one.
        </p>

        <PitchForm />
      </main>

      <SiteFooter />
    </div>
  );
}
