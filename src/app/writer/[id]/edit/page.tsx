import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWriter } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import { getPostById, getPostImages } from "@/lib/db";
import { updateWriterPostAction, deleteWriterPostAction, deleteWriterGalleryImageAction } from "../../actions";
import SaveButton from "../../SaveButton";
import DeleteButton from "../../DeleteButton";
import PhotoPicker from "../../PhotoPicker";

export const dynamic = "force-dynamic";
// See src/app/writer/page.tsx -- same reasoning: the default 10s serverless
// timeout is too tight for a save that includes a real photo upload plus the
// vision-based focus-detection call.
export const maxDuration = 60;

export default async function EditWriterPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const writer = await requireWriter();
  const { id } = await params;
  const post = await getPostById(Number(id));

  // Same rule as the update action: a post that isn't yours (or doesn't
  // exist) is a 404, not a permission error, so it doesn't leak whether the
  // id belongs to someone else.
  if (!post || post.author !== writer.name) notFound();

  const galleryImages = await getPostImages(post.id);
  const updateWithId = updateWriterPostAction.bind(null, post.id);
  const deleteWithId = deleteWriterPostAction.bind(null, post.id);
  const deleteGalleryImageWithId = deleteWriterGalleryImageAction.bind(null, post.id);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-2xl px-6 py-4">
          <Link href="/writer" className="text-sm text-zinc-500 hover:underline">
            ← Back to your articles
          </Link>
          <h1 className="font-display mt-1 text-xl font-bold text-ink">Edit Article</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <form action={updateWithId} className="space-y-5" encType="multipart/form-data">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Title</label>
            <input
              type="text"
              name="title"
              required
              defaultValue={post.title}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Body</label>
            <textarea
              name="body"
              required
              rows={14}
              defaultValue={post.body}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm leading-relaxed focus:border-brand focus:outline-none"
            />
            <p className="mt-1 text-xs text-zinc-400">Separate paragraphs with a blank line.</p>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700">Category</label>
              <select
                name="category"
                defaultValue={post.category}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700">Status</label>
              <select
                name="status"
                defaultValue={post.status === "scheduled" ? "draft" : post.status}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              >
                <option value="draft">Save as draft</option>
                <option value="published">Publish now</option>
              </select>
            </div>
          </div>

          <PhotoPicker
            existingMain={post.image_url ? { url: post.image_url, credit: post.image_credit } : null}
            existingGallery={galleryImages.map((img) => ({
              id: img.id,
              url: `/api/gallery/${img.id}`,
              credit: img.credit,
            }))}
            onDeleteGalleryImage={async (imageId) => {
              "use server";
              await deleteGalleryImageWithId(imageId);
            }}
          />

          <SaveButton label="Save Changes" />
        </form>

        <form action={deleteWithId} className="mt-4">
          <DeleteButton />
        </form>
      </main>
    </div>
  );
}
