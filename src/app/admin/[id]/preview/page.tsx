import { notFound } from "next/navigation";
import Link from "next/link";
import { getPostById, getPostImages } from "@/lib/db";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import DraftArticleBody from "@/components/DraftArticleBody";
import InstagramPostPreview from "@/components/InstagramPostPreview";

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
        <DraftArticleBody post={post} galleryImages={galleryImages} />

        {post.image_url && (
          <InstagramPostPreview
            postId={post.id}
            title={post.title}
            body={post.body}
            sourcesJson={post.sources}
          />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
