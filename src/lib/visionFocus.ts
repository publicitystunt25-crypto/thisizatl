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

x and y MUST be plain percentages from 0 to 100, measuring the fraction of the image's total
width/height -- NOT pixel coordinates, and NOT a 0-1 fraction. Dead center of the photo is exactly
x=50, y=50, regardless of that photo's actual pixel dimensions. A face centered a bit above the
photo's middle and slightly left might be x=42, y=35 -- never 0.42/0.35, never a pixel count like
420/600.

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
          "Horizontal center of the subject's face/head as a percentage from 0 to 100 (e.g. 50), where 0 is the left edge and 100 is the right edge. Never a 0-1 fraction (e.g. 0.5) and never a pixel coordinate.",
      },
      y: {
        type: "number",
        description:
          "Vertical center of the subject's face/head as a percentage from 0 to 100 (e.g. 50), where 0 is the top edge and 100 is the bottom edge. Never a 0-1 fraction (e.g. 0.5) and never a pixel coordinate.",
      },
    },
    required: ["has_clear_subject", "x", "y"],
  },
};

export interface VisionFocus {
  x: number;
  y: number;
}

// Some responses come back as a 0-1 fraction or a raw pixel coordinate
// despite the prompt and schema both spelling out "0-100 percentage" --
// normalize instead of trusting the model followed the format, since a
// wrong-scale value here silently produces a badly cropped image with no
// error anywhere to catch it.
function normalizeCoordinate(value: number, dimensionPx: number): number {
  if (value >= 0 && value <= 1) return value * 100;
  if (value > 100) return Math.min(100, (value / dimensionPx) * 100);
  return value;
}

// Replaces the old Haar-cascade face detector (opencv-wasm) -- that only
// worked on upright, front-facing, well-lit faces, and fell back to a blind
// saliency heuristic (which just as easily locked onto jewelry or a laptop's
// stickers as an actual person) on anything else. Claude actually looks at
// the photo, so tilted heads, side angles, and dim club lighting -- the
// exact cases that kept slipping through -- work the same as a normal shot.
export async function detectFocusWithVision(
  imageBuffer: Buffer,
  imageWidth: number,
  imageHeight: number
): Promise<VisionFocus | null> {
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
              text: "Where should this photo be centered so the main subject's face stays fully visible when cropped to a square or portrait frame? Remember: x and y are percentages 0-100, not fractions or pixel coordinates.",
            },
          ],
        },
      ],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;

    const result = toolUse.input as { has_clear_subject: boolean; x: number; y: number };
    if (!result.has_clear_subject) return null;

    const x = normalizeCoordinate(result.x, imageWidth);
    const y = normalizeCoordinate(result.y, imageHeight);
    if (x < 0 || x > 100 || y < 0 || y > 100) return null;

    return { x, y };
  } catch (err) {
    console.error("Vision focus detection failed:", err);
    return null;
  }
}
