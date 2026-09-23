import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    // Separate from serverActions.bodySizeLimit below -- this caps the body
    // size for any request that passes through middleware (proxy) BEFORE it
    // ever reaches the Server Action. /admin and /writer are gated by
    // middleware.ts for the login check, so every request there was silently
    // truncated at Next's 10MB default, producing "Unexpected end of form"
    // and a generic, unhelpful React error client-side. /submit has no
    // middleware, which is why the same upload worked fine there.
    //
    // This service has 512MB of RAM total for the whole process. Raising
    // this value has caused an out-of-memory kill of the entire server
    // THREE times now (confirmed via Render's event log: memoryLimit
    // "512Mi") -- at 500mb, at 100mb, and again at 100mb with six modest
    // 13.9-megapixel photos (91mb combined, each individually nowhere near
    // the 150-million-pixel decode cap in src/lib/image.ts). That last one
    // rules out per-photo decode size as the bottleneck: Next.js reads the
    // entire multipart request body into memory before any application code
    // (including the one-at-a-time photo processing in
    // src/app/writer/actions.ts) ever runs, so a 91mb upload means 91mb is
    // already resident before processing starts, on top of whatever
    // processing needs. That's a framework-level behavior, not something
    // fixable by changing how this app decodes images. 50mb is the only
    // value that has held up under repeated real-world testing. Going
    // higher needs more RAM on the Render plan -- raising this number
    // again without that will very likely crash the server again.
    // 75mb is a deliberate untested step between the proven-safe 50mb and
    // the confirmed-crashing 91-100mb -- being verified against a real
    // ~70mb upload before being trusted.
    proxyClientMaxBodySize: "75mb",
    serverActions: {
      bodySizeLimit: "75mb",
      // Next.js rejects a Server Action POST with a 403 if the browser's
      // Origin header doesn't exactly match the host it thinks it's running
      // on (CSRF protection) -- Render serves this app on multiple domains
      // (the custom domain, www, and the default onrender.com URL), so any
      // submitter landing on one of the non-default ones got a 403 on every
      // submit regardless of device. This is what "This page couldn't load"
      // on /submit actually was.
      allowedOrigins: ["thisizatl.com", "www.thisizatl.com", "thisizatl.onrender.com"],
    },
  },
};

export default nextConfig;
