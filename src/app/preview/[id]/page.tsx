import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPostById, getPostImages } from "@/lib/db";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import DraftArticleBody from "@/components/DraftArticleBody";
import InstagramPostPreview from "@/components/InstagramPostPreview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// A plain, shareable read link for a draft/pending article -- no admin login
// required, unlike /admin/[id]/preview. For sending a draft to the artist or
// anyone else to read before it goes live. Anyone with the link can view it
// (there's no admin auth here by design), so this is only as private as the
// link itself -- same posture as the existing public /api/uploads/[id] photo
// URLs, which already work the same way.
export default async function SharedDraftPreviewPage({
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
      <div className="bg-blue-100 px-6 py-2 text-center text-sm font-medium text-ink">
        This is a preview of an upcoming ThisIzATL article -- it isn&rsquo;t live yet.
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
