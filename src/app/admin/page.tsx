import Link from "next/link";
import Image from "next/image";
import {
  getAllPostsAdmin,
  countPendingVideoSubmissions,
  countNewCoverageRequests,
  listReviewPhotoIds,
  type Post,
} from "@/lib/db";
import { formatShortDateTime, formatDateTime, toEasternDatetimeLocalValue } from "@/lib/date";
import {
  logoutAction,
  deletePostAction,
  setFeaturedPostAction,
  unsetFeaturedPostAction,
  setGoldenPeachAction,
  unsetGoldenPeachAction,
  approvePostAction,
  acceptAllAction,
  retrySocialShareAction,
  schedulePostAction,
  cancelScheduleAction,
  emailPreviewAction,
} from "./actions";
import { sendDueRevisionEmails } from "@/lib/reviewRevision";
import ScheduleControl from "./ScheduleControl";
import EmailPreviewButton from "./EmailPreviewButton";

export const dynamic = "force-dynamic";

function PostRow({
  post,
  pending,
  photoIds,
}: {
  post: Post;
  pending: boolean;
  photoIds: { id: number; kind: "main" | "extra" }[];
}) {
  const reviewPhotoIds = photoIds;
  return (
    <div
      className="rounded-lg border border-zinc-200 bg-white p-4"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {post.is_featured && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
              ★ Featured
            </span>
          )}
          {post.is_golden_peach && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              🍑 Golden Peach
            </span>
          )}
          {post.status === "draft" && (
            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">
              Draft
            </span>
          )}
          {post.status === "scheduled" && post.scheduled_for && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              Scheduled for {formatDateTime(post.scheduled_for)}
            </span>
          )}
          {post.status === "published" && !post.social_shared && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Didn&rsquo;t share to FB/IG
            </span>
          )}
          {post.status === "draft" && post.review_status === "awaiting" && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              Awaiting their approval
            </span>
          )}
          {post.status === "draft" && post.review_status === "changes_requested" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Changes requested
            </span>
          )}
          {post.status === "draft" && post.review_status === "revising" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Updated &mdash; emailing them
              {post.revision_send_at ? ` ${formatShortDateTime(post.revision_send_at)}` : ""}
            </span>
          )}
          {post.status === "scheduled" && post.review_status === "scheduled" && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Approved by submitter
            </span>
          )}
          <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand-dark">
            {post.category}
          </span>
          {post.author && (
            <span className="text-xs text-zinc-400">by {post.author}</span>
          )}
        </div>
        <p className="mt-1 font-medium text-ink">{post.title}</p>
        {(post.review_status === "changes_requested" || post.review_status === "revising") && post.review_note && (
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <span className="font-medium">Their requested changes:</span> {post.review_note}
          </p>
        )}
        {post.review_status === "changes_requested" && reviewPhotoIds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {reviewPhotoIds.map((p) => (
              <a
                key={p.id}
                href={`/admin/review-photo/${p.id}`}
                target="_blank"
                title={p.kind === "main" ? "New MAIN photo they sent -- click to open" : "Extra photo they sent -- click to open"}
                className="text-center text-[10px] font-medium text-zinc-500"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/admin/review-photo/${p.id}`} alt="Photo they sent" className="h-16 w-16 rounded-lg object-cover" />
                {p.kind === "main" ? "Main" : "Extra"}
              </a>
            ))}
          </div>
        )}
        <p className="text-xs text-zinc-400">
          {formatShortDateTime(post.created_at)}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        {post.status === "published" ? (
          <Link
            href={`/posts/${post.slug}`}
            target="_blank"
            className="text-zinc-500 hover:text-brand-dark"
          >
            View
          </Link>
        ) : (
          <>
            <Link
              href={`/admin/${post.id}/preview`}
              target="_blank"
              className="text-zinc-500 hover:text-brand-dark"
            >
              Preview
            </Link>
            <Link
              href={`/preview/${post.id}`}
              target="_blank"
              className="text-zinc-500 hover:text-brand-dark"
              title="Shareable read-only link -- no admin login required"
            >
              Share
            </Link>
          </>
        )}
        <Link href={`/admin/${post.id}/edit`} className="text-brand-dark hover:underline">
          Edit
        </Link>
        {pending && post.status === "draft" && (
          <>
            <form
              action={async () => {
                "use server";
                await approvePostAction(post.id);
              }}
            >
              <button type="submit" className="font-medium text-green-700 hover:underline">
                Approve
              </button>
            </form>
            <form
              action={async () => {
                "use server";
                await acceptAllAction(post.id);
              }}
            >
              <button type="submit" className="font-medium text-brand-dark hover:underline">
                Accept All
              </button>
            </form>
            <form
              action={async () => {
                "use server";
                await deletePostAction(post.id);
              }}
            >
              <button type="submit" className="text-red-600 hover:underline">
                Decline
              </button>
            </form>
            <ScheduleControl
              postTitle={post.title}
              minValue={toEasternDatetimeLocalValue(new Date().toISOString())}
              action={async (formData: FormData) => {
                "use server";
                await schedulePostAction(post.id, formData);
              }}
            />
            {post.submitter_email && (
              <form
                action={async () => {
                  "use server";
                  await emailPreviewAction(post.id);
                }}
              >
                <EmailPreviewButton
                  email={post.submitter_email}
                  sentLabel={post.preview_emailed_at ? formatShortDateTime(post.preview_emailed_at) : null}
                />
              </form>
            )}
          </>
        )}
        {pending && post.status === "scheduled" && (
          <>
            <form
              action={async () => {
                "use server";
                await approvePostAction(post.id);
              }}
            >
              <button type="submit" className="font-medium text-green-700 hover:underline">
                Publish Now
              </button>
            </form>
            <form
              action={async () => {
                "use server";
                await cancelScheduleAction(post.id);
              }}
            >
              <button type="submit" className="text-zinc-500 hover:underline">
                Cancel
              </button>
            </form>
          </>
        )}
        {!pending && post.status === "published" && !post.ig_feed_shared && (
          <form
            action={async () => {
              "use server";
              await acceptAllAction(post.id);
            }}
          >
            <button type="submit" className="font-medium text-brand-dark hover:underline">
              Post to IG Feed
            </button>
          </form>
        )}
        {!pending && post.status === "published" && !post.social_shared && (
          <form
            action={async () => {
              "use server";
              await retrySocialShareAction(post.id);
            }}
          >
            <button type="submit" className="font-medium text-red-700 hover:underline">
              Retry share
            </button>
          </form>
        )}
        {!pending &&
          post.status === "published" &&
          (post.is_featured ? (
            <form
              action={async () => {
                "use server";
                await unsetFeaturedPostAction(post.id);
              }}
            >
              <button type="submit" className="text-zinc-500 hover:underline">
                Unfeature
              </button>
            </form>
          ) : (
            <form
              action={async () => {
                "use server";
                await setFeaturedPostAction(post.id);
              }}
            >
              <button type="submit" className="text-zinc-500 hover:underline">
                Feature
              </button>
            </form>
          ))}
        {!pending &&
          post.status === "published" &&
          (post.is_golden_peach ? (
            <form
              action={async () => {
                "use server";
                await unsetGoldenPeachAction(post.id);
              }}
            >
              <button type="submit" className="text-zinc-500 hover:underline">
                Remove Golden Peach
              </button>
            </form>
          ) : (
            <form
              action={async () => {
                "use server";
                await setGoldenPeachAction(post.id);
              }}
            >
              <button type="submit" className="font-medium text-yellow-700 hover:underline">
                🍑 Golden Peach
              </button>
            </form>
          ))}
        {!(pending && post.status === "draft") && (
          <form
            action={async () => {
              "use server";
              await deletePostAction(post.id);
            }}
          >
            <button type="submit" className="text-red-600 hover:underline">
              Delete
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default async function AdminDashboard() {
  // Backstop for the 10-minute "article updated" emails if the server restarted while one was waiting.
  await sendDueRevisionEmails().catch((err) => console.error("Revision email sweep failed:", err));
  const posts = await getAllPostsAdmin();
  const pendingClips = await countPendingVideoSubmissions();
  const newRequests = await countNewCoverageRequests();
  const reviewPhotos = await listReviewPhotoIds();
  const pending = posts.filter((p) => p.status === "draft" || p.status === "scheduled");
  const rest = posts.filter((p) => p.status === "published");

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="ThisIzATL" width={32} height={32} />
            <span className="font-display text-lg font-bold text-ink">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/clips"
              className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Video Submissions
              {pendingClips > 0 && (
                <span className="ml-2 rounded-full bg-green-600 px-2 py-0.5 text-xs text-white">
                  {pendingClips}
                </span>
              )}
            </Link>
            <Link
              href="/admin/requests"
              className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Coverage Requests
              {newRequests > 0 && (
                <span className="ml-2 rounded-full bg-green-600 px-2 py-0.5 text-xs text-white">
                  {newRequests}
                </span>
              )}
            </Link>
            <Link
              href="/admin/new"
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
            >
              New Post
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-sm text-zinc-500 hover:text-zinc-800"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {pending.length > 0 && (
            <aside className="lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:w-80 lg:shrink-0 lg:overflow-y-auto">
              <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-bold text-ink">
                <span className="h-4 w-1 rounded-full bg-green-600" />
                Pending Review ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((post) => (
                  <PostRow key={post.id} post={post} pending photoIds={reviewPhotos[post.id] ?? []} />
                ))}
              </div>
            </aside>
          )}

          <div className="min-w-0 flex-1 space-y-3">
            {posts.length === 0 && (
              <p className="text-sm text-zinc-500">No posts yet.</p>
            )}
            {rest.map((post) => (
              <PostRow key={post.id} post={post} pending={false} photoIds={[]} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
