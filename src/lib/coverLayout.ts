import { wrapText, fitsWithinLines } from "@/lib/textOverlay";

// Geometry for the Reel cover image, shared by the server renderer
// (clipCover.ts) and the live preview on the public upload form, so the two
// can't drift apart. Pure functions only -- this file runs in the browser too.
//
// Instagram's profile grid shows only the middle 3:4 of a cover (roughly
// y 240-1680 of 1920), so text and the wordmark stay inside that band.
export const COVER_WIDTH = 1080;
export const COVER_HEIGHT = 1920;
export const TEXT_BOTTOM = 1650;
// Landscape clips end here, with the headline block starting just below.
export const FRONT_BOTTOM = 1000;
// How dark the fade gets: enough for the orange text to stay readable, but
// not so solid that the picture disappears at the bottom.
export const FADE_OPACITY = 0.82;
export const BRAND_ORANGE = "#ff5a1f";
export const WORDMARK_WIDTH = 240;
export const WORDMARK_TOP = 280;
export const MAX_HEADLINE_LENGTH = 80;

// The logo is twice the size it was on the feed-style layout; the headline
// is a step larger, which is why fewer characters fit on a line.
const CAPTION_TIERS = [
  { fontSize: 128, lineHeight: 140, maxCharsPerLine: 13, maxLines: 2, logoSize: 300 },
  { fontSize: 84, lineHeight: 100, maxCharsPerLine: 20, maxLines: 3, logoSize: 270 },
  { fontSize: 68, lineHeight: 82, maxCharsPerLine: 25, maxLines: 4, logoSize: 230 },
  { fontSize: 56, lineHeight: 68, maxCharsPerLine: 31, maxLines: 5, logoSize: 200 },
];

export function layoutCover(headline: string) {
  const tier =
    CAPTION_TIERS.find((t) => fitsWithinLines(headline, t.maxCharsPerLine, t.maxLines)) ??
    CAPTION_TIERS[CAPTION_TIERS.length - 1];
  const lines = wrapText(headline, tier.maxCharsPerLine, tier.maxLines);

  const captionToLogoGap = 8;
  const blockHeight = lines.length * tier.lineHeight;
  const groupTop = TEXT_BOTTOM - (blockHeight + captionToLogoGap + tier.logoSize);
  return {
    tier,
    lines,
    captionStartY: groupTop + tier.fontSize * 0.8,
    logoTop: groupTop + blockHeight + captionToLogoGap,
    // The fade starts well above the first line so it blends in smoothly.
    fadeStart: Math.max(500, groupTop - 520),
    fadeSolid: Math.max(Math.max(500, groupTop - 520) + 100, groupTop - 20),
  };
}
