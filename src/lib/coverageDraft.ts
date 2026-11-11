import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, type Category } from "./categories";
import type { CoverageRequest } from "./db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `You are a music/culture writer for ThisIzATL, an Atlanta music, entertainment,
and culture blog. Someone (an artist, publicist, manager, brand, or event organizer) sent the
newsroom a coverage request, and an editor has accepted it. Write a first draft of an original short
feature from what they sent; the editor will revise it before anything is published.
Follow these rules strictly:

1. FACTS ONLY FROM THE REQUEST. Only use what the request actually says. Never invent chart positions,
   streaming numbers, awards, collaborations, dates, venues, or quotes that weren't stated. If the
   request quotes someone, you may quote only those words. No filler commentary either: don't add your
   own claims about what a place, genre, or the city "represents" or "nods to", and don't label people
   ("veteran", "newcomer") unless the request does.
2. NO UNCHECKED PROMOTIONAL CLAIMS. Press-release language ("the hottest", "breakout", "legendary",
   "going viral") must not be restated as fact. Drop it, or attribute it explicitly ("the team
   describes it as...").
3. WRITE IT FRESH. Third person, feature voice, in your own words -- do not copy the request's
   sentences. Never include the sender's email address or phone number.
4. PRONOUNS. The request doesn't give pronouns, so refer to people by name or with "they"
   -- never guess gender from a name.
5. LENGTH. Up to 500 words, about 3-7 short paragraphs. If a sentence isn't directly supported by the
   request, leave it out -- a shorter, fully accurate piece beats a padded one. Never describe what
   each person does on a track or project beyond what's stated, never mention the request, the
   publicist, or who sent it, and never comment on what information wasn't provided.
6. TONE. Warm, clean, neutral local-culture voice -- informing an Atlanta audience, not an ad.
   If dates are given (a release or event date), state them plainly as full dates -- never "this
   weekend" or "tomorrow", since the piece may be edited and published later.

Also classify the post into exactly one category and propose a short headline.

Call the publish_draft tool with your finished draft. Do not respond with plain text.`;

const PUBLISH_TOOL: Anthropic.Tool = {
  name: "publish_draft",
  description: "Hand back the finished first draft.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short headline, in your own wording." },
      body: {
        type: "string",
        description: "The article body, up to 500 words, with \\n\\n between paragraphs.",
      },
      category: {
        type: "string",
        enum: [...CATEGORIES],
        description: "The single best-fit category for this post.",
      },
    },
    required: ["title", "body", "category"],
  },
};

export interface CoverageDraft {
  title: string;
  body: string;
  category: Category;
}

export async function generateCoverageDraft(request: CoverageRequest): Promise<CoverageDraft> {
  const block = `Coverage wanted: ${request.request_type}
About: ${request.subject_name}
Sent by: ${request.requester_name} (${request.role}${request.organization ? `, ${request.organization}` : ""})
Release/event date: ${request.event_date || "(not provided)"}

What they told us:
${request.details}
${request.other_links ? `\nLinks they included:\n${request.other_links}\n` : ""}`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    tools: [PUBLISH_TOOL],
    tool_choice: { type: "tool", name: "publish_draft" },
    messages: [
      {
        role: "user",
        content: `Here is the coverage request:\n\n${block}\n\nWrite the first draft per your instructions.`,
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not call the publish_draft tool");
  }
  return toolUse.input as CoverageDraft;
}
