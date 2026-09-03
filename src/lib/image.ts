export interface StockPhoto {
  url: string;
  credit_name: string;
  credit_url: string;
}

// Looks up a topic-matched stock photo via Pexels (free, attribution-friendly —
// unlike scraping the source article's own photo, this carries no copyright risk).
export async function fetchStockPhoto(
  query: string
): Promise<StockPhoto | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        query
      )}&per_page=1&orientation=landscape`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data.photos?.[0];
    if (!photo) return null;

    return {
      url: photo.src.large,
      credit_name: photo.photographer,
      credit_url: photo.photographer_url,
    };
  } catch {
    return null;
  }
}
