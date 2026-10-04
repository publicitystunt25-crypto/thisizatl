import type { ArtistSubmission } from "./spotlight";
import type { ProfileSubmission } from "./profile";

// thisizatl.com is verified on Resend, so this can send to any inbox.
const FROM_ADDRESS = "ThisIzATL <info@thisizatl.com>";

export async function sendSubmissionNotification(
  submission: ArtistSubmission,
  postId: number,
  collaboratorUrls: string[] = []
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SUBMISSION_NOTIFY_EMAIL;
  if (!apiKey || !to) return;

  const reviewUrl = `${process.env.SITE_URL || "https://thisizatl.com"}/admin/${postId}/preview`;

  const text = `New artist submission: ${submission.artistName}

Pronouns: ${submission.pronouns}
Hometown: ${submission.hometown || "(not provided)"}
Genre: ${submission.genre}
Instagram: ${submission.instagramUrl || "(not provided)"}
Music: ${submission.musicUrl || "(not provided)"}
Following ThisIzATL: ${submission.followsInstagram ? "Yes" : "No"}
Collaboration pages: ${collaboratorUrls.length ? collaboratorUrls.join(", ") : "(none)"}

No photo attached -- ${submission.artistName} was asked to email one to info@thisizatl.com separately. Add it via the edit page once it arrives.

Review it here: ${reviewUrl}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject: `New submission: ${submission.artistName}`,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Submission notification email failed:", res.status, body);
  }
}

export async function sendOtherSubmissionNotification(
  submission: ProfileSubmission,
  postId: number,
  collaboratorUrls: string[] = []
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SUBMISSION_NOTIFY_EMAIL;
  if (!apiKey || !to) return;

  const reviewUrl = `${process.env.SITE_URL || "https://thisizatl.com"}/admin/${postId}/preview`;

  const text = `New submission (non-artist): ${submission.name}

Pronouns: ${submission.pronouns}
Hometown: ${submission.hometown || "(not provided)"}
Profession: ${submission.profession}
Instagram: ${submission.instagramUrl || "(not provided)"}
Link: ${submission.linkUrl || "(not provided)"}
Following ThisIzATL: ${submission.followsInstagram ? "Yes" : "No"}
Collaboration pages: ${collaboratorUrls.length ? collaboratorUrls.join(", ") : "(none)"}

No photo attached -- ${submission.name} was asked to email one to info@thisizatl.com separately. Add it via the edit page once it arrives.

Review it here: ${reviewUrl}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject: `New submission: ${submission.name}`,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Submission notification email failed:", res.status, body);
  }
}

// Sent to the artist once their submission goes live (whether approved
// directly or via a schedule coming due).
export async function sendArticleLiveNotification(
  to: string,
  artistName: string,
  title: string,
  slug: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !to) return;

  const url = `${process.env.SITE_URL || "https://thisizatl.com"}/posts/${slug}`;

  const text = `Hey ${artistName},

Your feature is live on ThisIzATL!

"${title}"
${url}

Feel free to share the link with your fans, and follow and tag ThisIzATL on Instagram @ThisizATL.

-- ThisIzATL`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject: `Your ThisIzATL feature is live: ${title}`,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Article-live notification email failed:", res.status, body);
  }
}

// Sent to the newsroom inbox when a visitor nominates someone to be
// highlighted via the form at the bottom of /submit.
export async function sendNominationNotification(nomination: {
  name: string;
  nominator: string;
  email: string | null;
  instagram: string | null;
  inviteSent: boolean;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SUBMISSION_NOTIFY_EMAIL;
  if (!apiKey || !to) return;

  const inviteLine = nomination.inviteSent
    ? "Invitation email sent to the nominee."
    : nomination.email
      ? "Invitation email NOT sent (this address was already invited recently, or the hourly limit was hit)."
      : "No invitation sent (no email provided for the nominee).";

  const text = `New nomination: ${nomination.name}

Nominated by: ${nomination.nominator}
Email: ${nomination.email || "(not provided)"}
Instagram: ${nomination.instagram || "(not provided)"}

${inviteLine}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject: `New nomination: ${nomination.name}`,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Nomination notification email failed:", res.status, body);
  }
}

// Sent to the person who was nominated, inviting them to fill out the
// submission form. The body is a fixed template -- the only visitor-supplied
// text in it is the nominator's name (validated in nominateAction to be a
// plain name with no links) and the nominee's own name, because this goes to
// an address a stranger typed into a public form.
export async function sendNomineeInviteEmail(nominee: {
  email: string;
  name: string;
  nominator: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const submitUrl = `${process.env.SITE_URL || "https://thisizatl.com"}/submit`;

  const text = `Hi ${nominee.name},

${nominee.nominator} nominated you to be highlighted in ThisIzATL, Atlanta's source for music, entertainment, and culture news.

If you'd like to be featured, fill out our short submission form here:
${submitUrl}

Tell us your story and add a photo -- our team reviews every submission before it goes live.

-- ThisIzATL`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: nominee.email,
      subject: "You've been nominated to be featured on ThisIzATL",
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Nominee invite email failed:", res.status, body);
    return false;
  }
  return true;
}

// Sent to the newsroom inbox when someone uploads a video clip through /clip.
export async function sendClipSubmissionNotification(clip: {
  name: string;
  email: string | null;
  instagram: string | null;
  caption: string;
  videoUrl: string;
  durationSeconds: number | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SUBMISSION_NOTIFY_EMAIL;
  if (!apiKey || !to) return;

  const text = `New video clip submission from ${clip.name}

Instagram: ${clip.instagram || "(not provided)"}
Email: ${clip.email || "(not provided)"}
Length: ${clip.durationSeconds != null ? `${Math.round(clip.durationSeconds)} seconds` : "(unknown)"}

Caption they submitted:
${clip.caption}

Watch the clip: ${clip.videoUrl}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject: `New clip submission: ${clip.name}`,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Clip submission notification email failed:", res.status, body);
  }
}
