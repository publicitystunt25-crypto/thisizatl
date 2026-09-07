import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getPostById, getPostImages } from "@/lib/db";
import { formatDateTime } from "@/lib/date";
import CategoryBadge from "@/components/CategoryBadge";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ArticleLinks, { type SourceCredit } from "@/components/ArticleLinks";

export const dynamic = "force-dynamic";

// Same visual template as the real post page, but fetches by id regardless
// of status -- lets admins actually read a draft/pending submission before
// approving it, since the public post page only shows published posts.
export default async function AdminPostPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPostById(Number(id));
  if (!post) notFound();

  const sources = JSON.parse(post.sources) as SourceCredit[];
  const galleryImages = await getPostImages(post.id);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-yellow-300 px-6 py-2 text-center text-sm font-medium text-ink">
        Preview only — this {post.status} post is not visible to the public.{" "}
        <Link href="/admin" className="underline">
          Back to admin
        </Link>
      </div>

      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <CategoryBadge category={post.category} />
        <h1 className="font-display mt-3 text-3xl font-bold leading-tight text-ink sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-3 text-sm text-zinc-500">
          {post.author && <>By {post.author} · </>}
          {formatDateTime(post.created_at)}
        </p>

        {post.image_url && (
          <div className="mt-8">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-zinc-100">
              <Image
                src={post.image_url}
                alt=""
                fill
                sizes="(min-width: 768px) 768px, 100vw"
                priority
                className="object-contain"
              />
            </div>
            {post.image_credit_name ? (
              <p className="mt-2 text-xs text-zinc-400">
                Photo by{" "}
                {post.image_credit_url ? (
                  <a
                    href={post.image_credit_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {post.image_credit_name}
                  </a>
                ) : (
                  post.image_credit_name
                )}{" "}
                via Pexels
              </p>
            ) : (
              post.image_credit && (
                <p className="mt-2 text-xs text-zinc-400">Photo by {post.image_credit}</p>
              )
            )}
          </div>
        )}

        <div className="mt-8 whitespace-pre-line text-[17px] leading-relaxed text-zinc-800">
          {post.body}
        </div>

        {galleryImages.length > 0 && (
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {galleryImages.map((img) => (
              <div key={img.id}>
                <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-zinc-100">
                  <Image
                    src={`/api/gallery/${img.id}`}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 33vw, 50vw"
                    className="object-cover"
                  />
                </div>
                {img.credit && (
                  <p className="mt-1 text-xs text-zinc-400">Photo by {img.credit}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <ArticleLinks sources={sources} artistName={post.image_credit} />
      </main>

      <SiteFooter />
    </div>
  );
}
