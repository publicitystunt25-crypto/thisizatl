import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { getPostBySlug } from "@/lib/db";
import CategoryBadge from "@/components/CategoryBadge";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

interface SourceCredit {
  title: string;
  url: string;
  source: string;
}

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

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <CategoryBadge category={post.category} />
        <h1 className="font-display mt-3 text-3xl font-bold leading-tight text-ink sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-3 text-sm text-zinc-500">
          {new Date(post.created_at).toLocaleString(undefined, {
            dateStyle: "long",
            timeStyle: "short",
          })}
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
                className="object-cover"
              />
            </div>
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
          </div>
        )}

        <div className="mt-8 whitespace-pre-line text-[17px] leading-relaxed text-zinc-800">
          {post.body}
        </div>

        <div className="mt-10 rounded-xl border border-zinc-200 bg-white p-5 text-sm">
          <p className="font-semibold text-ink">Sources</p>
          <ul className="mt-2 space-y-1.5">
            {sources.map((s, i) => (
              <li key={i}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-dark hover:underline"
                >
                  {s.source}: {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {post.similarity_note && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-semibold">Automated similarity self-check</p>
            <p className="mt-1">{post.similarity_note}</p>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
