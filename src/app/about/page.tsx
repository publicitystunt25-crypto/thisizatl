import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "About",
  description: "The pulse of Atlanta music, entertainment, and culture.",
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
            Atlanta doesn&rsquo;t follow the culture — it builds it. From the
            studios in the West End to the stages at State Farm Arena, this
            city has shaped the sound of a generation, and ThisIzATL is here
            to cover every bit of it.
          </p>

          <p>
            We&rsquo;re your source for the music, the moves, and the moments
            that matter in the A — new drops from the artists putting on for
            the city, the industry news shaping where hip-hop and R&amp;B go
            next, the entertainment stories everyone&rsquo;s talking about,
            and the events worth showing up for. Concerts, culture, comebacks,
            controversy — if it&rsquo;s moving in Atlanta, it&rsquo;s moving
            through here.
          </p>

          <p>
            This isn&rsquo;t just news about Atlanta. It&rsquo;s Atlanta,
            told the way Atlanta tells it.
          </p>

          <p className="font-display text-xl font-bold text-ink">
            ThisIz<span className="text-brand">ATL</span>.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
