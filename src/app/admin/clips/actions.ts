"use server";

import { requireAdmin } from "@/lib/auth";
import {
  blurFillVideoUrl,
  cloudinaryConfig,
  clipIsLandscape,
  deleteClipAssets,
  renderBlurFillVideo,
} from "@/lib/cloudinary";
import {
  claimVideoSubmissionForPosting,
  getVideoSubmission,
  markVideoSubmissionDeclined,
  markVideoSubmissionFailed,
  markVideoSubmissionPosted,
} from "@/lib/db";
import { postReel } from "@/lib/reels";
import { extractInstagramHandle, normalizeInstagramInput } from "@/lib/social";

function cleanHeadline(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 140);
}

// Accepts "@handle", "handle" or a full Instagram link; returns the bare
// username, or null if there's nothing usable.
function toHandle(raw: string): string | null {
  const url = normalizeInstagramInput(raw);
  return url ? extractInstagramHandle(url) : null;
}

export type ApproveResult = { ok: true } | { ok: false; error: string };

// Starts posting and returns immediately: rendering plus Instagram's video
// processing can take several minutes, far longer than a web request is
// allowed to run, so the work continues in the background on this
// always-on server and the admin page shows the live status.
export async function approveClipAction(
  id: number,
  headlineRaw: string,
  captionRaw: string,
  collaboratorsRaw: string[]
): Promise<ApproveResult> {
  await requireAdmin();
  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: "Cloudinary isn't configured." };

  const headline = cleanHeadline(headlineRaw);
  const caption = captionRaw.trim().slice(0, 2200);
  if (!headline) return { ok: false, error: "Add a headline for the cover image first." };
  if (!caption) return { ok: false, error: "Add an Instagram caption first." };

  // Instagram allows at most 3 collaborators on one post.
  const collaborators: string[] = [];
  for (const raw of collaboratorsRaw) {
    if (!raw.trim()) continue;
    const handle = toHandle(raw);
    if (!handle) return { ok: false, error: `"${raw.trim()}" doesn't look like an Instagram handle.` };
    if (!collaborators.includes(handle)) collaborators.push(handle);
  }
  if (collaborators.length > 3) {
    return { ok: false, error: "Instagram allows up to 3 collaborators on one post." };
  }

  const claimed = await claimVideoSubmissionForPosting(id, headline, caption);
  if (!claimed) return { ok: false, error: "This clip is already posting, posted, or declined." };

  void runClipPost(claimed.id, claimed.video_public_id, claimed.video_url, caption, collaborators);
  return { ok: true };
}

async function runClipPost(
  id: number,
  publicId: string,
  videoUrl: string,
  caption: string,
  collaborators: string[]
): Promise<void> {
  const config = cloudinaryConfig();
  try {
    if (!config) throw new Error("Cloudinary isn't configured.");

    // Vertical clips go out as uploaded. Widescreen ones are rebuilt first with
    // a blurred copy of the video filling the black bars. The branded look is
    // the cover image, which Instagram fetches from this site while it
    // processes the Reel.
    let finalVideoUrl = videoUrl;
    if (await clipIsLandscape(config, publicId)) {
      const ready = await renderBlurFillVideo(config, publicId, 10 * 60 * 1000);
      if (!ready) throw new Error("The widescreen version took too long to build. Try again.");
      finalVideoUrl = blurFillVideoUrl(config, publicId);
    }
    const siteUrl = process.env.SITE_URL || "https://thisizatl.com";
    const mediaId = await postReel({
      videoUrl: finalVideoUrl,
      coverUrl: `${siteUrl}/api/clip-cover/${id}`,
      caption,
      collaborators,
    });
    await markVideoSubmissionPosted(id, mediaId);

    // Instagram has its own copy now; free the Cloudinary storage.
    await deleteClipAssets(config, publicId).catch((err) =>
      console.error("Couldn't delete clip assets after posting:", err)
    );
  } catch (err) {
    console.error("Clip post failed:", err);
    await markVideoSubmissionFailed(id, err instanceof Error ? err.message : String(err));
  }
}

export async function declineClipAction(id: number): Promise<{ ok: boolean }> {
  await requireAdmin();
  const submission = await getVideoSubmission(id);
  if (!submission) return { ok: false };
  if (submission.status !== "pending" && submission.status !== "failed") return { ok: false };

  await markVideoSubmissionDeclined(id);
  const config = cloudinaryConfig();
  if (config) {
    await deleteClipAssets(config, submission.video_public_id).catch((err) =>
      console.error("Couldn't delete declined clip:", err)
    );
  }
  return { ok: true };
}
