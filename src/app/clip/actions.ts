"use server";

import { cloudinaryConfig, createUploadSignature, fetchUploadedVideo } from "@/lib/cloudinary";
import { insertVideoSubmission } from "@/lib/db";
import { sendClipSubmissionNotification } from "@/lib/email";
import { normalizeInstagramInput } from "@/lib/social";
import { MAX_HEADLINE_LENGTH } from "@/lib/coverLayout";
import { CLIP_FOLDER, MAX_CLIP_BYTES, MAX_CLIP_SECONDS } from "./limits";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Every signature lets someone upload into your Cloudinary account (and use
// its storage), so cap how many get handed out per hour across the whole
// site. In-memory is fine here: it's a single always-on server, and a restart
// only resets the counter.
const SIGNATURE_LIMIT_PER_HOUR = 40;
let signatureTimes: number[] = [];

export type UploadTicket =
  | {
      ok: true;
      cloudName: string;
      apiKey: string;
      timestamp: number;
      folder: string;
      signature: string;
    }
  | { ok: false; error: string };

export async function getClipUploadTicket(): Promise<UploadTicket> {
  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: "Video uploads aren't available right now." };

  const now = Date.now();
  signatureTimes = signatureTimes.filter((t) => now - t < 60 * 60 * 1000);
  if (signatureTimes.length >= SIGNATURE_LIMIT_PER_HOUR) {
    return { ok: false, error: "We're getting a lot of uploads right now -- please try again in a bit." };
  }
  signatureTimes.push(now);

  const { timestamp, folder, signature } = createUploadSignature(config);
  return { ok: true, cloudName: config.cloudName, apiKey: config.apiKey, timestamp, folder, signature };
}

export type SubmitClipInput = {
  name: string;
  headline: string;
  email: string;
  instagram: string;
  caption: string;
  consent: boolean;
  company: string; // honeypot
  publicId: string;
};

export type SubmitClipResult = { ok: true } | { ok: false; error: string };

export async function submitClipAction(input: SubmitClipInput): Promise<SubmitClipResult> {
  // Honeypot: real people never see this field.
  if (input.company.trim()) return { ok: true };

  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: "Video uploads aren't available right now." };

  const name = input.name.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!name) return { ok: false, error: "Please enter your name." };

  const headline = input.headline.replace(/\s+/g, " ").trim().slice(0, MAX_HEADLINE_LENGTH);
  if (!headline) return { ok: false, error: "Please write a headline for the cover image." };

  const caption = input.caption.trim().slice(0, 2000);
  if (!caption) return { ok: false, error: "Please write a caption for your clip." };

  const email = input.email.trim().slice(0, 200) || null;
  if (email && !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "That email address doesn't look right -- fix it or leave it blank." };
  }

  const rawInstagram = input.instagram.trim().slice(0, 200);
  const instagram = rawInstagram ? normalizeInstagramInput(rawInstagram) ?? rawInstagram : null;

  if (!input.consent) {
    return { ok: false, error: "Please confirm the clip is yours to share." };
  }

  // The public_id comes from the browser, so only accept one inside the
  // folder we issue signatures for, then confirm with Cloudinary itself that
  // it exists and is within the limits -- never trust the browser's numbers.
  if (!input.publicId.startsWith(`${CLIP_FOLDER}/`) || input.publicId.includes("..")) {
    return { ok: false, error: "Something went wrong with the upload. Please try again." };
  }
  const video = await fetchUploadedVideo(config, input.publicId);
  if (!video) {
    return { ok: false, error: "We couldn't find your uploaded video. Please try again." };
  }
  if (video.bytes > MAX_CLIP_BYTES) {
    return { ok: false, error: "That video is too large." };
  }
  if (video.duration != null && video.duration > MAX_CLIP_SECONDS + 1) {
    return { ok: false, error: `Clips need to be ${MAX_CLIP_SECONDS} seconds or shorter.` };
  }

  const id = await insertVideoSubmission({
    submitter_name: name,
    submitter_email: email,
    submitter_instagram: instagram,
    caption,
    headline,
    video_public_id: input.publicId,
    video_url: video.secure_url,
    duration_seconds: video.duration,
    bytes: video.bytes,
  });

  // null means this exact upload was already saved (a double-click/retry) --
  // it's already on its way to the newsroom, so don't email twice.
  if (id !== null) {
    try {
      await sendClipSubmissionNotification({
        name,
        email,
        instagram,
        caption,
        videoUrl: video.secure_url,
        durationSeconds: video.duration,
      });
    } catch (err) {
      console.error("Clip submission notification email failed:", err);
    }
  }

  return { ok: true };
}
