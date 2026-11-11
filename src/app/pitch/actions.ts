"use server";

import { insertCoverageRequest, countRecentCoverageRequests, addCoverageRequestImage } from "@/lib/db";
import { processImageUpload } from "@/lib/image";
import { sendCoverageRequestNotification, sendCoverageRequestReceipt } from "@/lib/email";
import { normalizeInstagramInput } from "@/lib/social";
import { REQUESTER_ROLES, REQUEST_TYPES, MAX_PITCH_PHOTOS, MAX_PITCH_DETAILS_CHARS } from "@/lib/coverage";
import type { PitchState, PitchValues } from "./PitchForm";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Flood guards for a public form that emails the newsroom: a cap on the whole
// site per hour, and on any one email address per day.
const MAX_SITE_PER_HOUR = 30;
const MAX_PER_EMAIL_PER_DAY = 3;

function field(formData: FormData, name: string): string {
  return String(formData.get(name) || "");
}

function oneLine(raw: string, max: number): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, max);
}

// The sender's name is dropped into an email that goes back to the address
// they typed, so keep it to a plain name: no links or email addresses.
function cleanPersonName(raw: string): string | null {
  const name = oneLine(raw, 80);
  if (!name) return null;
  if (/https?:|www\.|[<>@]|\.(com|net|org|co|io|me|ly)\b/i.test(name)) return null;
  return name;
}

function parseHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function requestCoverageAction(
  _prev: PitchState,
  formData: FormData
): Promise<PitchState> {
  // Honeypot: real visitors never see this field, so anything in it means a
  // bot filled in every input -- act like it worked without saving anything.
  if (field(formData, "company").trim()) {
    return { status: "success" };
  }

  const values: PitchValues = {
    requesterName: field(formData, "requesterName"),
    requesterEmail: field(formData, "requesterEmail"),
    requesterPhone: field(formData, "requesterPhone"),
    organization: field(formData, "organization"),
    role: field(formData, "role"),
    subjectName: field(formData, "subjectName"),
    subjectInstagram: field(formData, "subjectInstagram"),
    requestType: field(formData, "requestType"),
    details: field(formData, "details"),
    eventDate: field(formData, "eventDate"),
    deadline: field(formData, "deadline"),
    pressKitUrl: field(formData, "pressKitUrl"),
    otherLinks: field(formData, "otherLinks"),
  };
  const fail = (message: string): PitchState => ({ status: "error", message, values });

  const requesterName = cleanPersonName(values.requesterName);
  if (!requesterName) {
    return fail("Please enter your name (just your name -- no links or email addresses).");
  }

  const requesterEmail = values.requesterEmail.trim().slice(0, 200);
  if (!EMAIL_PATTERN.test(requesterEmail)) {
    return fail("Please enter a valid email address so we can reach you.");
  }

  const subjectName = oneLine(values.subjectName, 160);
  if (!subjectName) {
    return fail("Please tell us who or what the coverage is about.");
  }

  const details = values.details.replace(/\r\n/g, "\n").trim().slice(0, MAX_PITCH_DETAILS_CHARS);
  if (details.length < 20) {
    return fail("Please tell us a bit more about what you're pitching (a few sentences is plenty).");
  }

  const pressKitRaw = values.pressKitUrl.trim();
  const pressKitUrl = pressKitRaw ? parseHttpUrl(pressKitRaw) : null;
  if (pressKitRaw && !pressKitUrl) {
    return fail("The press kit link needs to be a full web address starting with http:// or https://.");
  }

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length > MAX_PITCH_PHOTOS) {
    return fail(`Please attach no more than ${MAX_PITCH_PHOTOS} photos. Photos have to be chosen again after this message.`);
  }
  if (photos.some((p) => !p.type.startsWith("image/"))) {
    return fail("Only image files can be attached. Photos have to be chosen again after this message.");
  }

  const { siteLastHour, emailLastDay } = await countRecentCoverageRequests(requesterEmail);
  if (siteLastHour >= MAX_SITE_PER_HOUR) {
    return fail("We're getting a lot of requests right now -- please try again in a little while.");
  }
  if (emailLastDay >= MAX_PER_EMAIL_PER_DAY) {
    return fail("We already have several requests from this email today -- we'll be in touch if we can cover them.");
  }

  const rawInstagram = oneLine(values.subjectInstagram, 200);
  // A handle that doesn't parse is kept as typed rather than dropped, so the
  // team still sees what the person meant.
  const subjectInstagram = rawInstagram ? normalizeInstagramInput(rawInstagram) ?? rawInstagram : null;

  const request = {
    requester_name: requesterName,
    requester_email: requesterEmail,
    requester_phone: oneLine(values.requesterPhone, 40) || null,
    organization: oneLine(values.organization, 120) || null,
    role: (REQUESTER_ROLES as readonly string[]).includes(values.role) ? values.role : "Other",
    subject_name: subjectName,
    subject_instagram: subjectInstagram,
    request_type: (REQUEST_TYPES as readonly string[]).includes(values.requestType)
      ? values.requestType
      : "Other",
    details,
    event_date: DATE_PATTERN.test(values.eventDate) ? values.eventDate : null,
    deadline: DATE_PATTERN.test(values.deadline) ? values.deadline : null,
    press_kit_url: pressKitUrl,
    other_links: values.otherLinks.replace(/\r\n/g, "\n").trim().slice(0, 1000) || null,
  };

  const requestId = await insertCoverageRequest(request);

  // One photo at a time, so peak memory stays near a single photo's worth
  // (see processAndSaveNewPhotos in the writer actions). A photo that can't be
  // read is skipped rather than losing the whole request.
  let savedPhotos = 0;
  for (const photo of photos) {
    try {
      const raw = Buffer.from(await photo.arrayBuffer());
      const { buffer, mime } = await processImageUpload(raw, 1600, false);
      await addCoverageRequestImage(requestId, buffer, mime);
      savedPhotos++;
    } catch (err) {
      console.error("Coverage request photo skipped:", err);
    }
  }

  try {
    await sendCoverageRequestNotification({
      requesterName: request.requester_name,
      requesterEmail: request.requester_email,
      requesterPhone: request.requester_phone,
      organization: request.organization,
      role: request.role,
      subjectName: request.subject_name,
      subjectInstagram: request.subject_instagram,
      requestType: request.request_type,
      details: request.details,
      eventDate: request.event_date,
      deadline: request.deadline,
      pressKitUrl: request.press_kit_url,
      otherLinks: request.other_links,
      photoCount: savedPhotos,
    });
  } catch (err) {
    console.error("Coverage request notification email failed:", err);
  }

  // Only the first request from an address each day gets a receipt, so the
  // form can't be used to repeatedly email a stranger's inbox.
  if (emailLastDay === 0) {
    try {
      await sendCoverageRequestReceipt({ email: requesterEmail, name: requesterName });
    } catch (err) {
      console.error("Coverage request receipt email failed:", err);
    }
  }

  return { status: "success" };
}
