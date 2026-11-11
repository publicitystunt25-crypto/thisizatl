"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPostByReviewToken, recordReviewResponse, schedulePost, addReviewPhoto, type Post } from "@/lib/db";
import { processImageUpload } from "@/lib/image";
import { applyReviewChanges, scheduleRevisionEmail } from "@/lib/reviewRevision";
import { publishPostNow } from "@/lib/publishPost";
import { sendReviewResponseNotification } from "@/lib/email";
import { formatDateTime, fromEasternDatetimeLocalValue } from "@/lib/date";

// These run for whoever holds the emailed review link, with no login -- the
// secret token in the link is the whole credential. Each one only acts on an
// unpublished post that is still waiting on the submitter's answer, so a stale
// tab or a double click can't publish twice or override an earlier choice.
const MIN_LEAD_MINUTES = 10;
const MAX_SCHEDULE_DAYS = 60;
const MAX_REVIEW_PHOTOS = 5;

async function awaitingPost(token: string): Promise<Post | null> {
  const post = await getPostByReviewToken(token);
  if (!post) throw new Error("This review link isn't valid");
  if (post.status !== "draft" || post.review_status === "changes_requested" || post.review_status === "revising" || post.review_status === "approved") {
    return null;
  }
  return post;
}

async function tellNewsroom(
  post: Post,
  outcome: "live" | "scheduled" | "changes_requested" | "approved",
  detail: string | null,
  autoUpdate?: "updated" | "manual"
): Promise<void> {
  try {
    await sendReviewResponseNotification({
      postId: post.id,
      title: post.title,
      submitterEmail: post.submitter_email,
      outcome,
      detail,
      autoUpdate,
    });
  } catch (err) {
    console.error("Review response notification failed:", err);
  }
}

function done(token: string): never {
  revalidatePath("/admin");
  revalidatePath(`/review/${token}`);
  redirect(`/review/${token}`);
}

export async function goLiveNowAction(token: string): Promise<void> {
  const post = await awaitingPost(token);
  if (post?.hold_after_approval) {
    // Approved, but the newsroom asked to be told first rather than publishing.
    await recordReviewResponse(post.id, "approved", "Wants it to go live right away");
    await tellNewsroom(post, "approved", "They chose: go live right away.");
  } else if (post) {
    await publishPostNow(post.id);
    await recordReviewResponse(post.id, "live", null);
    await tellNewsroom(post, "live", null);
  }
  done(token);
}

export async function scheduleAction(token: string, formData: FormData): Promise<void> {
  const post = await awaitingPost(token);
  if (post) {
    const raw = String(formData.get("scheduledFor") || "").trim();
    const when = raw ? Date.parse(fromEasternDatetimeLocalValue(raw)) : NaN;
    const now = Date.now();
    if (
      Number.isNaN(when) ||
      when < now + MIN_LEAD_MINUTES * 60_000 ||
      when > now + MAX_SCHEDULE_DAYS * 24 * 3600_000
    ) {
      redirect(`/review/${token}?error=time`);
    }
    const iso = new Date(when).toISOString();
    const label = `${formatDateTime(iso)} Eastern`;
    if (post.hold_after_approval) {
      await recordReviewResponse(post.id, "approved", `Wants it to go live ${label}`);
      await tellNewsroom(post, "approved", `They chose: go live ${label}.`);
    } else {
      await schedulePost(post.id, iso);
      await recordReviewResponse(post.id, "scheduled", label);
      await tellNewsroom(post, "scheduled", label);
    }
  }
  done(token);
}

export async function requestChangesAction(token: string, formData: FormData): Promise<void> {
  const post = await awaitingPost(token);
  if (post) {
    const note = String(formData.get("note") || "").replace(/\r\n/g, "\n").trim().slice(0, 2000);
    if (note.length < 3) redirect(`/review/${token}?error=note`);
    const isFile = (f: FormDataEntryValue): f is File => f instanceof File && f.size > 0;
    const mainPhotos = formData.getAll("mainPhoto").filter(isFile).slice(0, 1);
    const extraPhotos = formData.getAll("photos").filter(isFile);
    if (extraPhotos.length > MAX_REVIEW_PHOTOS) redirect(`/review/${token}?error=photos`);
    if ([...mainPhotos, ...extraPhotos].some((p) => !p.type.startsWith("image/"))) {
      redirect(`/review/${token}?error=photoType`);
    }
    // One at a time to keep memory near a single photo's worth; an unreadable
    // photo is skipped rather than losing the whole request.
    const saved = { main: 0, extra: 0 };
    for (const [kind, list] of [["main", mainPhotos], ["extra", extraPhotos]] as const) {
      for (const photo of list) {
        try {
          const { buffer, mime } = await processImageUpload(Buffer.from(await photo.arrayBuffer()), 1600, false);
          await addReviewPhoto(post.id, buffer, mime, kind);
          saved[kind]++;
        } catch (err) {
          console.error("Review photo skipped:", err);
        }
      }
    }
    const notes: string[] = [];
    if (saved.main) notes.push("a new MAIN photo to replace the current one");
    if (saved.extra) notes.push(`${saved.extra} extra photo${saved.extra === 1 ? "" : "s"} to add`);
    const detail = notes.length ? `${note}\n\n[They sent ${notes.join(" and ")} -- see the row in the admin.]` : note;
    await recordReviewResponse(post.id, "changes_requested", note);

    // Make the edits now and email them the updated article in ~10 minutes. If
    // anything can't be done automatically it stays "changes requested" for a
    // person to finish, and nothing is emailed to the client.
    let auto: "updated" | "manual" = "manual";
    let extra = "";
    try {
      const result = await applyReviewChanges(post.id, note);
      if (result.ok) {
        await scheduleRevisionEmail(post.id);
        auto = "updated";
        extra = `\n\nWhat I changed: ${result.summary}`;
      } else {
        extra = `${result.summary ? `\n\nAlready done: ${result.summary}` : ""}\n\nNot done: ${result.reason}`;
      }
    } catch (err) {
      console.error("Auto-applying review changes failed:", err);
      extra = "\n\nThe automatic update hit an error.";
    }
    await tellNewsroom(post, "changes_requested", detail + extra, auto);
  }
  done(token);
}
