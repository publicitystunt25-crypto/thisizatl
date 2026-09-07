import Link from "next/link";
import Image from "next/image";
import { getAllPostsAdmin, type Post } from "@/lib/db";
import { formatShortDateTime, formatDateTime, toEasternDatetimeLocalValue } from "@/lib/date";
import {
  logoutAction,
  deletePostAction,
  setFeaturedPostAction,
  unsetFeaturedPostAction,
  approvePostAction,
  retrySocialShareAction,
  schedulePostAction,
  cancelScheduleAction,
} from "./actions";
import ScheduleControl from "./ScheduleControl";

export const dynamic = "force-dynamic";

function PostRow({
  post,
  pending,
}: {
  post: Post;
  pending: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white p-4 ${
        pending ? "" : "flex items-center justify-between gap-4"
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {post.is_featured && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
              ★ Featured
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
          <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand-dark">
            {post.category}
          </span>
          {post.author && (
            <span className="text-xs text-zinc-400">by {post.author}</span>
          )}
        </div>
        <p className={`mt-1 font-medium text-ink ${pending ? "" : "truncate"}`}>
          {post.title}
        </p>
        <p className="text-xs text-zinc-400">
          {formatShortDateTime(post.created_at)}
        </p>
      </div>
      <div
        className={`flex shrink-0 flex-wrap items-center gap-3 text-sm ${
          pending ? "mt-3" : ""
        }`}
      >
        {post.status === "published" ? (
          <Link
            href={`/posts/${post.slug}`}
            target="_blank"
            className="text-zinc-500 hover:text-brand-dark"
          >
            View
          </Link>
        ) : (
          <Link
            href={`/admin/${post.id}/preview`}
            target="_blank"
            className="text-zinc-500 hover:text-brand-dark"
          >
            Preview
          </Link>
        )}
        <Link
          href={`/admin/${post.id}/edit`}
          className="text-brand-dark hover:underline"
        >
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
                await deletePostAction(post.id);
              }}
            >
              <button type="submit" className="text-red-600 hover:underline">
                Decline
              </button>
            </form>
            <ScheduleControl
              minValue={toEasternDatetimeLocalValue(new Date().toISOString())}
              action={async (formData: FormData) => {
                "use server";
                await schedulePostAction(post.id, formData);
              }}
            />
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
  const posts = await getAllPostsAdmin();
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
            <aside className="lg:sticky lg:top-8 lg:w-80 lg:shrink-0">
              <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-bold text-ink">
                <span className="h-4 w-1 rounded-full bg-green-600" />
                Pending Review ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((post) => (
                  <PostRow key={post.id} post={post} pending />
                ))}
              </div>
            </aside>
          )}

          <div className="min-w-0 flex-1 space-y-3">
            {posts.length === 0 && (
              <p className="text-sm text-zinc-500">No posts yet.</p>
            )}
            {rest.map((post) => (
              <PostRow key={post.id} post={post} pending={false} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
