"use client";

import { useRef, useState } from "react";

export default function ImageUploadField({
  currentImageUrl,
}: {
  currentImageUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      setFileName(null);
      return;
    }
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
  }

  const displayImage = preview || currentImageUrl;

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700">
        Photo
      </label>

      {displayImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayImage}
          alt=""
          className="mt-2 h-32 w-auto rounded-lg border border-zinc-200 object-cover"
        />
      )}

      <input
        ref={inputRef}
        type="file"
        name="image"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
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
          {currentImageUrl ? "Replace Photo" : "Upload Photo"}
        </button>
        {fileName && (
          <span className="truncate text-sm text-zinc-500">{fileName}</span>
        )}
      </div>
    </div>
  );
}
