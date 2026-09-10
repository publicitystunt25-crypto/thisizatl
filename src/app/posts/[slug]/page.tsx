import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { getPostBySlug, getPostImages } from "@/lib/db";
import { formatDateTime } from "@/lib/date";
import CategoryBadge from "@/components/CategoryBadge";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ArticleLinks, { type SourceCredit } from "@/components/ArticleLinks";

export const dynamic = "force-dynamic";

function excerpt(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  const description = excerpt(post.body);
  const images = post.image_url
    ? [{ url: post.image_url, width: 1200, height: 675, alt: post.title }]
    : undefined;

  return {
    title: post.title,
    description,
    openGraph: {
      type: "article",
      title: post.title,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: post.image_url ? [post.image_url] : undefined,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const sources = JSON.parse(post.sources) as SourceCredit[];
  const galleryImages = await getPostImages(post.id);

  return (
    <div className="flex min-h-screen flex-col">
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
            <div
              className={`relative mx-auto max-w-full overflow-hidden rounded-xl bg-zinc-100 ${
                post.image_width && post.image_height ? "" : "aspect-[16/9] w-full"
              }`}
              style={
                post.image_width && post.image_height
                  ? {
                      aspectRatio: `${post.image_width} / ${post.image_height}`,
                      maxHeight: "75vh",
                      width: `min(100%, calc(75vh * ${post.image_width} / ${post.image_height}))`,
                    }
                  : undefined
              }
            >
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

        <p className="mt-8 border-t border-zinc-200 pt-4 text-xs text-zinc-400">
          © {new Date().getFullYear()} ThisIzATL
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
