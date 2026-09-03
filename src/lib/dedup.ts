import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `You judge whether a candidate news story is the same underlying story/event as
any title in a list of already-published posts. Same underlying story means they cover the same
event, even if reported by different outlets, with different headlines, or with new developments
in an ongoing story (e.g. "arrest made" vs "suspect charged" vs "convicted" for the same case
still counts as the same underlying story). Different stories about the same recurring topic
(e.g. two different weeks' "arts events this weekend" roundups, or two different crimes in the
same neighborhood) are NOT duplicates.

Call the judge_duplicate tool with your answer.`;

const JUDGE_TOOL: Anthropic.Tool = {
  name: "judge_duplicate",
  description: "Report whether the candidate story duplicates an already-published one.",
  input_schema: {
    type: "object",
    properties: {
      is_duplicate: { type: "boolean" },
      duplicate_of: {
        type: "string",
        description: "The matching published title, if is_duplicate is true; otherwise empty string.",
      },
      reason: { type: "string", description: "One sentence explaining the judgment." },
    },
    required: ["is_duplicate", "duplicate_of", "reason"],
  },
};

export interface DuplicateCheck {
  is_duplicate: boolean;
  duplicate_of: string;
  reason: string;
}

export async function checkDuplicate(
  candidateTitles: string[],
  recentTitles: string[]
): Promise<DuplicateCheck> {
  if (recentTitles.length === 0) {
    return { is_duplicate: false, duplicate_of: "", reason: "No recent posts to compare against." };
  }

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    tools: [JUDGE_TOOL],
    tool_choice: { type: "tool", name: "judge_duplicate" },
    messages: [
      {
        role: "user",
        content: `Candidate story (source headlines about it):\n${candidateTitles
          .map((t) => `- ${t}`)
          .join("\n")}\n\nAlready-published post titles:\n${recentTitles
          .map((t) => `- ${t}`)
          .join("\n")}`,
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { is_duplicate: false, duplicate_of: "", reason: "Duplicate check failed to run; proceeding." };
  }

  return toolUse.input as DuplicateCheck;
}
