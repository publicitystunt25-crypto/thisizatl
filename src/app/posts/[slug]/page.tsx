import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getPostBySlug } from "@/lib/db";
import CategoryBadge from "@/components/CategoryBadge";

export const dynamic = "force-dynamic";

interface SourceCredit {
  title: string;
  url: string;
  source: string;
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
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-2xl px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-2">
          <Image src="/logo.png" alt="ThisIzATL" width={36} height={36} />
          <span className="text-sm text-zinc-500 hover:underline">← Back to blog</span>
        </Link>

        <div className="mt-4">
          <CategoryBadge category={post.category} />
        </div>
        <h1 className="mt-2 text-2xl font-bold text-black">{post.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {new Date(post.created_at).toLocaleString()}
        </p>

        {post.image_url && (
          <div className="mt-6">
            <Image
              src={post.image_url}
              alt=""
              width={800}
              height={450}
              className="w-full rounded-lg object-cover"
            />
            <p className="mt-1 text-xs text-zinc-400">
              Stock photo (not a photo of the actual people or event) —{" "}
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

        <div className="mt-6 whitespace-pre-line text-zinc-800 leading-relaxed">
          {post.body}
        </div>

        <div className="mt-8 rounded border border-zinc-200 bg-white p-4 text-sm">
          <p className="font-medium text-zinc-700">Sources</p>
          <ul className="mt-2 space-y-1">
            {sources.map((s, i) => (
              <li key={i}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:underline"
                >
                  {s.source}: {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {post.similarity_note && (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">Automated similarity self-check</p>
            <p className="mt-1">{post.similarity_note}</p>
          </div>
        )}
      </main>
    </div>
  );
}
