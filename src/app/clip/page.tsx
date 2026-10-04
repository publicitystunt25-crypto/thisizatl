import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { cloudinaryConfig } from "@/lib/cloudinary";
import ClipForm from "./ClipForm";

export const metadata: Metadata = {
  title: "Submit a Clip",
  description: "Send ThisIzATL your video clip to be shared on Instagram.",
  robots: { index: false, follow: false },
};

// Reads env vars at request time, so it can't be prerendered at build time.
export const dynamic = "force-dynamic";

export default function ClipPage() {
  const available = cloudinaryConfig() !== null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
          Submit a Clip to ThisIzATL
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-zinc-600">
          Got a video you want us to share? Upload it below with a caption. If
          we post it on our Instagram, we&rsquo;ll tag you.
        </p>

        {available ? (
          <ClipForm />
        ) : (
          <p className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
            Clip uploads aren&rsquo;t open just yet &mdash; check back soon.
          </p>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
