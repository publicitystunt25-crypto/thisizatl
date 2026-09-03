export const CATEGORIES = ["Music", "Entertainment", "News", "Culture", "Events"] as const;

export type Category = (typeof CATEGORIES)[number];

// Preferred order for picking the homepage's featured story -- prefer Music,
// then general Entertainment, before falling back to anything else.
export const FEATURED_PRIORITY: Category[] = ["Music", "Entertainment"];
