import sharp from "sharp";

// Crops a source image to exactly targetW x targetH. When a detected face
// focus point is available, scales to cover the target box and extracts a
// window centered on that point (clamped so it never runs off the edge) --
// otherwise falls back to sharp's attention-based smart crop (entropy +
// skin-tone saliency). Attention-based cropping isn't perfect (it can pick
// the wrong region -- e.g. graffiti text or an action-shot background --
// over an actual face), but a real detected face always wins when one is
// available, and it beats a fixed anchor position that assumes every photo
// frames its subject the same way.
export async function cropToFocus(
  imgBuffer: Buffer,
  targetW: number,
  targetH: number,
  focus: { x: number; y: number } | null
): Promise<Buffer> {
  if (!focus) {
    return sharp(imgBuffer).resize(targetW, targetH, { fit: "cover", position: "attention" }).toBuffer();
  }

  const meta = await sharp(imgBuffer).metadata();
  const srcW = meta.width || targetW;
  const srcH = meta.height || targetH;

  const scale = Math.max(targetW / srcW, targetH / srcH);
  const scaledW = Math.round(srcW * scale);
  const scaledH = Math.round(srcH * scale);

  const focusPxX = (focus.x / 100) * scaledW;
  const focusPxY = (focus.y / 100) * scaledH;

  const left = Math.min(Math.max(0, Math.round(focusPxX - targetW / 2)), scaledW - targetW);
  const top = Math.min(Math.max(0, Math.round(focusPxY - targetH / 2)), scaledH - targetH);

  return sharp(imgBuffer)
    .resize(scaledW, scaledH)
    .extract({ left, top, width: targetW, height: targetH })
    .toBuffer();
}
