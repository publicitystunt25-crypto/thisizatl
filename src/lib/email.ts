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
export async function sendCoverageRequestNotification(req: {
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string | null;
  organization: string | null;
  role: string;
  subjectName: string;
  subjectInstagram: string | null;
  requestType: string;
  details: string;
  eventDate: string | null;
  deadline: string | null;
  pressKitUrl: string | null;
  otherLinks: string | null;
  photoCount: number;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SUBMISSION_NOTIFY_EMAIL;
  if (!apiKey || !to) return;

  const siteUrl = (process.env.SITE_URL || "https://thisizatl.com").replace(/\/$/, "");
  const text = `New coverage request: ${req.requestType} -- ${req.subjectName}

From: ${req.requesterName}${req.organization ? ` (${req.organization})` : ""} -- ${req.role}
Email: ${req.requesterEmail}
Phone: ${req.requesterPhone || "(not provided)"}

About: ${req.subjectName}
Instagram: ${req.subjectInstagram || "(not provided)"}
Release/event date: ${req.eventDate || "(not provided)"}
Need coverage by: ${req.deadline || "(not provided)"}
Press kit: ${req.pressKitUrl || "(not provided)"}
Photos: ${req.photoCount > 0 ? `${req.photoCount} attached (view them in the admin link below)` : "(none)"}

Details:
${req.details}
${req.otherLinks ? `\nOther links:\n${req.otherLinks}\n` : ""}
Review and mark it accepted or declined here (admin login required):
${siteUrl}/admin/requests

Replying to this email goes straight to ${req.requesterName}.`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      reply_to: req.requesterEmail,
      subject: `Coverage request: ${req.requestType} -- ${req.subjectName}`,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Coverage request notification email failed:", res.status, body);
  }
}

// Goes to whatever address a stranger typed into a public form, so it's a
// fixed template: the only visitor-supplied text is the sender's name
// (validated to be a plain name with no links) and nothing promises coverage.
export async function sendCoverageRequestReceipt(requester: {
  email: string;
  name: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const text = `Hi ${requester.name},

Thanks for sending your coverage request to ThisIzATL -- we got it.

Our team reads every request and will reach out if we can cover it. We can't promise coverage or a timeline, but we do look at everything that comes in.

ThisIzATL
Atlanta's source for music, entertainment, and culture news`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: requester.email,
      // Replies land with the newsroom, not in a no-reply void.
      ...(process.env.SUBMISSION_NOTIFY_EMAIL ? { reply_to: process.env.SUBMISSION_NOTIFY_EMAIL } : {}),
      subject: "We got your coverage request",
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Coverage request receipt email failed:", res.status, body);
  }
}

export async function sendClipSubmissionNotification(clip: {
  name: string;
  headline?: string | null;
  email: string | null;
  instagram: string | null;
  caption: string;
  videoUrl: string;
  durationSeconds: number | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SUBMISSION_NOTIFY_EMAIL;
  if (!apiKey || !to) return;

  const siteUrl = (process.env.SITE_URL || "https://thisizatl.com").replace(/\/$/, "");
  const headlineLine = clip.headline ? `Cover headline they wrote: ${clip.headline}\n` : "";
  const text = `New video clip submission from ${clip.name}

Instagram: ${clip.instagram || "(not provided)"}
Email: ${clip.email || "(not provided)"}
Length: ${clip.durationSeconds != null ? `${Math.round(clip.durationSeconds)} seconds` : "(unknown)"}
${headlineLine}
Caption they submitted:
${clip.caption}

Watch the clip: ${clip.videoUrl}

Review and approve it here (admin login required):
${siteUrl}/admin/clips`;

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
