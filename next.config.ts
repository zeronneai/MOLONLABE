import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The PDF renderer runs in Node and is left out of the bundle.
  //
  // It carries pdfkit and fontkit, which read files and reach for Node
  // built-ins at module scope. Bundled, that is a class of build failure
  // that only shows up in the deployed output; left external, it is
  // required at runtime exactly as it is on disk.
  serverExternalPackages: ["@react-pdf/renderer"],

  // Archivo, for the guide.
  //
  // The three TTFs are read from disk at render time (lib/guides/fonts.ts
  // says why they are TTFs and not the site's WOFF2). File tracing only
  // keeps what it can see being imported, and a `readFileSync` of a path
  // built at runtime is invisible to it — so a standalone or serverless
  // build would ship without them and every guide would come out in
  // Helvetica. Named here so they travel with the output.
  // Three routes render a guide today — the buyer's link, the owner's
  // preview, and the checkout action that warms it on first purchase —
  // and listing them would be a list that goes stale silently, in the
  // one way nobody notices: the guide still builds, in the wrong face.
  // 340KB on every entry is the cheaper mistake.
  outputFileTracingIncludes: {
    "**": ["./lib/guides/fonts/*.ttf"],
  },

  images: {
    // Both origins render: legacy Cloudinary catalog shots and new
    // Supabase Storage uploads. next/image optimizes either.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/dsprn0ew4/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
