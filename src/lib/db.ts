import { randomBytes } from "crypto";
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
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS focus_x REAL;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS focus_y REAL;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS ig_feed_shared BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS ig_media_id TEXT;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_golden_peach BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS preview_emailed_at TIMESTAMPTZ;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS review_token TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS posts_review_token_idx ON posts (review_token);
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS review_status TEXT;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS review_note TEXT;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS review_responded_at TIMESTAMPTZ;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS revision_send_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS post_images (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        image_data BYTEA NOT NULL,
        image_mime TEXT NOT NULL,
        credit TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS replied_comments (
        comment_id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS nominations (
        id SERIAL PRIMARY KEY,
        nominee_name TEXT NOT NULL,
        nominee_email TEXT,
        nominee_instagram TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      ALTER TABLE nominations ADD COLUMN IF NOT EXISTS nominator_name TEXT;
      ALTER TABLE nominations ADD COLUMN IF NOT EXISTS nominee_email_sent_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS video_submissions (
        id SERIAL PRIMARY KEY,
        submitter_name TEXT NOT NULL,
        submitter_email TEXT,
        submitter_instagram TEXT,
        caption TEXT NOT NULL,
        video_public_id TEXT UNIQUE NOT NULL,
        video_url TEXT NOT NULL,
        duration_seconds REAL,
        bytes BIGINT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      ALTER TABLE video_submissions ADD COLUMN IF NOT EXISTS headline TEXT;
      ALTER TABLE video_submissions ADD COLUMN IF NOT EXISTS ig_caption TEXT;
      ALTER TABLE video_submissions ADD COLUMN IF NOT EXISTS ig_media_id TEXT;
      ALTER TABLE video_submissions ADD COLUMN IF NOT EXISTS error TEXT;
      ALTER TABLE video_submissions ADD COLUMN IF NOT EXISTS posting_started_at TIMESTAMPTZ;
      ALTER TABLE video_submissions ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;
      ALTER TABLE video_submissions ADD COLUMN IF NOT EXISTS cover_token TEXT;

      CREATE TABLE IF NOT EXISTS coverage_requests (
        id SERIAL PRIMARY KEY,
        requester_name TEXT NOT NULL,
        requester_email TEXT NOT NULL,
        requester_phone TEXT,
        organization TEXT,
        role TEXT NOT NULL,
        subject_name TEXT NOT NULL,
        subject_instagram TEXT,
        request_type TEXT NOT NULL,
        details TEXT NOT NULL,
        event_date TEXT,
        deadline TEXT,
        press_kit_url TEXT,
        other_links TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      ALTER TABLE coverage_requests ADD COLUMN IF NOT EXISTS post_id INTEGER;
      UPDATE posts p SET submitter_email = r.requester_email
        FROM coverage_requests r
        WHERE r.post_id = p.id AND p.status IN ('draft', 'scheduled')
          AND (p.submitter_email IS NULL OR p.submitter_email = '');

      CREATE TABLE IF NOT EXISTS coverage_request_images (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES coverage_requests(id) ON DELETE CASCADE,
        image_data BYTEA NOT NULL,
        image_mime TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS review_photos (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        image_data BYTEA NOT NULL,
        image_mime TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      ALTER TABLE review_photos ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'extra';
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
  focus_x: number | null;
  focus_y: number | null;
  ig_feed_shared: boolean;
  ig_media_id: string | null;
  is_golden_peach: boolean;
  // When the preview link was last emailed to the submitter from the admin.
  preview_emailed_at: string | null;
  // The submitter's answer from the emailed review page: "awaiting" once the
  // link is sent, then "live", "scheduled" or "changes_requested".
  review_status: "awaiting" | "live" | "scheduled" | "changes_requested" | "revising" | null;
  revision_send_at: string | null;
  review_note: string | null;
  review_responded_at: string | null;
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
  dimensions?: { width: number; height: number } | null,
  focus?: { x: number; y: number } | null
): Promise<void> {
  await ensureInit();
  await pool.query(
    `UPDATE posts SET image_data = $1, image_mime = $2, image_url = $3,
     image_credit_name = NULL, image_credit_url = NULL, image_credit = $5,
     image_width = $6, image_height = $7, focus_x = $8, focus_y = $9 WHERE id = $4`,
    [
      data,
      mime,
      imageUrl,
      id,
      credit ?? null,
      dimensions?.width ?? null,
      dimensions?.height ?? null,
      focus?.x ?? null,
      focus?.y ?? null,
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

export async function setIgFeedShared(id: number, shared: boolean): Promise<void> {
  await ensureInit();
  await pool.query(`UPDATE posts SET ig_feed_shared = $1 WHERE id = $2`, [shared, id]);
}

export async function setIgMediaId(id: number, mediaId: string): Promise<void> {
  await ensureInit();
  await pool.query(`UPDATE posts SET ig_media_id = $1 WHERE id = $2`, [mediaId, id]);
}

export async function hasRepliedToComment(commentId: string): Promise<boolean> {
  await ensureInit();
  const res = await pool.query(`SELECT 1 FROM replied_comments WHERE comment_id = $1`, [
    commentId,
  ]);
  return (res.rowCount ?? 0) > 0;
}

export async function markCommentReplied(commentId: string): Promise<void> {
  await ensureInit();
  await pool.query(
    `INSERT INTO replied_comments (comment_id) VALUES ($1) ON CONFLICT (comment_id) DO NOTHING`,
    [commentId]
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
    `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, image_credit, category, status, author, created_at, is_featured, image_width, image_height, social_shared, scheduled_for, submitter_email, fb_post_id, focus_x, focus_y, ig_feed_shared, ig_media_id, is_golden_peach
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

// Unlike is_featured (exclusive -- only one homepage hero at a time), Golden
// Peach is a standing honor that can apply to any number of posts over time,
// picked by staff whenever rather than on a fixed schedule.
export async function setGoldenPeach(id: number): Promise<void> {
  await ensureInit();
  await pool.query(`UPDATE posts SET is_golden_peach = true WHERE id = $1`, [id]);
}

export async function unsetGoldenPeach(id: number): Promise<void> {
  await ensureInit();
  await pool.query(`UPDATE posts SET is_golden_peach = false WHERE id = $1`, [id]);
}

export async function getAllPosts(category?: string): Promise<Post[]> {
  await ensureInit();
  if (category) {
    const res = await pool.query<Post>(
      `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, image_credit, category, status, author, created_at, is_featured, image_width, image_height, social_shared, scheduled_for, submitter_email, fb_post_id, focus_x, focus_y, ig_feed_shared, ig_media_id, is_golden_peach
       FROM posts WHERE category = $1 AND status = 'published' ORDER BY created_at DESC`,
      [category]
    );
    return res.rows;
  }
  const res = await pool.query<Post>(
    `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, image_credit, category, status, author, created_at, is_featured, image_width, image_height, social_shared, scheduled_for, submitter_email, fb_post_id, focus_x, focus_y, ig_feed_shared, ig_media_id, is_golden_peach
     FROM posts WHERE status = 'published' ORDER BY created_at DESC`
  );
  return res.rows;
}

export async function getAllPostsAdmin(): Promise<Post[]> {
  await ensureInit();
  const res = await pool.query<Post>(
    `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, image_credit, category, status, author, created_at, is_featured, image_width, image_height, social_shared, scheduled_for, submitter_email, fb_post_id, focus_x, focus_y, ig_feed_shared, ig_media_id, is_golden_peach, preview_emailed_at, review_status, review_note, review_responded_at, revision_send_at
     FROM posts ORDER BY created_at DESC`
  );
  return res.rows;
}

export async function insertNomination(nomination: {
  nominator_name: string;
  nominee_name: string;
  nominee_email: string | null;
  nominee_instagram: string | null;
}): Promise<number> {
  await ensureInit();
  const res = await pool.query<{ id: number }>(
    `INSERT INTO nominations (nominator_name, nominee_name, nominee_email, nominee_instagram)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [nomination.nominator_name, nomination.nominee_name, nomination.nominee_email, nomination.nominee_instagram]
  );
  return res.rows[0].id;
}

export type CoverageStatus = "new" | "accepted" | "declined" | "covered";

export interface CoverageRequest {
  id: number;
  requester_name: string;
  requester_email: string;
  requester_phone: string | null;
  organization: string | null;
  role: string;
  subject_name: string;
  subject_instagram: string | null;
  request_type: string;
  details: string;
  event_date: string | null;
  deadline: string | null;
  press_kit_url: string | null;
  other_links: string | null;
  status: CoverageStatus;
  // The draft article made from this request, once there is one.
  post_id: number | null;
  created_at: string;
}

export async function insertCoverageRequest(
  r: Omit<CoverageRequest, "id" | "status" | "created_at" | "post_id">
): Promise<number> {
  await ensureInit();
  const res = await pool.query<{ id: number }>(
    `INSERT INTO coverage_requests
       (requester_name, requester_email, requester_phone, organization, role, subject_name,
        subject_instagram, request_type, details, event_date, deadline, press_kit_url, other_links)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
    [
      r.requester_name,
      r.requester_email,
      r.requester_phone,
      r.organization,
      r.role,
      r.subject_name,
      r.subject_instagram,
      r.request_type,
      r.details,
      r.event_date,
      r.deadline,
      r.press_kit_url,
      r.other_links,
    ]
  );
  return res.rows[0].id;
}

// How many requests the whole site and this one email address have sent
// recently -- the public form's flood guard (see requestCoverageAction).
export async function countRecentCoverageRequests(
  email: string
): Promise<{ siteLastHour: number; emailLastDay: number }> {
  await ensureInit();
  const res = await pool.query<{ site: string; mine: string }>(
    `SELECT
       count(*) FILTER (WHERE created_at > now() - interval '1 hour') AS site,
       count(*) FILTER (WHERE created_at > now() - interval '1 day' AND lower(requester_email) = lower($1)) AS mine
     FROM coverage_requests`,
    [email]
  );
  return { siteLastHour: Number(res.rows[0].site), emailLastDay: Number(res.rows[0].mine) };
}

export async function listCoverageRequests(): Promise<CoverageRequest[]> {
  await ensureInit();
  const res = await pool.query<CoverageRequest>(
    `SELECT * FROM coverage_requests ORDER BY created_at DESC LIMIT 300`
  );
  return res.rows;
}

export async function countNewCoverageRequests(): Promise<number> {
  await ensureInit();
  const res = await pool.query<{ n: string }>(
    `SELECT count(*) AS n FROM coverage_requests WHERE status = 'new'`
  );
  return Number(res.rows[0].n);
}

export async function setCoverageRequestStatus(id: number, status: CoverageStatus): Promise<void> {
  await ensureInit();
  await pool.query(`UPDATE coverage_requests SET status = $1 WHERE id = $2`, [status, id]);
}

export async function getCoverageRequest(id: number): Promise<CoverageRequest | undefined> {
  await ensureInit();
  const res = await pool.query<CoverageRequest>(`SELECT * FROM coverage_requests WHERE id = $1`, [id]);
  return res.rows[0];
}

// Photos are removed with it (ON DELETE CASCADE).
export async function deleteCoverageRequest(id: number): Promise<void> {
  await ensureInit();
  await pool.query(`DELETE FROM coverage_requests WHERE id = $1`, [id]);
}

// Only sets it if no draft was linked yet, so a double-click can't link two.
export async function setCoverageRequestPost(id: number, postId: number): Promise<boolean> {
  await ensureInit();
  const res = await pool.query(
    `UPDATE coverage_requests SET post_id = $1 WHERE id = $2 AND post_id IS NULL`,
    [postId, id]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function listCoverageRequestImages(requestId: number): Promise<{ data: Buffer; mime: string }[]> {
  await ensureInit();
  const res = await pool.query<{ image_data: Buffer; image_mime: string }>(
    `SELECT image_data, image_mime FROM coverage_request_images WHERE request_id = $1 ORDER BY id`,
    [requestId]
  );
  return res.rows.map((r) => ({ data: r.image_data, mime: r.image_mime }));
}

export async function addCoverageRequestImage(requestId: number, data: Buffer, mime: string): Promise<void> {
  await ensureInit();
  await pool.query(
    `INSERT INTO coverage_request_images (request_id, image_data, image_mime) VALUES ($1, $2, $3)`,
    [requestId, data, mime]
  );
}

// Photo ids grouped by request (ids only -- the bytes are served one at a time
// by /admin/requests/photo/[id]).
export async function listCoverageRequestImageIds(): Promise<Record<number, number[]>> {
  await ensureInit();
  const res = await pool.query<{ id: number; request_id: number }>(
    `SELECT id, request_id FROM coverage_request_images ORDER BY id`
  );
  const byRequest: Record<number, number[]> = {};
  for (const row of res.rows) (byRequest[row.request_id] ??= []).push(row.id);
  return byRequest;
}

export async function getCoverageRequestImage(id: number): Promise<{ data: Buffer; mime: string } | undefined> {
  await ensureInit();
  const res = await pool.query<{ image_data: Buffer; image_mime: string }>(
    `SELECT image_data, image_mime FROM coverage_request_images WHERE id = $1`,
    [id]
  );
  const row = res.rows[0];
  return row ? { data: row.image_data, mime: row.image_mime } : undefined;
}

// Replacement photos a submitter sends with a change request. Kept apart from
// post_images so nothing reaches the live article until an admin uses it.
export async function getReviewPhotos(
  postId: number
): Promise<{ id: number; kind: ReviewPhotoKind; data: Buffer; mime: string }[]> {
  await ensureInit();
  const res = await pool.query<{ id: number; kind: ReviewPhotoKind; image_data: Buffer; image_mime: string }>(
    `SELECT id, kind, image_data, image_mime FROM review_photos WHERE post_id = $1 ORDER BY id`,
    [postId]
  );
  return res.rows.map((r) => ({ id: r.id, kind: r.kind, data: r.image_data, mime: r.image_mime }));
}

export async function deleteReviewPhotos(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await ensureInit();
  await pool.query(`DELETE FROM review_photos WHERE id = ANY($1::int[])`, [ids]);
}

// The changes were applied to the article; the client gets the updated review
// link once `sendAt` passes (see lib/reviewRevision.ts).
export async function markRevising(id: number, sendAt: Date): Promise<void> {
  await ensureInit();
  await pool.query(`UPDATE posts SET review_status = 'revising', revision_send_at = $2 WHERE id = $1`, [id, sendAt]);
}

// Claims every revised article whose email is due, so two overlapping sweeps
// (timer, cron, admin page) can't both send it.
export async function claimDueRevisions(): Promise<number[]> {
  await ensureInit();
  const res = await pool.query<{ id: number }>(
    `UPDATE posts SET review_status = 'awaiting', revision_send_at = NULL
     WHERE review_status = 'revising' AND status = 'draft' AND revision_send_at <= now() RETURNING id`
  );
  return res.rows.map((r) => r.id);
}

export type ReviewPhotoKind = "main" | "extra";

export async function addReviewPhoto(postId: number, data: Buffer, mime: string, kind: ReviewPhotoKind): Promise<void> {
  await ensureInit();
  await pool.query(`INSERT INTO review_photos (post_id, image_data, image_mime, kind) VALUES ($1, $2, $3, $4)`, [
    postId,
    data,
    mime,
    kind,
  ]);
}

export async function listReviewPhotoIds(): Promise<Record<number, { id: number; kind: ReviewPhotoKind }[]>> {
  await ensureInit();
  const res = await pool.query<{ id: number; post_id: number; kind: ReviewPhotoKind }>(
    `SELECT id, post_id, kind FROM review_photos ORDER BY id`
  );
  const byPost: Record<number, { id: number; kind: ReviewPhotoKind }[]> = {};
  for (const row of res.rows) (byPost[row.post_id] ??= []).push({ id: row.id, kind: row.kind });
  return byPost;
}

export async function getReviewPhoto(id: number): Promise<{ data: Buffer; mime: string } | undefined> {
  await ensureInit();
  const res = await pool.query<{ image_data: Buffer; image_mime: string }>(
    `SELECT image_data, image_mime FROM review_photos WHERE id = $1`,
    [id]
  );
  const row = res.rows[0];
  return row ? { data: row.image_data, mime: row.image_mime } : undefined;
}

// Returns the new row's id and a random cover token (lets the submitter view
// their own cover image), or null if this exact upload was already saved
// (a double-click or retry shouldn't create a second submission).
export async function insertVideoSubmission(submission: {
  submitter_name: string;
  submitter_email: string | null;
  submitter_instagram: string | null;
  caption: string;
  headline: string;
  video_public_id: string;
  video_url: string;
  duration_seconds: number | null;
  bytes: number;
}): Promise<{ id: number; coverToken: string } | null> {
  await ensureInit();
  const coverToken = randomBytes(16).toString("hex");
  const res = await pool.query<{ id: number }>(
    `INSERT INTO video_submissions
       (submitter_name, submitter_email, submitter_instagram, caption, headline, video_public_id, video_url, duration_seconds, bytes, cover_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (video_public_id) DO NOTHING
     RETURNING id`,
    [
      submission.submitter_name,
      submission.submitter_email,
      submission.submitter_instagram,
      submission.caption,
      submission.headline,
      submission.video_public_id,
      submission.video_url,
      submission.duration_seconds,
      submission.bytes,
      coverToken,
    ]
  );
  const id = res.rows[0]?.id;
  return id ? { id, coverToken } : null;
}

export interface VideoSubmission {
  id: number;
  submitter_name: string;
  submitter_email: string | null;
  submitter_instagram: string | null;
  caption: string;
  video_public_id: string;
  video_url: string;
  duration_seconds: number | null;
  bytes: string | null;
  status: "pending" | "posting" | "posted" | "declined" | "failed";
  headline: string | null;
  ig_caption: string | null;
  ig_media_id: string | null;
  error: string | null;
  posting_started_at: string | null;
  posted_at: string | null;
  cover_token: string | null;
  created_at: string;
}

export async function listVideoSubmissions(): Promise<VideoSubmission[]> {
  await ensureInit();
  const res = await pool.query<VideoSubmission>(
    `SELECT * FROM video_submissions ORDER BY created_at DESC LIMIT 200`
  );
  return res.rows;
}

export async function getVideoSubmission(id: number): Promise<VideoSubmission | undefined> {
  await ensureInit();
  const res = await pool.query<VideoSubmission>(`SELECT * FROM video_submissions WHERE id = $1`, [id]);
  return res.rows[0];
}

export async function countPendingVideoSubmissions(): Promise<number> {
  await ensureInit();
  const res = await pool.query<{ n: string }>(
    `SELECT count(*) AS n FROM video_submissions WHERE status IN ('pending', 'failed')`
  );
  return Number(res.rows[0].n);
}

// Atomically takes the clip for posting. Instagram posts can't be undone or
// deleted through the API, so a double-click (or two admins) must never be
// able to start two posts of the same clip: only one caller gets the row
// back. A clip stuck in "posting" for 15+ minutes (the server restarted
// mid-post) can be claimed again.
export async function claimVideoSubmissionForPosting(
  id: number,
  headline: string,
  igCaption: string
): Promise<VideoSubmission | null> {
  await ensureInit();
  const res = await pool.query<VideoSubmission>(
    `UPDATE video_submissions
     SET status = 'posting', headline = $2, ig_caption = $3, error = NULL, posting_started_at = now()
     WHERE id = $1
       AND (status IN ('pending', 'failed')
            OR (status = 'posting' AND posting_started_at < now() - interval '15 minutes'))
     RETURNING *`,
    [id, headline, igCaption]
  );
  return res.rows[0] ?? null;
}

export async function markVideoSubmissionPosted(id: number, igMediaId: string): Promise<void> {
  await ensureInit();
  await pool.query(
    `UPDATE video_submissions SET status = 'posted', ig_media_id = $2, posted_at = now(), error = NULL WHERE id = $1`,
    [id, igMediaId]
  );
}

export async function markVideoSubmissionFailed(id: number, error: string): Promise<void> {
  await ensureInit();
  await pool.query(`UPDATE video_submissions SET status = 'failed', error = $2 WHERE id = $1`, [
    id,
    error.slice(0, 1000),
  ]);
}

export async function markVideoSubmissionDeclined(id: number): Promise<void> {
  await ensureInit();
  await pool.query(`UPDATE video_submissions SET status = 'declined' WHERE id = $1 AND status IN ('pending', 'failed')`, [id]);
}

export async function markNominationEmailSent(id: number): Promise<void> {
  await ensureInit();
  await pool.query(`UPDATE nominations SET nominee_email_sent_at = now() WHERE id = $1`, [id]);
}

// Guards the invitation email, which goes to an address a stranger typed
// into a public form: never invite the same address twice within 30 days,
// and cap total invitations per hour so the form can't be used to blast mail
// out under the newsroom's address.
export async function canSendNomineeInvite(email: string): Promise<boolean> {
  await ensureInit();
  const res = await pool.query<{ same_address: string; last_hour: string }>(
    `SELECT
       count(*) FILTER (WHERE lower(nominee_email) = lower($1) AND nominee_email_sent_at > now() - interval '30 days') AS same_address,
       count(*) FILTER (WHERE nominee_email_sent_at > now() - interval '1 hour') AS last_hour
     FROM nominations`,
    [email]
  );
  const { same_address, last_hour } = res.rows[0];
  return Number(same_address) === 0 && Number(last_hour) < 20;
}

export async function getPostsByAuthor(author: string): Promise<Post[]> {
  await ensureInit();
  const res = await pool.query<Post>(
    `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, image_credit, category, status, author, created_at, is_featured, image_width, image_height, social_shared, scheduled_for, submitter_email, fb_post_id, focus_x, focus_y, ig_feed_shared, ig_media_id, is_golden_peach
     FROM posts WHERE author = $1 ORDER BY created_at DESC`,
    [author]
  );
  return res.rows;
}

export async function getPostById(id: number): Promise<Post | undefined> {
  await ensureInit();
  const res = await pool.query<Post>(
    `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, image_credit, category, status, author, created_at, is_featured, image_width, image_height, social_shared, scheduled_for, submitter_email, fb_post_id, focus_x, focus_y, ig_feed_shared, ig_media_id, is_golden_peach, preview_emailed_at, review_status, review_note, review_responded_at, revision_send_at
     FROM posts WHERE id = $1`,
    [id]
  );
  return res.rows[0];
}

// Sending the review link (again) puts the post back to "awaiting" and clears
// any earlier change request, since the submitter is being asked to look again.
export async function markPreviewEmailed(id: number): Promise<void> {
  await ensureInit();
  await pool.query(
    `UPDATE posts SET preview_emailed_at = now(), review_status = 'awaiting', review_note = NULL, review_responded_at = NULL
     WHERE id = $1`,
    [id]
  );
}

// The secret in the emailed review link. Created the first time the link is
// sent and reused after, so an earlier email's link keeps working.
export async function ensureReviewToken(id: number): Promise<string> {
  await ensureInit();
  const res = await pool.query<{ review_token: string }>(
    `UPDATE posts SET review_token = COALESCE(review_token, $2) WHERE id = $1 RETURNING review_token`,
    [id, randomBytes(24).toString("base64url")]
  );
  if (!res.rows[0]) throw new Error("Post not found");
  return res.rows[0].review_token;
}

export async function getPostByReviewToken(token: string): Promise<Post | undefined> {
  await ensureInit();
  const res = await pool.query<{ id: number }>(`SELECT id FROM posts WHERE review_token = $1`, [token]);
  const id = res.rows[0]?.id;
  return id === undefined ? undefined : getPostById(id);
}

export async function recordReviewResponse(
  id: number,
  status: "live" | "scheduled" | "changes_requested",
  note: string | null
): Promise<void> {
  await ensureInit();
  await pool.query(
    `UPDATE posts SET review_status = $2, review_note = $3, review_responded_at = now() WHERE id = $1`,
    [id, status, note]
  );
}

export const getPostBySlug = cache(
  async (slug: string): Promise<Post | undefined> => {
    await ensureInit();
    const res = await pool.query<Post>(
      `SELECT id, slug, title, body, sources, similarity_note, image_url, image_credit_name, image_credit_url, image_credit, category, status, author, created_at, is_featured, image_width, image_height, social_shared, scheduled_for, submitter_email, fb_post_id, focus_x, focus_y, ig_feed_shared, ig_media_id, is_golden_peach
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
