"use client";

import { useEffect, useRef, useState } from "react";
import {
  BRAND_ORANGE,
  COVER_HEIGHT,
  COVER_WIDTH,
  FADE_OPACITY,
  FRONT_BOTTOM,
  WORDMARK_TOP,
  WORDMARK_WIDTH,
  layoutCover,
} from "@/lib/coverLayout";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Grabs a still from the chosen video file entirely in the browser (nothing
// is uploaded for the preview). Resolves null if the browser can't decode it.
function grabFrame(file: File): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const finish = (value: HTMLCanvasElement | null) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 10000);
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
    };
    video.onseeked = () => {
      const scale = Math.min(1, COVER_WIDTH / (video.videoWidth || COVER_WIDTH));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx || !canvas.width || !canvas.height) return finish(null);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      finish(canvas);
    };
    video.onerror = () => finish(null);
    video.src = url;
  });
}

// Live preview of the Instagram cover for the artist: same layout numbers as
// the real cover (coverLayout.ts). The picture is cropped slightly
// differently than the real one, so it's labelled as a close preview.
export default function CoverPreview({ file, headline }: { file: File | null; headline: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Tagged with the file it came from, so a stale frame from a previously
  // chosen video is never shown for a new one.
  const [grabbed, setGrabbed] = useState<{ file: File; frame: HTMLCanvasElement | null } | null>(null);
  const [logos, setLogos] = useState<{ logo: HTMLImageElement; wordmark: HTMLImageElement } | null>(null);
  const current = grabbed && grabbed.file === file ? grabbed : null;
  const frame = current?.frame ?? null;
  const status: "idle" | "loading" | "failed" = !file || !current ? (file ? "loading" : "idle") : current.frame ? "idle" : "failed";

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadImage("/logo.png"), loadImage("/wordmark.png")])
      .then(([logo, wordmark]) => !cancelled && setLogos({ logo, wordmark }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    grabFrame(file).then((f) => {
      if (!cancelled) setGrabbed({ file, frame: f });
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !frame || !logos) return;
    const W = COVER_WIDTH;
    const H = COVER_HEIGHT;
    const text = headline.replace(/\s+/g, " ").trim() || "Your headline here";
    const { tier, lines, captionStartY, logoTop, fadeStart, fadeSolid } = layoutCover(text);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);

    if (frame.height >= frame.width) {
      const scale = Math.max(W / frame.width, H / frame.height);
      const w = frame.width * scale;
      const h = frame.height * scale;
      ctx.drawImage(frame, (W - w) / 2, (H - h) / 2, w, h);
    } else {
      // Landscape: full width over a darkened, blurred copy of itself.
      const scale = Math.max(W / frame.width, H / frame.height) * 1.1;
      const w = frame.width * scale;
      const h = frame.height * scale;
      ctx.filter = "blur(40px)";
      ctx.drawImage(frame, (W - w) / 2, (H - h) / 2, w, h);
      ctx.filter = "none";
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);
      const fh = (frame.height * W) / frame.width;
      ctx.drawImage(frame, 0, Math.max(0, FRONT_BOTTOM - fh), W, fh);
    }

    const gradient = ctx.createLinearGradient(0, fadeStart, 0, fadeSolid);
    gradient.addColorStop(0, "rgba(10,10,10,0)");
    gradient.addColorStop(1, `rgba(10,10,10,${FADE_OPACITY})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, fadeStart, W, fadeSolid - fadeStart);
    ctx.fillStyle = `rgba(10,10,10,${FADE_OPACITY})`;
    ctx.fillRect(0, fadeSolid, W, H - fadeSolid);

    ctx.fillStyle = BRAND_ORANGE;
    ctx.textAlign = "center";
    ctx.font = `900 ${tier.fontSize}px "Arial Black", Arial, sans-serif`;
    lines.forEach((line, i) => ctx.fillText(line, W / 2, captionStartY + i * tier.lineHeight));

    ctx.drawImage(logos.logo, W / 2 - tier.logoSize / 2, logoTop, tier.logoSize, tier.logoSize);
    const wordmarkH = (logos.wordmark.height * WORDMARK_WIDTH) / logos.wordmark.width;
    ctx.drawImage(logos.wordmark, W - 40 - WORDMARK_WIDTH, WORDMARK_TOP, WORDMARK_WIDTH, wordmarkH);
  }, [frame, logos, headline]);

  if (!file) {
    return (
      <p className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
        Choose your video and a preview of your Instagram cover will show up here.
      </p>
    );
  }

  return (
    <div>
      {status === "loading" && <p className="text-xs text-zinc-500">Building your preview&hellip;</p>}
      {status === "failed" && (
        <p className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
          We couldn&rsquo;t build a preview for this video on your device, but you can still submit it.
        </p>
      )}
      <canvas
        ref={canvasRef}
        width={COVER_WIDTH}
        height={COVER_HEIGHT}
        className={`aspect-[9/16] w-[240px] max-w-full rounded-xl bg-black ring-4 ring-zinc-800 ${
          frame ? "" : "hidden"
        }`}
      />
      {frame && (
        <p className="mt-2 text-xs text-zinc-500">
          Close preview of your cover. Our team may adjust the wording before it&rsquo;s posted.
        </p>
      )}
    </div>
  );
}
