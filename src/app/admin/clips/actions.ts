"use server";

import { requireAdmin } from "@/lib/auth";
import {
  cloudinaryConfig,
  deleteClipAssets,
  overlayPosterUrl,
  clipIsLandscape,
  overlayVideoUrl,
  renderOverlayVideo,
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

export type PreviewResult =
  | { ok: true; videoUrl: string; posterUrl: string }
  | { ok: false; error: string };

// Renders the overlay and returns the finished video so it can be reviewed
// before anything is posted. This runs inside a web request (and Cloudflare
// gives up on those after ~100s), so it stops waiting at 80s; Cloudinary
// keeps rendering, and pressing the button again a minute later is instant.
export async function previewClipOverlayAction(id: number, headline: string): Promise<PreviewResult> {
  await requireAdmin();
  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: "Cloudinary isn't configured." };

  const submission = await getVideoSubmission(id);
  if (!submission) return { ok: false, error: "Submission not found." };

  const text = cleanHeadline(headline);
  const landscape = await clipIsLandscape(config, submission.video_public_id).catch(() => false);
  try {
    const finished = await renderOverlayVideo(config, submission.video_public_id, text, 80_000, landscape);
    if (!finished) {
      return { ok: false, error: "Still rendering -- give it a minute and press Preview again." };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't render the overlay." };
  }
  return {
    ok: true,
    videoUrl: overlayVideoUrl(config, submission.video_public_id, text, landscape),
    posterUrl: overlayPosterUrl(config, submission.video_public_id, text, landscape),
  };
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
  collaboratorRaw: string
): Promise<ApproveResult> {
  await requireAdmin();
  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: "Cloudinary isn't configured." };

  const headline = cleanHeadline(headlineRaw);
  const caption = captionRaw.trim().slice(0, 2200);
  if (!headline) return { ok: false, error: "Add a headline for the overlay first." };
  if (!caption) return { ok: false, error: "Add an Instagram caption first." };

  const collaborators: string[] = [];
  const handle = collaboratorRaw.trim() ? toHandle(collaboratorRaw) : null;
  if (collaboratorRaw.trim() && !handle) {
    return { ok: false, error: "That collaborator handle doesn't look right." };
  }
  if (handle) collaborators.push(handle);

  const claimed = await claimVideoSubmissionForPosting(id, headline, caption);
  if (!claimed) return { ok: false, error: "This clip is already posting, posted, or declined." };

  void runClipPost(claimed.id, claimed.video_public_id, headline, caption, collaborators);
  return { ok: true };
}

async function runClipPost(
  id: number,
  publicId: string,
  headline: string,
  caption: string,
  collaborators: string[]
): Promise<void> {
  const config = cloudinaryConfig();
  try {
    if (!config) throw new Error("Cloudinary isn't configured.");

    const landscape = await clipIsLandscape(config, publicId);
    const finished = await renderOverlayVideo(config, publicId, headline, 10 * 60 * 1000, landscape);
    if (!finished) throw new Error("The overlay took too long to render. Try again.");

    const mediaId = await postReel({
      videoUrl: overlayVideoUrl(config, publicId, headline, landscape),
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
