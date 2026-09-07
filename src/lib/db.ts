import { Pool } from "pg";
import { cache } from "react";

// Supabase's session-mode pooler (port 5432) caps concurrent clients low
// (15 on this project) -- a small max here, plus releasing idle clients
// quickly, keeps a single app instance from eating a big share of that
// budget, especially with an old instance briefly overlapping a new one
// during a Render deploy.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
});

let initialized: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!initialized) {
    initialized = pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        sources TEXT NOT NULL,
        similarity_note TEXT,
        image_url TEXT,
        image_credit_name TEXT,
        image_credit_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS seen_links (
        link TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      ALTER TABLE posts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'News';
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_data BYTEA;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_mime TEXT;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS author TEXT;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_credit TEXT;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_width INTEGER;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_height INTEGER;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS social_shared BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS submitter_email TEXT;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS fb_post_id TEXT;

      CREATE TABLE IF NOT EXISTS post_images (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        image_data BYTEA NOT NULL,
        image_mime TEXT NOT NULL,
        credit TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `).then(() => undefined);
  }
  return initialized;
}

export interface Post {
  id: number;
  slug: string;
  title: string;
  body: string;
  sources: string; // JSON string: {title, url, source}[]
  similarity_note: string | null;
  image_url: string | null;
  image_credit_name: string | null;
  image_credit_url: string | null;
  image_credit: string | null;
  category: string;
  status: "draft" | "published" | "scheduled";
  author: string | null;
  created_at: string;
  is_featured: boolean;
  image_width: number | null;
  image_height: number | null;
  social_shared: boolean;
  scheduled_for: string | null;
  submitter_email: string | null;
  fb_post_id: string | null;
}

export interface PostImage {
  id: number;
  post_id: number;
  credit: string | null;
}

export async function insertPost(post: {
  slug: string;
  title: string;
  body: string;
  sources: { title: string; url: string; source: string }[];
  similarity_note: string | null;
  image_url: string | null;
  image_credit_name: string | null;
  image_credit_url: string | null;
  category: string;
  status?: "draft" | "published";
  author?: string | null;
  created_at?: string | null;
  image_width?: number | null;
  image_height?: number | null;
  submitter_email?: string | null;
}): Promise<number> {
  await ensureInit();
  const res = await pool.query<{ id: number }>(
    `INSERT INTO posts (slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, category, status, author, created_at, image_width, image_height, submitter_email)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, now()), $13, $14, $15)
     RETURNING id`,
    [
      post.slug,
      post.title,
      post.body,
      JSON.stringify(post.sources),
      post.similarity_note,
      post.image_url,
      post.image_credit_name,
      post.image_credit_url,
      post.category,
      post.status ?? "published",
      post.author ?? null,
      post.created_at ?? null,
      post.image_width ?? null,
      post.image_height ?? null,
      post.submitter_email ?? null,
    ]
  );
  return res.rows[0].id;
}

export async function updatePost(
  id: number,
  post: {
    slug: string;
    title: string;
    body: string;
    category: string;
    status: "draft" | "published";
    image_url?: string | null;
    image_credit?: string | null;
    created_at?: string | null;
  }
): Promise<void> {
  await ensureInit();
  if (post.image_url !== undefined) {
    await pool.query(
      `UPDATE posts SET slug = $1, title = $2, body = $3, category = $4, status = $5, image_url = $6
       WHERE id = $7`,
      [post.slug, post.title, post.body, post.category, post.status, post.image_url, id]
    );
  } else {
    await pool.query(
      `UPDATE posts SET slug = $1, title = $2, body = $3, category = $4, status = $5
       WHERE id = $6`,
      [post.slug, post.title, post.body, post.category, post.status, id]
    );
  }
  if (post.created_at) {
    await pool.query(`UPDATE posts SET created_at = $1 WHERE id = $2`, [
      post.created_at,
      id,
    ]);
  }
  if (post.image_credit !== undefined) {
    await pool.query(`UPDATE posts SET image_credit = $1 WHERE id = $2`, [
      post.image_credit,
      id,
    ]);
  }
}

export async function setPostImage(
  id: number,
  data: Buffer,
  mime: string,
  imageUrl: string,
  credit?: string | null,
  dimensions?: { width: number; height: number } | null
): Promise<void> {
  await ensureInit();
  await pool.query(
    `UPDATE posts SET image_data = $1, image_mime = $2, image_url = $3,
     image_credit_name = NULL, image_credit_url = NULL, image_credit = $5,
     image_width = $6, image_height = $7 WHERE id = $4`,
    [
      data,
      mime,
      imageUrl,
      id,
      credit ?? null,
      dimensions?.width ?? null,
      dimensions?.height ?? null,
    ]
  );
}

export async function setSocialShared(
  id: number,
  shared: boolean,
  fbPostId?: string | null
): Promise<void> {
  await ensureInit();
  await pool.query(
    `UPDATE posts SET social_shared = $1, fb_post_id = COALESCE($2, fb_post_id) WHERE id = $3`,
    [shared, fbPostId ?? null, id]
  );
}

export async function schedulePost(id: number, scheduledFor: string): Promise<void> {
  await ensureInit();
  await pool.query(
    `UPDATE posts SET status = 'scheduled', scheduled_for = $1 WHERE id = $2`,
    [scheduledFor, id]
  );
}

export async function cancelSchedule(id: number): Promise<void> {
  await ensureInit();
  await pool.query(
    `UPDATE posts SET status = 'draft', scheduled_for = NULL WHERE id = $1`,
    [id]
  );
}

export async function clearSchedule(id: number): Promise<void> {
  await ensureInit();
  await pool.query(`UPDATE posts SET scheduled_for = NULL WHERE id = $1`, [id]);
}

// Picked up by the hourly pipeline trigger -- scheduled posts go live within
// about an hour of their target time, not to the minute, since publishing
// piggybacks on the existing cron ping rather than its own timer.
export async function getDueScheduledPosts(): Promise<Post[]> {
  await ensureInit();
  const res = await pool.query<Post>(
    `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, image_credit, category, status, author, created_at, is_featured, image_width, image_height, social_shared, scheduled_for, submitter_email, fb_post_id
     FROM posts WHERE status = 'scheduled' AND scheduled_for <= now()`
  );
  return res.rows;
}

export async function markPublishedFromSchedule(id: number): Promise<void> {
  await ensureInit();
  await pool.query(
    `UPDATE posts SET status = 'published', scheduled_for = NULL WHERE id = $1`,
    [id]
  );
}

export async function addPostImages(
  postId: number,
  images: { data: Buffer; mime: string; credit: string | null }[]
): Promise<void> {
  await ensureInit();
  const res = await pool.query<{ max: number | null }>(
    `SELECT MAX(position) as max FROM post_images WHERE post_id = $1`,
    [postId]
  );
  let nextPosition = (res.rows[0].max ?? -1) + 1;
  for (const img of images) {
    await pool.query(
      `INSERT INTO post_images (post_id, image_data, image_mime, credit, position)
       VALUES ($1, $2, $3, $4, $5)`,
      [postId, img.data, img.mime, img.credit, nextPosition]
    );
    nextPosition++;
  }
}

export async function getPostImages(postId: number): Promise<PostImage[]> {
  await ensureInit();
  const res = await pool.query<PostImage>(
    `SELECT id, post_id, credit FROM post_images WHERE post_id = $1 ORDER BY position ASC`,
    [postId]
  );
  return res.rows;
}

export async function getGalleryImageBytes(
  id: number
): Promise<{ data: Buffer; mime: string } | undefined> {
  await ensureInit();
  const res = await pool.query<{ image_data: Buffer; image_mime: string }>(
    `SELECT image_data, image_mime FROM post_images WHERE id = $1`,
    [id]
  );
  const row = res.rows[0];
  if (!row) return undefined;
  return { data: row.image_data, mime: row.image_mime };
}

export async function deletePostImageRow(id: number): Promise<void> {
  await ensureInit();
  await pool.query(`DELETE FROM post_images WHERE id = $1`, [id]);
}

export async function clearPostImage(id: number): Promise<void> {
  await ensureInit();
  await pool.query(
    `UPDATE posts SET image_data = NULL, image_mime = NULL, image_url = NULL,
     image_credit_name = NULL, image_credit_url = NULL, image_credit = NULL WHERE id = $1`,
    [id]
  );
}

export async function getPostImage(
  id: number
): Promise<{ data: Buffer; mime: string } | undefined> {
  await ensureInit();
  const res = await pool.query<{ image_data: Buffer; image_mime: string }>(
    `SELECT image_data, image_mime FROM posts WHERE id = $1`,
    [id]
  );
  const row = res.rows[0];
  if (!row || !row.image_data) return undefined;
  return { data: row.image_data, mime: row.image_mime };
}

export async function deletePost(id: number): Promise<void> {
  await ensureInit();
  await pool.query(`DELETE FROM posts WHERE id = $1`, [id]);
}

export async function setFeaturedPost(id: number): Promise<void> {
  await ensureInit();
  await pool.query(`UPDATE posts SET is_featured = false WHERE id != $1`, [id]);
  await pool.query(`UPDATE posts SET is_featured = true WHERE id = $1`, [id]);
}

export async function unsetFeaturedPost(id: number): Promise<void> {
  await ensureInit();
  await pool.query(`UPDATE posts SET is_featured = false WHERE id = $1`, [id]);
}

export async function getAllPosts(category?: string): Promise<Post[]> {
  await ensureInit();
  if (category) {
    const res = await pool.query<Post>(
      `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, image_credit, category, status, author, created_at, is_featured, image_width, image_height, social_shared, scheduled_for, submitter_email, fb_post_id
       FROM posts WHERE category = $1 AND status = 'published' ORDER BY created_at DESC`,
      [category]
    );
    return res.rows;
  }
  const res = await pool.query<Post>(
    `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, image_credit, category, status, author, created_at, is_featured, image_width, image_height, social_shared, scheduled_for, submitter_email, fb_post_id
     FROM posts WHERE status = 'published' ORDER BY created_at DESC`
  );
  return res.rows;
}

export async function getAllPostsAdmin(): Promise<Post[]> {
  await ensureInit();
  const res = await pool.query<Post>(
    `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, image_credit, category, status, author, created_at, is_featured, image_width, image_height, social_shared, scheduled_for, submitter_email, fb_post_id
     FROM posts ORDER BY created_at DESC`
  );
  return res.rows;
}

export async function getPostById(id: number): Promise<Post | undefined> {
  await ensureInit();
  const res = await pool.query<Post>(
    `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, image_credit, category, status, author, created_at, is_featured, image_width, image_height, social_shared, scheduled_for, submitter_email, fb_post_id
     FROM posts WHERE id = $1`,
    [id]
  );
  return res.rows[0];
}

export const getPostBySlug = cache(
  async (slug: string): Promise<Post | undefined> => {
    await ensureInit();
    const res = await pool.query<Post>(
      `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, image_credit, category, status, author, created_at, is_featured, image_width, image_height, social_shared, scheduled_for, submitter_email, fb_post_id
       FROM posts WHERE slug = $1 AND status = 'published'`,
      [slug]
    );
    return res.rows[0];
  }
);

export async function getTodayPostCount(): Promise<number> {
  await ensureInit();
  const res = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM posts WHERE created_at >= date_trunc('day', now()) AND status = 'published'`
  );
  return parseInt(res.rows[0].count, 10);
}

