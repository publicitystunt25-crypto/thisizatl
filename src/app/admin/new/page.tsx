import Link from "next/link";
import { createPostAction } from "../actions";
import PostFormFields from "../PostFormFields";

export default function NewPostPage() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-2xl px-6 py-4">
          <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
            ← Back to admin
          </Link>
          <h1 className="font-display mt-1 text-xl font-bold text-ink">
            New Post
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <form action={createPostAction} className="space-y-5">
          <PostFormFields />
          <button
            type="submit"
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Save Post
          </button>
        </form>
      </main>
    </div>
  );
}
