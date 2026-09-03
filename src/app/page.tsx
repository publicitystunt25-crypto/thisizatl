import Link from "next/link";
import Image from "next/image";
import { getAllPosts } from "@/lib/db";
import GenerateButton from "@/components/GenerateButton";
import CategoryBadge from "@/components/CategoryBadge";

export const dynamic = "force-dynamic";

const CATEGORIES = ["Music", "News", "Culture", "Events"];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const activeCategory = category && CATEGORIES.includes(category) ? category : undefined;
  const posts = await getAllPosts(activeCategory);

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Image src="/logo.png" alt="ThisIzATL" width={160} height={160} priority />
        <p className="mt-2 text-zinc-600">
          Atlanta music and culture news, written and published automatically.
          Each post is written by Claude from live Atlanta news, with source
          attribution and a similarity self-check.
        </p>

        <div className="mt-8">
          <GenerateButton />
        </div>

        <nav className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/"
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              !activeCategory
                ? "bg-black text-white"
                : "bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-400"
            }`}
          >
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/?category=${c}`}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                activeCategory === c
                  ? "bg-black text-white"
                  : "bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-400"
              }`}
            >
              {c}
            </Link>
          ))}
        </nav>

        <div className="mt-6 space-y-6">
          {posts.length === 0 && (
            <p className="text-zinc-500 text-sm">
              {activeCategory
                ? `No ${activeCategory} posts yet.`
                : 'No posts yet — click "Run news pipeline now" above.'}
            </p>
          )}
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/posts/${post.slug}`}
              className="flex gap-4 rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-400 transition-colors"
            >
              {post.image_url && (
                <Image
                  src={post.image_url}
                  alt=""
                  width={120}
                  height={80}
                  className="h-20 w-30 flex-none rounded object-cover"
                />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <CategoryBadge category={post.category} />
                </div>
                <h2 className="mt-1 text-lg font-semibold text-black">
                  {post.title}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {new Date(post.created_at).toLocaleString()}
                </p>
                <p className="mt-2 text-sm text-zinc-700 line-clamp-2">
                  {post.body.slice(0, 180)}…
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
