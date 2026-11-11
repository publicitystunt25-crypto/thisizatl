"use server";

import { redirect } from "next/navigation";
import { insertPost, setPostImage, addPostImages, hasRecentSubmissionByArtist } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { processImageUpload } from "@/lib/image";
import { generateSpotlightArticle, ArtistSubmission } from "@/lib/spotlight";
import { generateProfileArticle, ProfileSubmission } from "@/lib/profile";
import { sendSubmissionNotification, sendOtherSubmissionNotification } from "@/lib/email";
import { normalizeInstagramInput, isInstagramUrl } from "@/lib/social";

function required(formData: FormData, field: string): string {
  const value = String(formData.get(field) || "").trim();
  if (!value) throw new Error(`${field} is required`);
  return value;
}

function optional(formData: FormData, field: string): string | null {
  return String(formData.get(field) || "").trim() || null;
}

// Up to 5 additional Instagram accounts to invite as Feed-post collaborators
// -- the submission form's "which pages should we collaborate with"
// question, all sharing the name "collabHandle" so they collect into one
// array here.
function readCollaboratorUrls(formData: FormData): string[] {
  return formData
    .getAll("collabHandle")
    .map((v) => normalizeInstagramInput(String(v)))
    .filter((v): v is string => !!v)
    .slice(0, 5);
}

// Keeps the whole upload under the server's 75MB body limit and 512MB of RAM.
const MAX_SUBMISSION_PHOTOS = 6;

// The first photo is the article's main image; any others go into its
// gallery, same as the writer area.
function readPhotos(formData: FormData): File[] {
  const photos = formData.getAll("photo").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length === 0) {
    throw new Error("A photo is required");
  }
  if (photos.length > MAX_SUBMISSION_PHOTOS) {
    throw new Error(`Please upload no more than ${MAX_SUBMISSION_PHOTOS} photos`);
  }
  if (photos.some((p) => !p.type.startsWith("image/"))) {
    throw new Error("Uploaded file is not an image");
  }
  return photos;
}

// One photo at a time, so peak memory stays near a single photo's worth --
// see processAndSaveNewPhotos in the writer actions for why that matters.
async function saveSubmissionPhotos(postId: number, photos: File[], credit: string): Promise<void> {
  for (let i = 0; i < photos.length; i++) {
    const raw = Buffer.from(await photos[i].arrayBuffer());
    const { buffer, mime, width, height, focus } = await processImageUpload(raw, 1600, i === 0);
    if (i === 0) {
      await setPostImage(postId, buffer, mime, `/api/uploads/${postId}`, credit, { width, height }, focus);
    } else {
      await addPostImages(postId, [{ data: buffer, mime, credit }]);
    }
  }
}

export async function submitArtistAction(formData: FormData): Promise<void> {
  // Honeypot: real visitors never see or fill this field (hidden via CSS),
  // so anything in it means an automated bot filled out every input blindly.
  if (String(formData.get("company") || "").trim()) {
    redirect("/");
  }

  let instagramUrl = normalizeInstagramInput(String(formData.get("instagramUrl") || ""));
  let musicUrl = optional(formData, "musicUrl");

  // Someone occasionally pastes their Instagram link into the wrong field --
  // if the Instagram question was left blank but the music-link field is
  // actually an instagram.com URL, use that as their Instagram instead of
  // filing it as a "Music" source where it'd never get tagged/collabed.
  if (!instagramUrl && isInstagramUrl(musicUrl)) {
    instagramUrl = musicUrl;
    musicUrl = null;
  }

  const collaboratorUrls = readCollaboratorUrls(formData);

  const submission: ArtistSubmission = {
    artistName: required(formData, "artistName"),
    pronouns: required(formData, "pronouns"),
    hometown: optional(formData, "hometown"),
    genre: required(formData, "genre"),
    origin: required(formData, "origin"),
    biggestInspiration: required(formData, "biggestInspiration"),
    whatsNew: required(formData, "whatsNew"),
    takeaway: optional(formData, "takeaway"),
    bio: optional(formData, "bio"),
    instagramUrl,
    musicUrl,
    followsInstagram: formData.get("collabFollowsInstagram") === "yes",
    anythingElse: optional(formData, "anythingElse"),
  };

  const submitterEmail = required(formData, "submitterEmail");

  const photos = readPhotos(formData);

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
  for (const url of collaboratorUrls) {
    sources.push({ title: "Collaborate", url, source: "Collaborator" });
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

  await saveSubmissionPhotos(id, photos, submission.artistName);

  try {
    await sendSubmissionNotification(submission, id, collaboratorUrls);
  } catch (err) {
    console.error("Submission notification email failed:", err);
  }

  redirect("/submit/thanks");
}

export async function submitOtherAction(formData: FormData): Promise<void> {
  // Honeypot: real visitors never see or fill this field (hidden via CSS),
  // so anything in it means an automated bot filled out every input blindly.
  if (String(formData.get("company") || "").trim()) {
    redirect("/");
  }

  let instagramUrl = normalizeInstagramInput(String(formData.get("instagramUrl") || ""));
  let linkUrl = optional(formData, "linkUrl");

  // Same cross-field detection as the artist form -- a link to their
  // work/website that's actually an Instagram URL (this exact mixup
  // happened with a live submission: an Instagram reel link filed under
  // "Link to Your Work" instead of the Instagram question).
  if (!instagramUrl && isInstagramUrl(linkUrl)) {
    instagramUrl = linkUrl;
    linkUrl = null;
  }

  const collaboratorUrls = readCollaboratorUrls(formData);

  const submission: ProfileSubmission = {
    name: required(formData, "name"),
    pronouns: required(formData, "pronouns"),
    hometown: optional(formData, "hometown"),
    profession: required(formData, "profession"),
    origin: required(formData, "origin"),
    biggestInspiration: required(formData, "biggestInspiration"),
    whatsNew: required(formData, "whatsNew"),
    takeaway: optional(formData, "takeaway"),
    bio: optional(formData, "bio"),
    instagramUrl,
    linkUrl,
    followsInstagram: formData.get("collabFollowsInstagram") === "yes",
    anythingElse: optional(formData, "anythingElse"),
  };

  const submitterEmail = required(formData, "submitterEmail");

  const photos = readPhotos(formData);

  // Same duplicate-submission guard as the artist path, keyed by name.
  if (await hasRecentSubmissionByArtist(submission.name)) {
    redirect("/submit/thanks");
  }

  const article = await generateProfileArticle(submission);

  const sources: { title: string; url: string; source: string }[] = [];
  if (submission.instagramUrl) {
    sources.push({ title: "Follow on Instagram", url: submission.instagramUrl, source: "Instagram" });
  }
  if (submission.linkUrl) {
    sources.push({ title: "Visit", url: submission.linkUrl, source: "Website" });
  }
  for (const url of collaboratorUrls) {
    sources.push({ title: "Collaborate", url, source: "Collaborator" });
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

  await saveSubmissionPhotos(id, photos, submission.name);

  try {
    await sendOtherSubmissionNotification(submission, id, collaboratorUrls);
  } catch (err) {
    console.error("Submission notification email failed:", err);
  }

  redirect("/submit/thanks");
}
