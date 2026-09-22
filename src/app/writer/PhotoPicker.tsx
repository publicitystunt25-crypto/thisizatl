"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface ExistingImage {
  id: number;
  url: string;
  credit: string | null;
}

// Lets a writer attach several photos to one article and pick which single
// one is the main/featured image -- the rest become the article's gallery.
// The radio group is native (name="mainChoice"), so the browser submits the
// choice with no extra JS; only the file previews for newly-selected photos
// need client state.
export default function PhotoPicker({
  existingMain,
  existingGallery = [],
  onDeleteGalleryImage,
}: {
  existingMain?: { url: string; credit: string | null } | null;
  existingGallery?: ExistingImage[];
  onDeleteGalleryImage?: (imageId: number) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // A native file input's FileList is fully replaced by the browser every
  // time someone picks files, not appended to -- clicking "Add more photos"
  // a second time was silently discarding the first batch instead of adding
  // to it, which read as "every photo I upload replaces the one before it".
  // Accumulating in React state and writing the merged set back onto the
  // input (so the actual form submission includes everything) fixes that.
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return; // the picker was cancelled

    const merged = [...newFiles, ...picked];
    setNewFiles(merged);
    setPreviews((prev) => [...prev, ...picked.map((f) => URL.createObjectURL(f))]);

    const dt = new DataTransfer();
    merged.forEach((f) => dt.items.add(f));
    e.target.files = dt.files;
  }

  function removeNewFile(index: number) {
    const updated = newFiles.filter((_, i) => i !== index);
    setNewFiles(updated);
    setPreviews((prev) => prev.filter((_, i) => i !== index));

    const dt = new DataTransfer();
    updated.forEach((f) => dt.items.add(f));
    if (inputRef.current) inputRef.current.files = dt.files;
  }

  function handleDeleteExisting(imageId: number) {
    if (!onDeleteGalleryImage) return;
    setRemovedIds((prev) => [...prev, imageId]);
    startTransition(async () => {
      await onDeleteGalleryImage(imageId);
      router.refresh();
    });
  }

  const visibleGallery = existingGallery.filter((img) => !removedIds.includes(img.id));
  const hasAnyExisting = !!existingMain || visibleGallery.length > 0;

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700">Photos</label>
      <p className="mt-1 text-xs text-zinc-400">
        Add one or more photos and pick which one shows at the top of the article. The rest are
        shown as a gallery below it.
      </p>

      {hasAnyExisting && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {existingMain && (
            <PhotoOption
              url={existingMain.url}
              caption={existingMain.credit ? `Current main — ${existingMain.credit}` : "Current main photo"}
              radioValue="keep"
              defaultChecked
            />
          )}
          {visibleGallery.map((img) => (
            <PhotoOption
              key={img.id}
              url={img.url}
              caption={img.credit ?? undefined}
              radioValue={`existing:${img.id}`}
              onDelete={onDeleteGalleryImage ? () => handleDeleteExisting(img.id) : undefined}
              deleteDisabled={isPending}
            />
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        name="photos"
        accept="image/*"
        multiple
        onChange={handleChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-3 rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
      >
        {hasAnyExisting ? "Add more photos" : "Choose photos"}
      </button>

      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {previews.map((src, i) => (
            <div key={src}>
              <PhotoOption
                url={src}
                radioValue={`new:${i}`}
                defaultChecked={!hasAnyExisting && i === 0}
                onDelete={() => removeNewFile(i)}
              />
              <input
                type="text"
                name={`photo_credit_${i}`}
                placeholder="Credit (optional)"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1 text-xs focus:border-brand focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}
      {newFiles.length === 0 && !hasAnyExisting && (
        // Nothing uploaded yet -- no radio group exists, so the server side
        // has no mainChoice to read. Sending "new:0" here is harmless once a
        // photo is actually attached, and irrelevant when none is.
        <input type="hidden" name="mainChoice" value="new:0" />
      )}
    </div>
  );
}

function PhotoOption({
  url,
  caption,
  radioValue,
  defaultChecked,
  onDelete,
  deleteDisabled,
}: {
  url: string;
  caption?: string;
  radioValue: string;
  defaultChecked?: boolean;
  onDelete?: () => void;
  deleteDisabled?: boolean;
}) {
  return (
    <label className="relative block cursor-pointer">
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview or an already-sized upload, not a page asset to run through next/image */}
      <img src={url} alt="" className="h-24 w-full rounded-lg border border-zinc-200 object-cover" />
      <div className="mt-1 flex items-center gap-1.5">
        <input type="radio" name="mainChoice" value={radioValue} defaultChecked={defaultChecked} />
        <span className="truncate text-xs text-zinc-500">{caption ?? "Set as main"}</span>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onDelete();
          }}
          disabled={deleteDisabled}
          aria-label="Remove photo"
          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white hover:bg-black disabled:opacity-50"
        >
          ×
        </button>
      )}
    </label>
  );
}
