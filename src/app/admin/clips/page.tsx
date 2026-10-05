import Link from "next/link";
import Image from "next/image";
import { listVideoSubmissions, type VideoSubmission } from "@/lib/db";
import { formatShortDateTime } from "@/lib/date";
import { extractInstagramHandle } from "@/lib/social";
import ClipCard, { type ClipCardData } from "./ClipCard";

export const dynamic = "force-dynamic";

// A starting point for the on-video headline: the submitter's first sentence,
// trimmed to fit. It's only a suggestion -- the editor always rewrites it.
function suggestHeadline(caption: string): string {
  const firstSentence = caption.split(/(?<=[.!?])\s/)[0] ?? caption;
  const flat = firstSentence.replace(/\s+/g, " ").trim();
  return flat.length <= 80 ? flat : flat.slice(0, 77).trimEnd() + "…";
}

function toCardData(s: VideoSubmission): ClipCardData {
  const handle = extractInstagramHandle(s.submitter_instagram);
  return {
    id: s.id,
    name: s.submitter_name,
    instagram: handle ? `@${handle}` : s.submitter_instagram,
    email: s.submitter_email,
    submitterCaption: s.caption,
    videoUrl: s.video_url,
    durationSeconds: s.duration_seconds,
    status: s.status === "posting" ? "posting" : s.status === "failed" ? "failed" : "pending",
    error: s.error,
    createdLabel: formatShortDateTime(s.created_at),
    defaultHeadline: s.headline ?? suggestHeadline(s.caption),
    defaultCaption: s.ig_caption ?? s.caption,
    defaultCollaborator: handle ? `@${handle}` : "",
  };
}

export default async function ClipSubmissionsPage() {
  const all = await listVideoSubmissions();
  const active = all.filter((s) => s.status === "pending" || s.status === "failed" || s.status === "posting");
  const done = all.filter((s) => s.status === "posted" || s.status === "declined");

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="ThisIzATL" width={32} height={32} />
            <span className="font-display text-lg font-bold text-ink">Video Submissions</span>
          </div>
          <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-800">
            &larr; Back to admin
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        <p className="text-sm text-zinc-500">
          Clips people uploaded at{" "}
          <span className="font-medium text-zinc-700">thisizatl.com/clip</span>. Nothing is posted
          until you approve it here.
        </p>

        <section>
          <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-bold text-ink">
            <span className="h-4 w-1 rounded-full bg-green-600" />
            Needs review ({active.length})
          </h2>
          {active.length === 0 ? (
            <p className="text-sm text-zinc-500">No clips waiting right now.</p>
          ) : (
            <div className="space-y-4">
              {active.map((s) => (
                <ClipCard key={s.id} clip={toCardData(s)} />
              ))}
            </div>
          )}
        </section>

        {done.length > 0 && (
          <section>
            <h2 className="font-display mb-3 text-lg font-bold text-ink">History</h2>
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
              {done.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      {s.headline || s.caption.slice(0, 60)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {s.submitter_name} · {formatShortDateTime(s.created_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.status === "posted"
                        ? "bg-green-100 text-green-700"
                        : "bg-zinc-200 text-zinc-600"
                    }`}
                  >
                    {s.status === "posted" ? "Posted to Instagram" : "Declined"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
