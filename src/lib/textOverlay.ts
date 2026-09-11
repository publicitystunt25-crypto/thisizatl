export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Rough word-wrap by character count -- good enough for a bold display
// headline at a known font size, no need for exact text metrics. Wraps every
// word first with no line cap, THEN slices to maxLines -- capping the line
// count during the wrap itself (as an earlier version of this did) drops the
// last word or two into a line that gets built but never actually shown,
// which left the ellipsis attached to that invisible line instead of the
// real last line on screen -- the visible text just stopped mid-sentence
// with no "…" at all.
function wrapAll(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const allLines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxCharsPerLine && current) {
      allLines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) allLines.push(current);

  return allLines;
}

export function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const allLines = wrapAll(text, maxCharsPerLine);
  const truncated = allLines.length > maxLines;
  const lines = allLines.slice(0, maxLines);

  if (truncated && lines.length > 0) {
    let last = lines[lines.length - 1];
    if (last.length > maxCharsPerLine - 3) {
      last = last.slice(0, maxCharsPerLine - 3).trimEnd();
    }
    lines[lines.length - 1] = `${last}…`;
  }

  return lines;
}

// True if the text wraps into maxLines or fewer at this width -- lets a
// caller try progressively smaller font/line-width tiers and pick the
// largest one where the full headline actually fits, instead of always
// truncating at a single fixed size.
export function fitsWithinLines(text: string, maxCharsPerLine: number, maxLines: number): boolean {
  return wrapAll(text, maxCharsPerLine).length <= maxLines;
}
