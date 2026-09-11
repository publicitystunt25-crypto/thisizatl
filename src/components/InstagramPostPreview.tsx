import Image from "next/image";
import { getInstagramHandlesFromSources } from "@/lib/social";
import { generateFeedCaption } from "@/lib/generate";

// Mirrors the actual feed post: Claude generates the caption from the same
// title/body/handle Accept All would use, so this is a true preview rather
// than a guess -- not a static mock. Only attempted when there's a usable
// Instagram handle, same requirement the real posting flow has. Shared by
// both the admin draft preview and the public shareable draft link.
export default async function InstagramPostPreview({
  postId,
  title,
  body,
  sourcesJson,
}: {
  postId: number;
  title: string;
  body: string;
  sourcesJson: string;
}) {
  const { instagramHandle, collaboratorHandles } = getInstagramHandlesFromSources(sourcesJson);

  if (!instagramHandle) {
    return (
      <div className="mt-10 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
        No Instagram handle on this submission -- there&rsquo;s nobody to tag, so Accept All
        will only publish to Facebook and the Instagram Story, not the feed.
      </div>
    );
  }

  let caption: string | null = null;
  let error: string | null = null;
  try {
    caption = await generateFeedCaption({ title, body, instagramHandle });
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="mt-10">
      <h2 className="font-display mb-3 text-lg font-bold text-ink">Instagram Feed Preview</h2>
      <div className="mx-auto max-w-sm overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-full" />
          <span className="text-sm font-semibold text-ink">thisizatl</span>
        </div>
        <div className="relative aspect-[4/5] w-full bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element -- external composited JPEG, not an optimizable local asset. No cache-busting param needed: the endpoint itself is Cache-Control: no-store. */}
          <img
            src={`/api/feed-image/${postId}`}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <div className="space-y-2 px-3 py-3 text-sm text-zinc-800">
          {collaboratorHandles.length > 0 && (
            <p className="text-xs text-zinc-500">
              Collaborators: @{instagramHandle}
              {collaboratorHandles.map((h) => `, @${h}`).join("")}
            </p>
          )}
          {error ? (
            <p className="text-red-600">Caption generation failed: {error}</p>
          ) : (
            <p className="whitespace-pre-line">
              <span className="font-semibold">thisizatl</span> {caption}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
