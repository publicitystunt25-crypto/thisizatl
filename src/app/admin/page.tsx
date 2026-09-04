import Link from "next/link";
import Image from "next/image";
import { getAllPostsAdmin } from "@/lib/db";
import { logoutAction, deletePostAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const posts = await getAllPostsAdmin();

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
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

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="space-y-3">
          {posts.length === 0 && (
            <p className="text-sm text-zinc-500">No posts yet.</p>
          )}
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {post.status === "draft" && (
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">
                      Draft
                    </span>
                  )}
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand-dark">
                    {post.category}
                  </span>
                  {post.author && (
                    <span className="text-xs text-zinc-400">
                      by {post.author}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate font-medium text-ink">
                  {post.title}
                </p>
                <p className="text-xs text-zinc-400">
                  {new Date(post.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-sm">
                {post.status === "published" && (
                  <Link
                    href={`/posts/${post.slug}`}
                    target="_blank"
                    className="text-zinc-500 hover:text-brand-dark"
                  >
                    View
                  </Link>
                )}
                <Link
                  href={`/admin/${post.id}/edit`}
                  className="text-brand-dark hover:underline"
                >
                  Edit
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await deletePostAction(post.id);
                  }}
                >
                  <button
                    type="submit"
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
