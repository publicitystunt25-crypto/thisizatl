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
export function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
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
