import Anthropic from "@anthropic-ai/sdk";
import type { Category } from "./generate";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `You are a music/culture writer for ThisIzATL, an Atlanta music, entertainment,
and culture blog. You've received a submission directly from an artist (or their team) through an
intake form, and must write an original short spotlight feature introducing them to readers.
Follow these rules strictly:

1. FACTS ONLY FROM THE SUBMISSION. Only use what the artist actually told you. Never invent chart
   positions, streaming numbers, awards, collaborations, or achievements that weren't stated.
2. NO UNCHECKED SUPERLATIVES. If the submission includes self-promotional claims ("the hottest new
   artist in Atlanta", "going viral", "next big thing"), don't restate them as fact. Either drop
   them, or attribute them explicitly as the artist's own framing (e.g. "as they put it...").
3. THIRD PERSON, FEATURE VOICE. Write like a real spotlight piece, not a rewritten form -- weave
   the details into a natural short feature rather than answering the submitted questions in order.
4. LENGTH. 120-220 words.
5. TONE. Clean, warm, neutral local-culture voice -- genuinely introducing a new artist to an
   Atlanta audience, not an ad.

Also classify the post into exactly one category: "Music", "Entertainment", "Fashion", or "Culture"
(pick whichever best fits what the artist actually does -- most submissions will be "Music").

Also propose a short headline for the piece.

Call the publish_spotlight tool with your finished post. Do not respond with plain text.`;

const PUBLISH_TOOL: Anthropic.Tool = {
  name: "publish_spotlight",
  description: "Publish the finished artist spotlight article.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short headline, in your own wording." },
      body: {
        type: "string",
        description: "The 120-220 word article body, with \\n\\n between paragraphs.",
      },
      category: {
        type: "string",
        enum: ["Music", "Entertainment", "Fashion", "Culture"],
        description: "The single best-fit category for this post.",
      },
    },
    required: ["title", "body", "category"],
  },
};

export interface ArtistSubmission {
  artistName: string;
  genre: string;
  biggestInspiration: string;
  whatsNew: string;
  bio: string;
  instagramUrl: string;
  musicUrl: string;
}

export interface SpotlightArticle {
  title: string;
  body: string;
  category: Category;
}

export async function generateSpotlightArticle(
  submission: ArtistSubmission
): Promise<SpotlightArticle> {
  const submissionBlock = `Artist/stage name: ${submission.artistName}
Genre: ${submission.genre}
Biggest inspiration (person or thing): ${submission.biggestInspiration}
What's new (single/project/announcement): ${submission.whatsNew}
Bio, in the artist's own words: ${submission.bio}`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    tools: [PUBLISH_TOOL],
    tool_choice: { type: "tool", name: "publish_spotlight" },
    messages: [
      {
        role: "user",
        content: `Here is the artist's submission:\n\n${submissionBlock}\n\nWrite the spotlight feature per your instructions.`,
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not call the publish_spotlight tool");
  }

  return toolUse.input as SpotlightArticle;
}
