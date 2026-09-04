import { CATEGORIES } from "@/lib/categories";

export default function PostFormFields({
  defaultTitle = "",
  defaultBody = "",
  defaultCategory = "Music",
  defaultStatus = "draft",
  currentImageUrl,
}: {
  defaultTitle?: string;
  defaultBody?: string;
  defaultCategory?: string;
  defaultStatus?: "draft" | "published";
  currentImageUrl?: string | null;
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
          Photo {currentImageUrl && "(replace)"}
        </label>
        {currentImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentImageUrl}
            alt=""
            className="mt-2 h-32 w-auto rounded-lg object-cover"
          />
        )}
        <input
          type="file"
          name="image"
          accept="image/*"
          className="mt-1 w-full text-sm"
        />
      </div>
    </>
  );
}
