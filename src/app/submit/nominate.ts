"use server";

import { insertNomination } from "@/lib/db";
import { sendNominationNotification } from "@/lib/email";
import { normalizeInstagramInput } from "@/lib/social";
import type { NominateState } from "./NominateForm";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function nominateAction(
  _prev: NominateState,
  formData: FormData
): Promise<NominateState> {
  // Honeypot: real visitors never see this field, so anything in it means a
  // bot filled in every input -- act like it worked without saving anything.
  if (String(formData.get("company") || "").trim()) {
    return { status: "success" };
  }

  const name = String(formData.get("nomineeName") || "").trim().slice(0, 120);
  if (!name) {
    return { status: "error", message: "Please enter the name of who you'd like to nominate." };
  }

  const email = String(formData.get("nomineeEmail") || "").trim().slice(0, 200) || null;
  if (email && !EMAIL_PATTERN.test(email)) {
    return { status: "error", message: "That email address doesn't look right -- fix it or leave it blank." };
  }

  const rawInstagram = String(formData.get("nomineeInstagram") || "").trim().slice(0, 200);
  // A handle that doesn't parse is kept as typed rather than dropped, so the
  // team still sees what the person meant.
  const instagram = rawInstagram ? normalizeInstagramInput(rawInstagram) ?? rawInstagram : null;

  await insertNomination({ nominee_name: name, nominee_email: email, nominee_instagram: instagram });

  try {
    await sendNominationNotification({ name, email, instagram });
  } catch (err) {
    console.error("Nomination notification email failed:", err);
  }

  return { status: "success" };
}