// Guards the artist submission form against duplicate spam from someone
// hitting back/reload and resubmitting a fresh page (a client-side "disable
// the button while submitting" fix can't catch that, since it's a brand new
// page load with its own button). image_credit holds the submitted artist
// name for these posts.
export async function hasRecentSubmissionByArtist(
  artistName: string,
  withinMinutes = 10
): Promise<boolean> {
  await ensureInit();
  const res = await pool.query(
    `SELECT 1 FROM posts
     WHERE image_credit = $1
       AND created_at >= now() - ($2 || ' minutes')::interval
     LIMIT 1`,
    [artistName, withinMinutes]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function getRecentPostTitles(days = 7): Promise<string[]> {
  await ensureInit();
  const res = await pool.query<{ title: string }>(
    `SELECT title FROM posts WHERE created_at >= now() - ($1 || ' days')::interval AND status = 'published' ORDER BY created_at DESC`,
    [days]
  );
  return res.rows.map((r) => r.title);
}

export async function hasSeenLink(link: string): Promise<boolean> {
  await ensureInit();
  const res = await pool.query(`SELECT 1 FROM seen_links WHERE link = $1`, [
    link,
  ]);
  return (res.rowCount ?? 0) > 0;
}

export async function markLinkSeen(link: string): Promise<void> {
  await ensureInit();
  await pool.query(
    `INSERT INTO seen_links (link) VALUES ($1) ON CONFLICT (link) DO NOTHING`,
    [link]
  );
}

export default pool;
