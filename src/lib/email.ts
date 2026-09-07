import type { ArtistSubmission } from "./spotlight";

// Uses Resend's shared sending address -- works with zero setup, but Resend
// only allows it to deliver to the email the Resend account itself was
// created with. Verify a domain at resend.com/domains to send from a
// branded address to any inbox instead.
const FROM_ADDRESS = "ThisIzATL <onboarding@resend.dev>";

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
Genre: ${submission.genre}
Instagram: ${submission.instagramUrl}
Music: ${submission.musicUrl}

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

// Sent to the artist once their submission goes live (whether approved
// directly or via a schedule coming due). Unlike sendSubmissionNotification,
// this delivers to an arbitrary external address, which Resend's shared
// resend.dev sender can't do -- it requires a verified sending domain, so
// this silently fails (logged, not thrown) until thisizatl.com is verified.
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

Feel free to share the link with your fans.

-- ThisIzATL`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "ThisIzATL <notify@thisizatl.com>",
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
