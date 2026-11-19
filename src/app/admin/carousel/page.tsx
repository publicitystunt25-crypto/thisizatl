import Link from "next/link";
import CarouselBuilder from "./CarouselBuilder";

export const dynamic = "force-dynamic";

export default function CarouselPage() {
  return (
    <div className="min-h-screen bg-cream">
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link href="/admin" className="text-sm text-brand-dark hover:underline">
          &larr; Back to admin
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink">Video carousel</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
          One Instagram post with a cover slide first, then your video clips as swipeable slides. Preview the cover, wait
          for every clip to finish uploading, then post.
        </p>
        <CarouselBuilder />
      </main>
    </div>
  );
}
