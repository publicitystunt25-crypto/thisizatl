import Link from "next/link";
import Image from "next/image";
import { getAllPosts, type Post } from "@/lib/db";
import { CATEGORIES, FEATURED_PRIORITY } from "@/lib/categories";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CategoryBadge from "@/components/CategoryBadge";
import PostCard from "@/components/PostCard";

export const dynamic = "force-dynamic";

function pickFeatured(posts: Post[]): [Post | undefined, Post[]] {
  for (const category of FEATURED_PRIORITY) {
    const match = posts.find((p) => p.category === category);
    if (match) return [match, posts.filter((p) => p !== match)];
  }
  const [first, ...rest] = posts;
  return [first, rest];
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const activeCategory =
    category && (CATEGORIES as readonly string[]).includes(category)
      ? category
      : undefined;
  const posts = await getAllPosts(activeCategory);
  const [featured, rest] = activeCategory
    ? [posts[0], posts.slice(1)]
    : pickFeatured(posts);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader activeCategory={activeCategory} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        {posts.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-24 text-center">
            <p className="text-zinc-500">
              {activeCategory
                ? `No ${activeCategory} posts yet.`
                : "No posts yet — check back soon."}
            </p>
          </div>
        )}

        {featured && (
          <Link
            href={`/posts/${featured.slug}`}
            className="group mb-10 grid gap-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-colors hover:border-brand/40 sm:grid-cols-2 sm:gap-6"
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100 sm:aspect-auto">
              {featured.image_url ? (
                <Image
                  src={featured.image_url}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 50vw, 100vw"
                  priority
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-300">
                  <Image src="/logo.png" alt="" width={64} height={64} className="opacity-40" />
                </div>
              )}
            </div>
            <div className="flex flex-col justify-center p-5 sm:p-8">
              <CategoryBadge category={featured.category} />
              <h2 className="font-display mt-2 text-xl font-bold leading-tight text-ink group-hover:text-brand-dark sm:mt-3 sm:text-3xl">
                {featured.title}
              </h2>
              <p className="mt-2 line-clamp-2 text-sm text-zinc-600 sm:mt-3 sm:line-clamp-3 sm:text-base">
                {featured.body}
              </p>
              <p className="mt-3 text-xs text-zinc-400 sm:mt-4">
                {new Date(featured.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </Link>
        )}

        {rest.length > 0 && (
          <>
            <h2 className="font-display mb-4 flex items-center gap-2 text-lg font-bold text-ink">
              <span className="h-4 w-1 rounded-full bg-brand" />
              {activeCategory ? `More ${activeCategory}` : "Latest"}
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
