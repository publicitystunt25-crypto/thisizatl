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
  focus: { x: number; y: number } | null,
  // Extra zoom beyond the natural "cover" scale, centered on the focus
  // point -- for photos with a lot of empty background padding around the
  // actual subject (e.g. a PNG cutout on a black backdrop), where a plain
  // cover-fit crop still leaves most of that empty space in frame since it
  // has no way to know where the subject's real edges are.
  zoom = 1
): Promise<Buffer> {
  if (!focus) {
    return sharp(imgBuffer).resize(targetW, targetH, { fit: "cover", position: "attention" }).toBuffer();
  }

  const meta = await sharp(imgBuffer).metadata();
  const srcW = meta.width || targetW;
  const srcH = meta.height || targetH;

  const scale = Math.max(targetW / srcW, targetH / srcH) * zoom;
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

// Fits the whole photo inside targetW x targetH instead of cropping it, for tall
// photos (like a collage) where a cover crop would cut off most of the picture.
// The leftover space on the sides is filled with a blurred, darkened copy of the
// same photo so it doesn't look like empty bars.
export async function fitWholePhoto(imgBuffer: Buffer, targetW: number, targetH: number): Promise<Buffer> {
  const background = await sharp(imgBuffer)
    .resize(targetW, targetH, { fit: "cover" })
    .blur(40)
    .modulate({ brightness: 0.45 })
    .toBuffer();
  const photo = await sharp(imgBuffer)
    .resize(targetW, targetH, { fit: "inside" })
    .toBuffer();
  const meta = await sharp(photo).metadata();
  return sharp(background)
    .composite([
      {
        input: photo,
        left: Math.round((targetW - (meta.width || targetW)) / 2),
        top: Math.round((targetH - (meta.height || targetH)) / 2),
      },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
}

// True when a cover crop to the target box would throw away this much or more
// of a photo's height (e.g. a 4:5 collage squeezed into a wide box), or 30%+ of its width.
export function coverCropLosesTooMuch(srcW: number, srcH: number, targetW: number, targetH: number, limit = 0.25): boolean {
  const srcAspect = srcW / srcH;
  const targetAspect = targetW / targetH;
  // Very wide photos (a 16:9 graphic with a logo at each side) lose their edges instead of their height.
  if (srcAspect >= targetAspect) return 1 - targetAspect / srcAspect >= 0.3;
  return 1 - srcAspect / targetAspect >= limit;
}
