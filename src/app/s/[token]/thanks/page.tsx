import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = { title: "Submitted", robots: { index: false, follow: false } };

export default async function TrustedThanksPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">Story submitted</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-zinc-600">
          Check your email in a minute or two. We sent you a link to review the article. Approve it there and it goes live.
        </p>
        <Link href={`/s/${token}`} className="mt-6 inline-block text-sm font-medium text-brand-dark hover:underline">
          Submit another story
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
