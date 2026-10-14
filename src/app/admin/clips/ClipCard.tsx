"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveClipAction, declineClipAction } from "./actions";

export interface ClipCardData {
  id: number;
  name: string;
  instagram: string | null;
  email: string | null;
  submitterCaption: string;
  videoUrl: string;
  durationSeconds: number | null;
  status: "pending" | "posting" | "failed";
  error: string | null;
  createdLabel: string;
  defaultHeadline: string;
  defaultCaption: string;
  defaultCollaborators: string[];
}

const inputClasses =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";
const labelClasses = "block text-xs font-medium uppercase tracking-wide text-zinc-500";

export default function ClipCard({ clip }: { clip: ClipCardData }) {
  const router = useRouter();
  const [headline, setHeadline] = useState(clip.defaultHeadline);
  const [caption, setCaption] = useState(clip.defaultCaption);
  const [collaborators, setCollaborators] = useState<string[]>(clip.defaultCollaborators);
  const [collabInput, setCollabInput] = useState("");
  // The headline the cover preview was last built with (it only refreshes when
  // Preview is pressed, not on every keystroke) plus a cache-buster.
  const [coverFor, setCoverFor] = useState({ headline: clip.defaultHeadline, v: 0 });
  const [coverLoading, setCoverLoading] = useState(true);
  // The video only loads when asked for, so a long list of clips stays fast
  // and doesn't use up Cloudinary bandwidth on clips nobody plays.
  const [showVideo, setShowVideo] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [approving, startApprove] = useTransition();
  const [declining, startDecline] = useTransition();

  // While a clip is posting, keep refreshing so the card flips to "posted"
  // or "failed" on its own without anyone reloading the page.
  useEffect(() => {
    if (clip.status !== "posting") return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [clip.status, router]);

  const busy = approving || declining;

  function handlePreview() {
    setMessage(null);
    setCoverLoading(true);
    setCoverFor((c) => ({ headline: headline.trim(), v: c.v + 1 }));
  }

  // Handles typed into the add box count too, so approving without pressing
  // "Add" first doesn't silently drop them.
  function pendingCollaborators(): string[] {
    const typed = collabInput
      .split(/[\s,]+/)
      .map((h) => h.trim())
      .filter(Boolean);
    return [...collaborators, ...typed];
  }

  function addCollaborators() {
    const typed = collabInput
      .split(/[\s,]+/)
      .map((h) => h.trim().replace(/^@?/, "@"))
      .filter((h) => h.length > 1);
    if (typed.length === 0) return;
    const next = [...collaborators];
    for (const h of typed) if (!next.some((n) => n.toLowerCase() === h.toLowerCase())) next.push(h);
    if (next.length > 3) {
      setMessage({ kind: "error", text: "Instagram allows up to 3 collaborators on one post." });
      return;
    }
    setMessage(null);
    setCollaborators(next);
    setCollabInput("");
  }

  function handleApprove() {
    setMessage(null);
    if (!window.confirm("Post this to Instagram as a Reel now? This can't be undone from here.")) return;
    startApprove(async () => {
      const result = await approveClipAction(clip.id, headline, caption, pendingCollaborators());
      if (result.ok) router.refresh();
      else setMessage({ kind: "error", text: result.error });
    });
  }

  function handleDecline() {
    setMessage(null);
    if (!window.confirm("Decline this clip? The uploaded video will be deleted.")) return;
    startDecline(async () => {
      await declineClipAction(clip.id);
      router.refresh();
    });
  }

  if (clip.status === "posting") {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <p className="font-medium text-blue-900">Posting to Instagram… ({clip.name})</p>
        <p className="mt-1 text-sm text-blue-800">
          Waiting on Instagram to process the video. This usually takes a
          few minutes &mdash; this card updates by itself.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-ink">{clip.name}</p>
        {clip.status === "failed" && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            Last post failed
          </span>
        )}
        <span className="text-xs text-zinc-400">
          {clip.createdLabel}
          {clip.durationSeconds != null ? ` · ${Math.round(clip.durationSeconds)}s` : ""}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-zinc-500">
        {clip.instagram ?? "no Instagram given"}
        {clip.email ? ` · ${clip.email}` : ""}
      </p>

      {clip.status === "failed" && clip.error && (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {clip.error}
        </p>
      )}

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div className="space-y-5">
          <div>
            <p className={labelClasses}>Instagram cover image</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={coverFor.v}
              loading="lazy"
              src={`/admin/clips/cover/${clip.id}?h=${encodeURIComponent(coverFor.headline)}&v=${coverFor.v}`}
              alt="Cover image preview"
              onLoad={() => setCoverLoading(false)}
              onError={() => {
                setCoverLoading(false);
                setMessage({ kind: "error", text: "The cover preview didn't load. Press Preview cover to try again." });
              }}
              className="mt-1 aspect-[9/16] w-[300px] max-w-full rounded-2xl bg-black object-contain ring-4 ring-zinc-800"
            />
            {coverLoading && <p className="mt-1 text-xs text-zinc-500">Building the cover&hellip;</p>}
          </div>
          <div>
            {showVideo ? (
              <>
                <p className={labelClasses}>The video (plays as uploaded)</p>
                <video
                  src={clip.videoUrl}
                  controls
                  autoPlay
                  playsInline
                  onError={() => setMessage({ kind: "error", text: "The original video didn't load." })}
                  className="mt-1 max-h-[480px] w-full rounded-lg bg-black"
                />
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowVideo(true)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                &#9654; Play video
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className={labelClasses}>What they wrote</p>
            <p className="mt-1 whitespace-pre-line rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
              {clip.submitterCaption}
            </p>
          </div>

          <div>
            <label className={labelClasses}>Headline on the cover image</label>
            <input
              type="text"
              value={headline}
              maxLength={140}
              onChange={(e) => setHeadline(e.target.value)}
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>Instagram caption</label>
            <textarea
              rows={5}
              value={caption}
              maxLength={2200}
              onChange={(e) => setCaption(e.target.value)}
              className={inputClasses}
            />
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className={labelClasses}>Collaborators (up to 3)</p>
            <p className="mt-1 text-xs text-zinc-500">
              Each one gets an invite to co-author the Reel, so it also shows on their profile once they
              accept. Their account must be public and a Business or Creator profile.
            </p>
            {collaborators.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {collaborators.map((c) => (
                  <li
                    key={c}
                    className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm text-zinc-800 ring-1 ring-zinc-300"
                  >
                    {c}
                    <button
                      type="button"
                      aria-label={`Remove ${c}`}
                      onClick={() => setCollaborators(collaborators.filter((x) => x !== c))}
                      className="ml-1 text-zinc-400 hover:text-red-600"
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={collabInput}
                placeholder="@handle (press Add or Enter)"
                onChange={(e) => setCollabInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCollaborators();
                  }
                }}
                className={inputClasses}
              />
              <button
                type="button"
                onClick={addCollaborators}
                disabled={!collabInput.trim() || collaborators.length >= 3}
                className="mt-1 shrink-0 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <p
          className={`mt-4 rounded-lg border p-3 text-sm ${
            message.kind === "error"
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-blue-200 bg-blue-50 text-blue-800"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handlePreview}
          disabled={busy || !headline.trim()}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Preview cover
        </button>
        <button
          type="button"
          onClick={handleApprove}
          disabled={busy || !headline.trim() || !caption.trim()}
          className="rounded-full bg-green-700 px-5 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {approving ? "Starting…" : clip.status === "failed" ? "Retry & post to Instagram" : "Approve & post to Instagram"}
        </button>
        <button
          type="button"
          onClick={handleDecline}
          disabled={busy}
          className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
