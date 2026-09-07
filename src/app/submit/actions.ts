"use server";

import { redirect } from "next/navigation";
import { insertPost, setPostImage, hasRecentSubmissionByArtist } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { processImageUpload } from "@/lib/image";
import { generateSpotlightArticle, ArtistSubmission } from "@/lib/spotlight";
import { sendSubmissionNotification } from "@/lib/email";

function required(formData: FormData, field: string): string {
  const value = String(formData.get(field) || "").trim();
  if (!value) throw new Error(`${field} is required`);
  return value;
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
    genre: required(formData, "genre"),
    origin: required(formData, "origin"),
    biggestInspiration: required(formData, "biggestInspiration"),
    whatsNew: required(formData, "whatsNew"),
    takeaway: required(formData, "takeaway"),
    bio: required(formData, "bio"),
    instagramUrl: required(formData, "instagramUrl"),
    musicUrl: required(formData, "musicUrl"),
    anythingElse: String(formData.get("anythingElse") || "").trim() || null,
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

  const slug = slugify(article.title);
  const id = await insertPost({
    slug,
    title: article.title,
    body: article.body,
    sources: [
      { title: "Follow on Instagram", url: submission.instagramUrl, source: "Instagram" },
      { title: "Listen", url: submission.musicUrl, source: "Music" },
    ],
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
