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
    // Raising both of these to 500mb (after 50mb rejected a real upload)
    // didn't let bigger uploads through -- it crashed the entire server with
    // an out-of-memory kill instead (confirmed via Render's event log,
    // three times in a row: memoryLimit "512Mi"). This service has 512MB of
    // RAM total; sharp decodes a JPEG to a raw, uncompressed bitmap while
    // resizing it, which balloons well past the original file's size, and
    // several large photos in one request added up past what's physically
    // available. 50mb is the highest value that's actually been confirmed to
    // reject cleanly instead of taking the whole site down -- combined with
    // processing photos one at a time now (see src/app/writer/actions.ts)
    // rather than all at once, real multi-photo uploads should fit well
    // under this. Raising it further needs more RAM on the Render plan
    // first, not a bigger number here.
    proxyClientMaxBodySize: "50mb",
    serverActions: {
      bodySizeLimit: "50mb",
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
