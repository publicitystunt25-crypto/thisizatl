const COLORS: Record<string, string> = {
  Music: "bg-orange-100 text-orange-800",
  Entertainment: "bg-pink-100 text-pink-800",
  News: "bg-blue-100 text-blue-800",
  Culture: "bg-purple-100 text-purple-800",
  Events: "bg-green-100 text-green-800",
};

export default function CategoryBadge({ category }: { category: string }) {
  const classes = COLORS[category] || "bg-zinc-100 text-zinc-700";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      {category}
    </span>
  );
}
