import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `You are a news writer for an Atlanta music blog. You will be given one or more
source articles (facts only should be used from them) and must produce an ORIGINAL short news
post. Follow these rules strictly, in order of importance:

1. FACTS ONLY, NOT PROSE. Extract only the underlying facts (who/what/when/where/why) from the
   source material. Do NOT reuse the source's sentence structure, paragraph order, word choices,
   or distinctive phrasing. Never copy sequences of 6+ words verbatim from a source.
2. INDEPENDENT STRUCTURE. Organize your piece around your own angle and structure, not the
   source article's structure. If the source lists items in a particular order (e.g. "9 events
   this weekend"), do not preserve that ordering or that exact list framing.
3. NO UNMARKED QUOTES. Only include a direct quote from a source if it is wrapped in quotation
   marks and attributed by name. Prefer paraphrasing over quoting.
4. LENGTH. Keep the rewritten post short: 120-220 words. This is a news brief, not a full
   feature article.
5. ATTRIBUTION. End the post with a line crediting the original source(s) by outlet name (this is
   added separately by the system — do not write your own credit line).
6. TONE. Write in a clean, neutral local-news voice appropriate for an Atlanta music/culture blog.

After writing the post, perform a SELF-CHECK: compare your draft against the source text(s) and
judge whether your wording, sentence order, or structure is too close to the original (a
"derivative work" risk) rather than an independent restatement of facts.

Also propose an image_query: a short (2-5 word) generic stock-photo search phrase that matches
the STORY'S TOPIC OR SETTING ONLY — e.g. "concert crowd night", "recording studio mixing board",
"police lights night city", "art gallery opening". Never name a specific real person, venue, or
event in the query, since this will pull a generic stock photo, not a picture of the actual
people or place involved.

Call the publish_article tool with your finished post. Do not respond with plain text.`;

const PUBLISH_TOOL: Anthropic.Tool = {
  name: "publish_article",
  description: "Publish the finished, rewritten news article.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short headline, in your own wording." },
      body: {
        type: "string",
        description: "The 120-220 word article body, with \\n\\n between paragraphs.",
      },
      similarity_risk: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "Self-check judgment of derivative-work risk vs. the sources.",
      },
      similarity_note: {
        type: "string",
        description: "One sentence explaining the similarity_risk judgment.",
      },
      image_query: {
        type: "string",
        description:
          "2-5 word generic stock-photo search phrase matching the story's topic/setting only, no real names.",
      },
    },
    required: [
      "title",
      "body",
      "similarity_risk",
      "similarity_note",
      "image_query",
    ],
  },
};

export interface SourceInput {
  title: string;
  url: string;
  source: string;
  text: string;
}

export interface GeneratedArticle {
  title: string;
  body: string;
  similarity_risk: "low" | "medium" | "high";
  similarity_note: string;
  image_query: string;
}

export async function generateArticle(
  sources: SourceInput[]
): Promise<GeneratedArticle> {
  const sourceBlock = sources
    .map(
      (s, i) =>
        `SOURCE ${i + 1} (${s.source}): ${s.title}\nURL: ${s.url}\n---\n${s.text}`
    )
    .join("\n\n=====\n\n");

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    tools: [PUBLISH_TOOL],
    tool_choice: { type: "tool", name: "publish_article" },
    messages: [
      {
        role: "user",
        content: `Here is the source material:\n\n${sourceBlock}\n\nWrite the blog post per your instructions.`,
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not call the publish_article tool");
  }

  return toolUse.input as GeneratedArticle;
}
