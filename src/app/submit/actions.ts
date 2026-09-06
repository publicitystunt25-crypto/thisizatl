"use server";

import { redirect } from "next/navigation";
import { insertPost, setPostImage } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { processImageUpload } from "@/lib/image";
import { generateSpotlightArticle, ArtistSubmission } from "@/lib/spotlight";

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
    realName: String(formData.get("realName") || "").trim() || null,
    genre: required(formData, "genre"),
    atlantaConnection: required(formData, "atlantaConnection"),
    whatsNew: required(formData, "whatsNew"),
    bio: required(formData, "bio"),
    instagramUrl: required(formData, "instagramUrl"),
    musicUrl: required(formData, "musicUrl"),
  };

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    throw new Error("A photo is required");
  }
  if (!photo.type.startsWith("image/")) {
    throw new Error("Uploaded file is not an image");
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
  });

  const raw = Buffer.from(await photo.arrayBuffer());
  const { buffer, mime } = await processImageUpload(raw, 1600);
  await setPostImage(id, buffer, mime, `/api/uploads/${id}`, submission.artistName);

  redirect("/submit/thanks");
}
