import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-5";

const FOCUS_SYSTEM_PROMPT = `You help crop photos for a branded social media template. Given a
photo, find where the main subject's face is so an automated crop can center on it without
cutting their face off.

If the subject's face isn't clearly facing the camera -- tilted back, turned to the side, looking
down, or otherwise at an angle -- still locate the center of their face/head as best you can from
what's visible. Faces at odd angles or in dim lighting are exactly the case this is for.

Only set has_clear_subject to false if there's genuinely no single main person to center on (e.g.
a wide group shot with no one emphasized, or a photo with no people at all).

Call the report_focus_point tool with your answer.`;

const FOCUS_TOOL: Anthropic.Tool = {
  name: "report_focus_point",
  description: "Report where to center a crop on this photo's main subject.",
  input_schema: {
    type: "object",
    properties: {
      has_clear_subject: {
        type: "boolean",
        description: "True if there's one clear main person to center the crop on.",
      },
      x: {
        type: "number",
        description:
          "Horizontal center of the subject's face/head, as a percentage (0-100) from the left edge of the photo.",
      },
      y: {
        type: "number",
        description:
          "Vertical center of the subject's face/head, as a percentage (0-100) from the top edge of the photo.",
      },
    },
    required: ["has_clear_subject", "x", "y"],
  },
};

export interface VisionFocus {
  x: number;
  y: number;
}

// Replaces the old Haar-cascade face detector (opencv-wasm) -- that only
// worked on upright, front-facing, well-lit faces, and fell back to a blind
// saliency heuristic (which just as easily locked onto jewelry or a laptop's
// stickers as an actual person) on anything else. Claude actually looks at
// the photo, so tilted heads, side angles, and dim club lighting -- the
// exact cases that kept slipping through -- work the same as a normal shot.
export async function detectFocusWithVision(imageBuffer: Buffer): Promise<VisionFocus | null> {
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: FOCUS_SYSTEM_PROMPT,
      tools: [FOCUS_TOOL],
      tool_choice: { type: "tool", name: "report_focus_point" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageBuffer.toString("base64"),
              },
            },
            {
              type: "text",
              text: "Where should this photo be centered so the main subject's face stays fully visible when cropped to a square or portrait frame?",
            },
          ],
        },
      ],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;

    const result = toolUse.input as { has_clear_subject: boolean; x: number; y: number };
    if (!result.has_clear_subject) return null;
    return { x: result.x, y: result.y };
  } catch (err) {
    console.error("Vision focus detection failed:", err);
    return null;
  }
}
