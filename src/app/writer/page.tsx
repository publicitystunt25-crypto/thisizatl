import Link from "next/link";
import { requireWriter } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import { getPostsByAuthor } from "@/lib/db";
import { createWriterPostAction, writerLogoutAction, deleteWriterPostAction } from "./actions";
import SaveButton from "./SaveButton";
import DeleteButton from "./DeleteButton";
import PhotoPicker from "./PhotoPicker";

export const dynamic = "force-dynamic";
// Vercel's default serverless timeout (10s) is too tight once a save
// includes a real photo upload plus the vision-based focus-detection call --
// the request gets killed mid-flight with no error shown to the writer, who
// just sees "Saving..." stop responding. 60s covers several real phone
// photos plus that one AI call with real margin.
export const maxDuration = 60;

export default async function WriterPage({
  searchParams,
}: {
  searchParams: Promise<{ posted?: string; updated?: string; deleted?: string }>;
}) {
  const writer = await requireWriter();
  const { posted, updated, deleted } = await searchParams;
  const posts = await getPostsByAuthor(writer.name);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-display text-lg font-bold text-ink">ThisIzATL</p>
            <p className="text-sm text-zinc-500">Signed in as {writer.name}</p>
          </div>
          <form action={writerLogoutAction}>
            <button type="submit" className="text-sm text-zinc-500 hover:text-zinc-800">
              Log out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        {posted && (
          <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
            Your article was saved.
          </div>
        )}
        {updated && (
          <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
            Your changes were saved.
          </div>
        )}
        {deleted && (
          <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
            Article deleted.
          </div>
        )}

        {posts.length > 0 && (
          <div className="mb-10">
            <h2 className="font-display text-lg font-bold text-ink">Your Articles</h2>
            <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
              {posts.map((post) => (
                <li key={post.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{post.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      <span className="capitalize">{post.status}</span>
                      {" · "}
                      {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-sm">
                    {post.status === "published" && (
                      <a
                        href={`/posts/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-500 hover:underline"
                      >
                        View
                      </a>
                    )}
                    <Link href={`/writer/${post.id}/edit`} className="font-medium text-brand hover:underline">
                      Edit
                    </Link>
                    <form action={deleteWriterPostAction.bind(null, post.id)}>
                      <DeleteButton />
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <h1 className="font-display text-xl font-bold text-ink">Write a New Article</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Byline will be credited to <span className="font-medium text-ink">{writer.name}</span>.
        </p>

        <form action={createWriterPostAction} className="mt-6 space-y-5" encType="multipart/form-data">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Title</label>
            <input
              type="text"
              name="title"
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Body</label>
            <textarea
              name="body"
              required
              rows={14}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm leading-relaxed focus:border-brand focus:outline-none"
            />
            <p className="mt-1 text-xs text-zinc-400">Separate paragraphs with a blank line.</p>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700">Category</label>
              <select
                name="category"
                defaultValue="Music"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700">Status</label>
              <select
                name="status"
                defaultValue="draft"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              >
                <option value="draft">Save as draft</option>
                <option value="published">Publish now</option>
              </select>
            </div>
          </div>

          <PhotoPicker />

          <SaveButton label="Save Article" />
        </form>
      </main>
    </div>
  );
}
