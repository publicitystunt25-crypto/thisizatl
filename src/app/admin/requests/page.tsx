import Link from "next/link";
import Image from "next/image";
import {
  listCoverageRequests,
  listCoverageRequestImageIds,
  type CoverageRequest,
  type CoverageStatus,
} from "@/lib/db";
import { formatShortDateTime } from "@/lib/date";
import { extractInstagramHandle } from "@/lib/social";
import {
  createDraftFromRequestAction,
  deleteCoverageRequestAction,
  setCoverageStatusAction,
} from "./actions";
import { DeleteButton, DraftButton } from "./ActionButtons";

export const dynamic = "force-dynamic";

const FILTERS: { key: CoverageStatus | "all"; label: string }[] = [
  { key: "new", label: "New" },
  { key: "accepted", label: "Accepted" },
  { key: "covered", label: "Covered" },
  { key: "declined", label: "Declined" },
  { key: "all", label: "All" },
];

const STATUS_BUTTONS: { status: CoverageStatus; label: string }[] = [
  { status: "accepted", label: "Accept" },
  { status: "covered", label: "Mark covered" },
  { status: "declined", label: "Decline" },
  { status: "new", label: "Back to new" },
];

const STATUS_BADGE: Record<CoverageStatus, string> = {
  new: "bg-green-600 text-white",
  accepted: "bg-blue-600 text-white",
  covered: "bg-zinc-700 text-white",
  declined: "bg-zinc-300 text-zinc-700",
};

// Only render pasted links as clickable when they're real web addresses, so
// nothing a stranger typed can become a javascript: link in the admin.
function safeHref(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function RequestCard({ r, photoIds }: { r: CoverageRequest; photoIds: number[] }) {
  const handle = extractInstagramHandle(r.subject_instagram);
  let collabUrls: string[] = [];
  try {
    collabUrls = r.collab_instagrams ? (JSON.parse(r.collab_instagrams) as string[]) : [];
  } catch {
    collabUrls = [];
  }
  const pressKit = safeHref(r.press_kit_url);
  const otherLinks = r.other_links ? r.other_links.split("\n").map((l) => l.trim()).filter(Boolean) : [];

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">{r.subject_name}</h2>
          <p className="text-sm text-zinc-500">
            {r.request_type} &middot; {formatShortDateTime(r.created_at)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE[r.status]}`}>
          {r.status}
        </span>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">From</dt>
          <dd className="text-zinc-800">
            {r.requester_name}
            {r.organization ? ` (${r.organization})` : ""} &mdash; {r.role}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Contact</dt>
          <dd className="text-zinc-800">
            <a href={`mailto:${r.requester_email}`} className="text-brand-dark hover:underline">
              {r.requester_email}
            </a>
            {r.requester_phone ? ` · ${r.requester_phone}` : ""}
          </dd>
        </div>
        {r.subject_instagram && (
          <div>
            <dt className="text-zinc-500">Instagram</dt>
            <dd className="text-zinc-800">
              {handle ? (
                <a
                  href={`https://instagram.com/${handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-dark hover:underline"
                >
                  @{handle}
                </a>
              ) : (
                r.subject_instagram
              )}
            </dd>
          </div>
        )}
        {collabUrls.length > 0 && (
          <div>
            <dt className="text-zinc-500">Collab pages</dt>
            <dd className="text-zinc-800">
              {collabUrls.map((u, i) => (
                <span key={u}>
                  {i > 0 ? ", " : ""}
                  <a href={u} target="_blank" rel="noopener noreferrer" className="text-brand-dark hover:underline">
                    {u.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "@").replace(/\/$/, "")}
                  </a>
                </span>
              ))}
            </dd>
          </div>
        )}
        {r.event_date && (
          <div>
            <dt className="text-zinc-500">Release / event date</dt>
            <dd className="text-zinc-800">{r.event_date}</dd>
          </div>
        )}
        {r.deadline && (
          <div>
            <dt className="text-zinc-500">Needs coverage by</dt>
            <dd className="font-medium text-zinc-800">{r.deadline}</dd>
          </div>
        )}
        {pressKit && (
          <div>
            <dt className="text-zinc-500">Press kit</dt>
            <dd>
              <a
                href={pressKit}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-brand-dark hover:underline"
              >
                {pressKit}
              </a>
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{r.details}</p>

      {photoIds.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {photoIds.map((pid) => (
            <a
              key={pid}
              href={`/admin/requests/photo/${pid}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open full size"
            >
              <Image
                src={`/admin/requests/photo/${pid}`}
                alt={`Photo attached to the request for ${r.subject_name}`}
                width={112}
                height={112}
                unoptimized
                className="h-28 w-28 rounded-lg border border-zinc-200 object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {otherLinks.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {otherLinks.map((l, i) => {
            const href = safeHref(l);
            return (
              <li key={i} className="break-all">
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-dark hover:underline">
                    {l}
                  </a>
                ) : (
                  <span className="text-zinc-700">{l}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
        {r.post_id ? (
          <Link
            href={`/admin/${r.post_id}/edit`}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Open draft article
          </Link>
        ) : (
          <form action={createDraftFromRequestAction.bind(null, r.id)}>
            <DraftButton />
          </form>
        )}
        <a
          href={`mailto:${r.requester_email}?subject=${encodeURIComponent(
            `Re: Your coverage request — ${r.subject_name}`
          )}`}
          className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Email them
        </a>
        {STATUS_BUTTONS.filter((b) => b.status !== r.status).map((b) => (
          <form key={b.status} action={setCoverageStatusAction.bind(null, r.id, b.status)}>
            <button
              type="submit"
              className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              {b.label}
            </button>
          </form>
        ))}
        <form action={deleteCoverageRequestAction.bind(null, r.id)} className="ml-auto">
          <DeleteButton />
        </form>
      </div>
    </article>
  );
}

export default async function CoverageRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = FILTERS.some((f) => f.key === status) ? (status as CoverageStatus | "all") : "new";

  const all = await listCoverageRequests();
  const photosByRequest = await listCoverageRequestImageIds();
  const filtered = active === "all" ? all : all.filter((r) => r.status === active);
  // Open requests with a "need it by" date come first, soonest deadline on top;
  // everything else stays newest-first.
  const shown =
    active === "new" || active === "accepted"
      ? [...filtered].sort((a, b) => {
          if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
          if (a.deadline) return -1;
          if (b.deadline) return 1;
          return 0;
        })
      : filtered;
  const counts = (key: CoverageStatus | "all") =>
    key === "all" ? all.length : all.filter((r) => r.status === key).length;

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="ThisIzATL" width={32} height={32} />
            <span className="font-display text-lg font-bold text-ink">Coverage Requests</span>
          </div>
          <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-800">
            &larr; Back to admin
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <p className="text-sm text-zinc-500">
          Interview, feature and premiere requests sent from{" "}
          <span className="font-medium text-zinc-700">thisizatl.com/pitch</span>. Nothing is
          published or sent to the requester until you decide.
        </p>

        <nav className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/admin/requests?status=${f.key}`}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                active === f.key
                  ? "border-ink bg-ink text-white"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {f.label} ({counts(f.key)})
            </Link>
          ))}
        </nav>

        {shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            Nothing here.
          </p>
        ) : (
          <div className="space-y-4">
            {shown.map((r) => (
              <RequestCard key={r.id} r={r} photoIds={photosByRequest[r.id] ?? []} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
