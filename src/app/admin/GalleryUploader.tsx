"use client";

import { useRef, useState } from "react";

interface ExistingImage {
  id: number;
  url: string;
  credit: string | null;
}

export default function GalleryUploader({
  existingImages = [],
}: {
  existingImages?: ExistingImage[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700">
        Gallery
      </label>
      <p className="mt-1 text-xs text-zinc-400">
        Additional photos shown below the article. Each can have its own
        credit.
      </p>

      {existingImages.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {existingImages.map((img) => (
            <div key={img.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                className="h-20 w-full rounded-lg border border-zinc-200 object-cover"
              />
              {img.credit && (
                <p className="mt-0.5 truncate text-xs text-zinc-400">
                  {img.credit}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        name="gallery"
        accept="image/*"
        multiple
        onChange={handleChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            d="M12 16V4M12 4l-4 4M12 4l4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Add Photos
      </button>

      {previews.length > 0 && (
        <div className="mt-3 space-y-2">
          {previews.map((src, i) => (
            <div key={i} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="h-16 w-16 shrink-0 rounded-lg border border-zinc-200 object-cover"
              />
              <input
                type="text"
                name={`gallery_credit_${i}`}
                placeholder="Credit (optional)"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
