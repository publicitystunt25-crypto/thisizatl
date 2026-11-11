import Image from "next/image";
import { resolveInstagramHandles } from "@/lib/social";
import { generateFeedCaption } from "@/lib/generate";

// Mirrors the actual feed post: Claude generates the caption from the same
// title/body/handle Accept All would use, so this is a true preview rather
// than a guess -- not a static mock. Stories without an Instagram account
// still get a feed post, just with nobody to invite. Shared by both the admin
// draft preview and the public shareable draft link.
export default async function InstagramPostPreview({
  postId,
  title,
  body,
  sourcesJson,
  collabHandlesJson,
  tagHandlesJson,
}: {
  postId: number;
  title: string;
  body: string;
  sourcesJson: string;
  collabHandlesJson?: string | null;
  tagHandlesJson?: string | null;
}) {
  // The feed-image endpoint sends Cache-Control: no-store, but that's not
  // always honored by every layer between here and the viewer (the same
  // real posting flow needed a cache-busting param for this exact reason --
  // a stale cached render of this composite got served, with old text baked
  // into the image, well after the underlying code was already fixed). A
  // fresh timestamp per render guards against that regardless of the cause.
  const imageCacheBuster = Date.now();
  const { instagramHandle, collaboratorHandles } = resolveInstagramHandles({
    sources: sourcesJson,
    collab_handles: collabHandlesJson ?? null,
  });
  let tagHandles: string[] = [];
  try {
    tagHandles = tagHandlesJson ? (JSON.parse(tagHandlesJson) as string[]) : [];
  } catch {
    tagHandles = [];
  }
  const invited = new Set([instagramHandle, ...collaboratorHandles].filter(Boolean));
  const toTag = tagHandles.filter((h) => !invited.has(h));

  let caption: string | null = null;
  let error: string | null = null;
  try {
    caption = await generateFeedCaption({ title, body, instagramHandle });
    if (toTag.length) caption = `${caption}\n\n${toTag.map((h) => "@" + h).join(" ")}`;
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
          {/* eslint-disable-next-line @next/next/no-img-element -- external composited JPEG, not an optimizable local asset. */}
          <img
            src={`/api/feed-image/${postId}?t=${imageCacheBuster}`}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <div className="space-y-2 px-3 py-3 text-sm text-zinc-800">
          {(instagramHandle || collaboratorHandles.length > 0) && (
            <p className="text-xs text-zinc-500">
              Collaborators: {[instagramHandle, ...collaboratorHandles].filter(Boolean).map((h) => "@" + h).join(", ")}
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
