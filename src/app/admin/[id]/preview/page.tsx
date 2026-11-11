import { notFound } from "next/navigation";
import Link from "next/link";
import { getPostById, getPostImages } from "@/lib/db";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import DraftArticleBody from "@/components/DraftArticleBody";
import InstagramPostPreview from "@/components/InstagramPostPreview";
import ReviewActions from "@/app/review/ReviewActions";
import { resolveInstagramHandles } from "@/lib/social";
import { toEasternDatetimeLocalValue } from "@/lib/date";
import { demoGoLive, demoSchedule, demoRequestChanges } from "./demoActions";

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
  const planned = resolveInstagramHandles(post);
  const defaultHandles = [planned.instagramHandle, ...planned.collaboratorHandles]
    .filter((h): h is string => !!h)
    .map((h) => `@${h}`)
    .join(", ");

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
        {post.status !== "published" && (
          <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-5">
            <div className="space-y-4">
              <div>
                <p className="font-display text-lg font-bold text-ink">Your feature is ready</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Read it below, then approve it or ask for changes. Nothing goes live until you approve.
                </p>
              </div>
              <ReviewActions
                minValue={toEasternDatetimeLocalValue(new Date().toISOString())}
                defaultHandles={defaultHandles}
                goLive={demoGoLive}
                schedule={demoSchedule}
                requestChanges={demoRequestChanges}
              />
              <p className="rounded-lg bg-yellow-100 p-2 text-xs text-zinc-700">
                Admin view of what the submitter sees. These buttons do nothing here.
              </p>
            </div>
          </section>
        )}

        <DraftArticleBody post={post} galleryImages={galleryImages} />

        {post.image_url && (
          <InstagramPostPreview
            postId={post.id}
            title={post.title}
            body={post.body}
            sourcesJson={post.sources}
            collabHandlesJson={post.collab_handles}
            tagHandlesJson={post.tag_handles}
          />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
