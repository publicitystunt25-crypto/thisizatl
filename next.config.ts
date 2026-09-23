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
    // this value previously caused an out-of-memory kill of the entire
    // server twice (confirmed via Render's event log: memoryLimit "512Mi")
    // -- but the actual cause turned out to be a single photo's DECODED
    // PIXEL dimensions, not the request's total byte size (src/lib/image.ts
    // now caps that at 150 million pixels, with sharp streaming the decode
    // instead of buffering it). With that root cause fixed and confirmed
    // working under real use at 50mb, 100mb is a step back up -- verify
    // against a real large multi-photo upload before going any higher than
    // this.
    proxyClientMaxBodySize: "100mb",
    serverActions: {
      bodySizeLimit: "100mb",
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
