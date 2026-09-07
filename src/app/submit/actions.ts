"use server";

import { redirect } from "next/navigation";
import { insertPost, setPostImage, hasRecentSubmissionByArtist } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { processImageUpload } from "@/lib/image";
import { generateSpotlightArticle, ArtistSubmission } from "@/lib/spotlight";
import { sendSubmissionNotification } from "@/lib/email";
import { normalizeInstagramInput } from "@/lib/social";

function required(formData: FormData, field: string): string {
  const value = String(formData.get(field) || "").trim();
  if (!value) throw new Error(`${field} is required`);
  return value;
}

function optional(formData: FormData, field: string): string | null {
  return String(formData.get(field) || "").trim() || null;
}

export async function submitArtistAction(formData: FormData): Promise<void> {
  // Honeypot: real visitors never see or fill this field (hidden via CSS),
  // so anything in it means an automated bot filled out every input blindly.
  if (String(formData.get("company") || "").trim()) {
    redirect("/");
  }

  const submission: ArtistSubmission = {
    artistName: required(formData, "artistName"),
    pronouns: required(formData, "pronouns"),
    hometown: optional(formData, "hometown"),
    genre: required(formData, "genre"),
    origin: optional(formData, "origin"),
    biggestInspiration: optional(formData, "biggestInspiration"),
    whatsNew: optional(formData, "whatsNew"),
    takeaway: optional(formData, "takeaway"),
    bio: optional(formData, "bio"),
    instagramUrl: normalizeInstagramInput(String(formData.get("instagramUrl") || "")),
    musicUrl: optional(formData, "musicUrl"),
    followsInstagram: formData.get("followsInstagram") === "yes",
    anythingElse: optional(formData, "anythingElse"),
  };

  const submitterEmail = required(formData, "submitterEmail");

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    throw new Error("A photo is required");
  }
  if (!photo.type.startsWith("image/")) {
    throw new Error("Uploaded file is not an image");
  }

  // Guards against someone hitting back/reload and resubmitting a fresh page
  // -- a disabled submit button can't catch that since it's a brand new page
  // load. If this artist already has a submission from the last 10 minutes,
  // treat this as a duplicate: skip the Claude call and DB insert entirely,
  // but still show the normal "thanks" confirmation so it doesn't look broken.
  if (await hasRecentSubmissionByArtist(submission.artistName)) {
    redirect("/submit/thanks");
  }

  const article = await generateSpotlightArticle(submission);

  const sources: { title: string; url: string; source: string }[] = [];
  if (submission.instagramUrl) {
    sources.push({ title: "Follow on Instagram", url: submission.instagramUrl, source: "Instagram" });
  }
  if (submission.musicUrl) {
    sources.push({ title: "Listen", url: submission.musicUrl, source: "Music" });
  }

  const slug = slugify(article.title);
  const id = await insertPost({
    slug,
    title: article.title,
    body: article.body,
    sources,
    similarity_note: null,
    image_url: null,
    image_credit_name: null,
    image_credit_url: null,
    category: article.category,
    status: "draft",
    author: "ThisIzATL Staff",
    submitter_email: submitterEmail,
  });

  const raw = Buffer.from(await photo.arrayBuffer());
  const { buffer, mime, width, height } = await processImageUpload(raw, 1600);
  await setPostImage(id, buffer, mime, `/api/uploads/${id}`, submission.artistName, { width, height });

  try {
    await sendSubmissionNotification(submission, id);
  } catch (err) {
    console.error("Submission notification email failed:", err);
  }

  redirect("/submit/thanks");
}
