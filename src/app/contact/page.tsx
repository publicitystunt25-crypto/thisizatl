import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with ThisIzATL.",
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
          Contact
        </h1>

        <div className="mt-6 space-y-5 text-[17px] leading-relaxed text-zinc-800">
          <p>
            Got a tip, a correction, a takedown request, or just want to say
            what&rsquo;s up? Reach out below.
          </p>

          <a
            href="mailto:info@thisizatl.com"
            className="inline-block rounded-full bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
          >
            info@thisizatl.com
          </a>

          <p className="text-sm text-zinc-500">
            For advertising inquiries, see our{" "}
            <a href="/advertise" className="text-brand-dark hover:underline">
              Advertise
            </a>{" "}
            page.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
