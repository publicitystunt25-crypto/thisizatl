import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPostByReviewToken, getPostImages } from "@/lib/db";
import { formatDateTime, toEasternDatetimeLocalValue } from "@/lib/date";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import DraftArticleBody from "@/components/DraftArticleBody";
import ReviewActions from "../ReviewActions";
import { goLiveNowAction, requestChangesAction, scheduleAction } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review your feature",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  time: "That time didn't work -- please pick a time at least 10 minutes from now and within the next 60 days.",
  note: "Please write what you'd like changed before sending.",
  photos: "Please attach no more than 5 photos.",
  photoType: "Only image files can be attached as photos.",
};

// The private page behind the "Your feature is ready" email. The secret token
// in the link is the only credential, so it carries no admin or site links
// that reveal other posts.
export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const post = await getPostByReviewToken(token);
  if (!post) notFound();

  const galleryImages = await getPostImages(post.id);
  const waiting = post.status === "draft" && post.review_status !== "changes_requested";

  const actions = waiting ? (
    <ReviewActions
      minValue={toEasternDatetimeLocalValue(new Date().toISOString())}
      goLive={goLiveNowAction.bind(null, token)}
      schedule={scheduleAction.bind(null, token)}
      requestChanges={requestChangesAction.bind(null, token)}
    />
  ) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-blue-100 px-6 py-2 text-center text-sm font-medium text-ink">
        This is a private review page for your ThisIzATL feature.
      </div>

      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-5">
          {post.status === "published" ? (
            <div className="space-y-2 text-sm text-zinc-700">
              <p className="font-display text-lg font-bold text-green-700">Your article is live!</p>
              <Link href={`/posts/${post.slug}`} className="font-medium text-brand-dark hover:underline">
                View it on ThisIzATL &rarr;
              </Link>
            </div>
          ) : post.status === "scheduled" && post.scheduled_for ? (
            <div className="space-y-1 text-sm text-zinc-700">
              <p className="font-display text-lg font-bold text-blue-700">Approved &mdash; scheduled</p>
              <p>
                It will go live after {formatDateTime(post.scheduled_for)} Eastern. We publish scheduled articles a
                few times a day, so it can go up a few hours after that time.
              </p>
            </div>
          ) : post.review_status === "changes_requested" ? (
            <div className="space-y-2 text-sm text-zinc-700">
              <p className="font-display text-lg font-bold text-amber-700">We got your changes</p>
              <p>We&rsquo;ll make the edits and email you a new link to review. Nothing goes live until you approve.</p>
              {post.review_note && (
                <p className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-zinc-600">{post.review_note}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-display text-lg font-bold text-ink">Your feature is ready</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Read it below, then approve it or ask for changes. Nothing goes live until you approve.
                </p>
              </div>
              {error && ERRORS[error] && (
                <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{ERRORS[error]}</p>
              )}
              {actions}
            </div>
          )}
        </section>

        <DraftArticleBody post={post} galleryImages={galleryImages} />

        {waiting && <section className="mt-10 rounded-xl border border-zinc-200 bg-white p-5">{actions}</section>}
      </main>

      <SiteFooter />
    </div>
  );
}
