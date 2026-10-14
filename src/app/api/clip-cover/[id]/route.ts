import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getVideoSubmission } from "@/lib/db";
import { renderClipCover, coverResponse } from "@/lib/clipCover";

function tokenMatches(expected: string | null, given: string | null): boolean {
  if (!expected || !given || expected.length !== given.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

// Public, because Instagram has to download it. It only ever renders the
// headline saved with the submission, and only in two cases: while the clip
// is being posted (Instagram fetching its cover), or when the request carries
// the random token given to the submitter right after they upload -- so it
// can't be used to make arbitrary images.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const submission = await getVideoSubmission(Number(id));
  const token = new URL(req.url).searchParams.get("t");
  const allowed =
    submission &&
    submission.headline &&
    (submission.status === "posting" ||
      (tokenMatches(submission.cover_token, token) &&
        ["pending", "failed", "posting"].includes(submission.status)));
  if (!submission || !allowed || !submission.headline) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const cover = await renderClipCover(submission.video_public_id, submission.headline);
  if (!cover) return NextResponse.json({ error: "Frame unavailable" }, { status: 502 });
  return coverResponse(cover);
}
