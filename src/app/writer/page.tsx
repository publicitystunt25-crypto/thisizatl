import { requireWriter } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import { createWriterPostAction, writerLogoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function WriterPage({
  searchParams,
}: {
  searchParams: Promise<{ posted?: string }>;
}) {
  const writer = await requireWriter();
  const { posted } = await searchParams;

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
            Your article was saved. If you have a photo for it, email it to{" "}
            <a href="mailto:info@thisizatl.com" className="font-medium underline">
              info@thisizatl.com
            </a>{" "}
            with the article title in the subject line -- we'll attach it on our end.
          </div>
        )}

        <h1 className="font-display text-xl font-bold text-ink">Write a New Article</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Byline will be credited to <span className="font-medium text-ink">{writer.name}</span>.
        </p>

        <form action={createWriterPostAction} className="mt-6 space-y-5">
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

          <button
            type="submit"
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Save Article
          </button>
        </form>
      </main>
    </div>
  );
}
