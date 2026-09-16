import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run check:bundle` sets this.
  //
  // A standalone build materialises exactly the traced file set into one
  // directory — the same list, assembled the same way, that a serverless
  // deployment unpacks into /var/task. Running the app out of that
  // directory is the only local test that can see a file the tracer
  // missed, because everything else runs against the repository, where
  // every file is present whether or not it was traced.
  //
  // It is off by default: it doubles build time and the deployment does
  // its own assembly.
  ...(process.env.NEXT_BUNDLE_CHECK ? { output: "standalone" as const } : {}),

  // The PDF renderer runs in Node and is left out of the bundle.
  //
  // It carries pdfkit and fontkit, which read files and reach for Node
  // built-ins at module scope. Bundled, that is a class of build failure
  // that only shows up in the deployed output; left external, it is
  // required at runtime exactly as it is on disk.
  serverExternalPackages: ["@react-pdf/renderer"],

  // Files nothing imports, and the build therefore cannot see.
  //
  // Everything here is reached by a path computed at runtime. File
  // tracing keeps what it can follow from an import; a `readFileSync` or
  // a `createRequire` of a path assembled at runtime is invisible to it,
  // so without this list the build succeeds, the bundle is short, and it
  // fails once deployed.
  //
  // Keyed on `**` rather than on the routes that render a guide, because
  // a list of routes goes stale silently — in the one way nobody notices,
  // where the guide still builds and comes out in the wrong typeface.
  // 530KB on every entry is the cheaper mistake.
  //
  // ARCHIVO. Read from `process.cwd()` at render time — lib/guides/fonts.ts
  // says why they are TTFs and not the site's WOFF2.
  //
  // PDFKIT'S STANDARD FONTS ARE NOT OPTIONAL, AND THIS IS WHY.
  //
  // `serverExternalPackages` above stops react-pdf being bundled. It does
  // NOT make the tracer find pdfkit's font files, and nothing will,
  // because pdfkit reaches them like this:
  //
  //   const require$1 = module.createRequire(pathToFileURL(__filename));
  //   registerStdFontLoaders({ Helvetica: () => require$1('#standard-fonts/Helvetica'), … });
  //
  // A require built at runtime, of a `#`-prefixed subpath resolved
  // through pdfkit's own package.json `imports` map. There is no import
  // statement to follow and no literal path to see. Verified against the
  // build's own trace: before this line, 0 of the 28 files in
  // standard-fonts were traced; after it, all 28.
  //
  // What that cost: on the first deployment the files were absent, and
  // merely IMPORTING @react-pdf/renderer threw four unhandled promise
  // rejections — it loads the standard fonts eagerly at module scope, so
  // no try/catch in our code can be anywhere near them. Locally Next
  // logs those and carries on; a serverless runtime does not have to.
  //
  // Both extensions, because the two resolve differently: the trace
  // picked pdfkit's .mjs entry and the runtime required the .cjs fonts.
  //
  // `npm run check:bundle` is what holds this honest. It assembles the
  // bundle and renders a page from inside it, with the repository out of
  // reach — the only local check that can see a file this list forgot.
  outputFileTracingIncludes: {
    "**": [
      "./lib/guides/fonts/*.ttf",
      // `**`, not `*`. Each font file requires a shared chunk from a
      // `chunks/` subdirectory beside it, and a one-level glob shipped
      // the fonts without it — which fails in exactly the same way, one
      // layer further in. Found by running the assembled bundle, not by
      // counting the traced files, which said the fonts were there.
      "./node_modules/pdfkit/js/standard-fonts/**",
      "./node_modules/pdfkit/js/pdfkit.js",
    ],
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
