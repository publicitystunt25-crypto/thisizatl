import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostById, getPostImages } from "@/lib/db";
import { updatePostAction } from "../../actions";
import PostFormFields from "../../PostFormFields";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPostById(Number(id));
  if (!post) notFound();

  const galleryImages = await getPostImages(post.id);
  const updateWithId = updatePostAction.bind(null, post.id);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-2xl px-6 py-4">
          <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
            ← Back to admin
          </Link>
          <h1 className="font-display mt-1 text-xl font-bold text-ink">
            Edit Post
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <form action={updateWithId} className="space-y-5">
          <PostFormFields
            defaultTitle={post.title}
            defaultBody={post.body}
            defaultCategory={post.category}
            defaultStatus={post.status}
            currentImageUrl={post.image_url}
            currentImageCredit={post.image_credit}
            existingGalleryImages={galleryImages.map((img) => ({
              id: img.id,
              url: `/api/gallery/${img.id}`,
              credit: img.credit,
            }))}
          />
          <button
            type="submit"
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Save Changes
          </button>
        </form>
      </main>
    </div>
  );
}
