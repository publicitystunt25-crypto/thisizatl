import { CATEGORIES } from "@/lib/categories";
import ImageUploadField from "./ImageUploadField";
import GalleryUploader from "./GalleryUploader";

interface ExistingGalleryImage {
  id: number;
  url: string;
  credit: string | null;
}

function toDatetimeLocalValue(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function PostFormFields({
  defaultTitle = "",
  defaultBody = "",
  defaultCategory = "Music",
  defaultStatus = "draft",
  defaultCreatedAt,
  currentImageUrl,
  currentImageCredit,
  existingGalleryImages = [],
}: {
  defaultTitle?: string;
  defaultBody?: string;
  defaultCategory?: string;
  defaultStatus?: "draft" | "published";
  defaultCreatedAt?: string | null;
  currentImageUrl?: string | null;
  currentImageCredit?: string | null;
  existingGalleryImages?: ExistingGalleryImage[];
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Title
        </label>
        <input
          type="text"
          name="title"
          required
          defaultValue={defaultTitle}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Body
        </label>
        <textarea
          name="body"
          required
          rows={14}
          defaultValue={defaultBody}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm leading-relaxed focus:border-brand focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-400">
          Separate paragraphs with a blank line.
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-zinc-700">
            Category
          </label>
          <select
            name="category"
            defaultValue={defaultCategory}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-zinc-700">
            Status
          </label>
          <select
            name="status"
            defaultValue={defaultStatus}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Published Date
        </label>
        <input
          type="datetime-local"
          name="created_at"
          defaultValue={toDatetimeLocalValue(defaultCreatedAt)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-400">
          Controls where this post sorts and the date shown to readers.
        </p>
      </div>

      <ImageUploadField
        currentImageUrl={currentImageUrl}
        currentCredit={currentImageCredit}
      />

      <GalleryUploader existingImages={existingGalleryImages} />
    </>
  );
}
