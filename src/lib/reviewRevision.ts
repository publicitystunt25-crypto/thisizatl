import Anthropic from "@anthropic-ai/sdk";
import {
  getPostById,
  updatePost,
  setPostImage,
  addPostImages,
  getReviewPhotos,
  deleteReviewPhotos,
  markRevising,
  claimDueRevisions,
  ensureReviewToken,
  markPreviewEmailed,
} from "./db";
import { processImageUpload } from "./image";
import { sendArticleUpdatedEmail } from "./email";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-5";

// How long after a change request the client gets the updated article.
export const REVISION_DELAY_MINUTES = 10;

const SYSTEM_PROMPT = `You are the editor at ThisIzATL, an Atlanta music and culture blog. The person an
article is about (or their rep) read the draft and asked for changes. Apply exactly what they asked for.

Rules:
1. Make only the changes they requested. Leave every other word of the article alone.
2. Never invent facts. Use only what the request states (a corrected name, date, link text, detail).
   If they ask for something you can't do without making facts up, or the request is unclear, don't
   guess -- list it in "not_done".
3. Requests about photos are handled separately -- ignore them here (don't list them in "not_done").
4. Keep the same voice, paragraph structure, and blank line (\\n\\n) between paragraphs.
5. Keep any dates as full dates. Never add the sender's email or phone number.
6. If the request asks for no text change at all (only photos), return the title and body unchanged
   and set text_changed to false.

Call the apply_edits tool. Do not respond with plain text.`;

const TOOL: Anthropic.Tool = {
  name: "apply_edits",
  description: "Hand back the article with the requested edits applied.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "The headline, changed only if they asked." },
      body: { type: "string", description: "The full article body with the edits applied." },
      text_changed: { type: "boolean", description: "True if the title or body changed." },
      summary: { type: "string", description: "One or two sentences: what you changed." },
      not_done: {
        type: "string",
        description: "Anything they asked for that you did NOT do, and why. Empty string if everything was done.",
      },
    },
    required: ["title", "body", "text_changed", "summary", "not_done"],
  },
};

export type RevisionResult =
  | { ok: true; summary: string }
  | { ok: false; reason: string; summary: string };

// Applies a submitter's change request to the draft: text edits from their
// note, a replacement main photo, and extra photos. Returns ok only when every
// part was done, so the client is never emailed an "updated" article that
// quietly ignored something they asked for.
export async function applyReviewChanges(postId: number, note: string): Promise<RevisionResult> {
  const post = await getPostById(postId);
  if (!post || post.status !== "draft") return { ok: false, reason: "The article isn't a draft any more.", summary: "" };

  const photos = await getReviewPhotos(postId);
  const summaryParts: string[] = [];
  let notDone = "";

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "apply_edits" },
    messages: [
      {
        role: "user",
        content: `Current headline:\n${post.title}\n\nCurrent article:\n${post.body}\n\nTheir requested changes:\n${note}${
          photos.length ? "\n\n(They also sent new photos; those are handled separately.)" : ""
        }`,
      },
    ],
  });
  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Claude did not call the apply_edits tool");
  const edit = toolUse.input as {
    title: string;
    body: string;
    text_changed: boolean;
    summary: string;
    not_done: string;
  };

  notDone = (edit.not_done || "").trim();
  if (edit.text_changed && edit.title.trim() && edit.body.trim()) {
    await updatePost(post.id, {
      slug: post.slug,
      title: edit.title.trim(),
      body: edit.body.trim(),
      category: post.category,
      status: "draft",
    });
    summaryParts.push(edit.summary.trim());
  }

  const main = photos.filter((p) => p.kind === "main").slice(-1)[0];
  const extras = photos.filter((p) => p.kind === "extra");
  const used: number[] = [];

  try {
    if (main) {
      const { buffer, mime, width, height, focus } = await processImageUpload(main.data, 1600, true);
      await setPostImage(post.id, buffer, mime, `/api/uploads/${post.id}`, post.image_credit, { width, height }, focus);
      used.push(main.id);
      summaryParts.push("Replaced the main photo.");
    }
    if (extras.length) {
      await addPostImages(
        post.id,
        extras.map((p) => ({ data: p.data, mime: p.mime, credit: post.image_credit }))
      );
      used.push(...extras.map((p) => p.id));
      summaryParts.push(`Added ${extras.length} photo${extras.length === 1 ? "" : "s"}.`);
    }
  } finally {
    // Photos that made it onto the article no longer need their holding copy.
    await deleteReviewPhotos(used);
  }

  const summary = summaryParts.join(" ");
  if (notDone) return { ok: false, reason: notDone, summary };
  if (!summary) return { ok: false, reason: "I couldn't tell what to change from their message.", summary };
  return { ok: true, summary };
}

let timer: ReturnType<typeof setTimeout> | null = null;

// Marks the article as updated and arranges the email. The timer is the normal
// path; the sweep on the cron ping and admin page loads covers a server restart
// during the wait.
export async function scheduleRevisionEmail(postId: number): Promise<void> {
  await markRevising(postId, new Date(Date.now() + REVISION_DELAY_MINUTES * 60_000));
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    sendDueRevisionEmails().catch((err) => console.error("Revision email sweep failed:", err));
  }, REVISION_DELAY_MINUTES * 60_000 + 2000);
}

// Emails every client whose updated article is due. Safe to call often.
export async function sendDueRevisionEmails(): Promise<number> {
  const ids = await claimDueRevisions();
  const siteUrl = (process.env.SITE_URL || "https://thisizatl.com").replace(/\/$/, "");
  let sent = 0;
  for (const id of ids) {
    try {
      const post = await getPostById(id);
      if (!post?.submitter_email) continue;
      const token = await ensureReviewToken(id);
      const ok = await sendArticleUpdatedEmail(
        post.submitter_email,
        post.image_credit || "there",
        post.title,
        `${siteUrl}/review/${token}`
      );
      if (ok) {
        await markPreviewEmailed(id);
        sent++;
      } else {
        await markRevising(id, new Date(Date.now() + 5 * 60_000));
      }
    } catch (err) {
      console.error("Revision email failed for post", id, err);
      await markRevising(id, new Date(Date.now() + 5 * 60_000)).catch(() => {});
    }
  }
  return sent;
}
