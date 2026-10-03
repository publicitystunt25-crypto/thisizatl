"use server";

import {
  insertNomination,
  markNominationEmailSent,
  canSendNomineeInvite,
} from "@/lib/db";
import { sendNominationNotification, sendNomineeInviteEmail } from "@/lib/email";
import { normalizeInstagramInput } from "@/lib/social";
import type { NominateState, NominateValues } from "./NominateForm";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The nominator's name is dropped into an email that goes to a stranger
// from the newsroom's own address, so keep it to a plain name: collapse
// whitespace/newlines, cap the length, and refuse anything link-like.
function cleanNominatorName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!name) return null;
  if (/https?:|www\.|[<>@]|\.(com|net|org|co|io|me|ly)\b/i.test(name)) return null;
  return name;
}

export async function nominateAction(
  _prev: NominateState,
  formData: FormData
): Promise<NominateState> {
  // Honeypot: real visitors never see this field, so anything in it means a
  // bot filled in every input -- act like it worked without saving anything.
  if (String(formData.get("company") || "").trim()) {
    return { status: "success" };
  }

  const values: NominateValues = {
    nominatorName: String(formData.get("nominatorName") || ""),
    nomineeName: String(formData.get("nomineeName") || ""),
    nomineeEmail: String(formData.get("nomineeEmail") || ""),
    nomineeInstagram: String(formData.get("nomineeInstagram") || ""),
  };

  const nominator = cleanNominatorName(values.nominatorName);
  if (!nominator) {
    return {
      status: "error",
      message: "Please enter your name (just your name -- no links or email addresses).",
      values,
    };
  }

  const name = String(formData.get("nomineeName") || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!name) {
    return { status: "error", message: "Please enter the name of who you'd like to nominate.", values };
  }

  const email = String(formData.get("nomineeEmail") || "").trim().slice(0, 200) || null;
  if (email && !EMAIL_PATTERN.test(email)) {
    return {
      status: "error",
      message: "That email address doesn't look right -- fix it or leave it blank.",
      values,
    };
  }

  const rawInstagram = String(formData.get("nomineeInstagram") || "").trim().slice(0, 200);
  // A handle that doesn't parse is kept as typed rather than dropped, so the
  // team still sees what the person meant.
  const instagram = rawInstagram ? normalizeInstagramInput(rawInstagram) ?? rawInstagram : null;

  const nominationId = await insertNomination({
    nominator_name: nominator,
    nominee_name: name,
    nominee_email: email,
    nominee_instagram: instagram,
  });

  let inviteSent = false;
  if (email) {
    try {
      if (await canSendNomineeInvite(email)) {
        inviteSent = await sendNomineeInviteEmail({ email, name, nominator });
        if (inviteSent) await markNominationEmailSent(nominationId);
      }
    } catch (err) {
      console.error("Nominee invite failed:", err);
    }
  }

  try {
    await sendNominationNotification({ name, nominator, email, instagram, inviteSent });
  } catch (err) {
    console.error("Nomination notification email failed:", err);
  }

  return { status: "success" };
}
