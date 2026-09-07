import type { ArtistSubmission } from "./spotlight";
import type { ProfileSubmission } from "./profile";

// thisizatl.com is verified on Resend, so this can send to any inbox.
const FROM_ADDRESS = "ThisIzATL <info@thisizatl.com>";

export async function sendSubmissionNotification(
  submission: ArtistSubmission,
  postId: number
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
  postId: number
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
