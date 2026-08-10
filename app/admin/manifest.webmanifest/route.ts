import { LOGO_URL } from "@/lib/brand";

// Scoped manifest so the owner can install /admin to a phone home screen
// and it opens standalone — docs/admin-decisions.md.
const icon = (size: number) =>
  LOGO_URL.replace("/upload/", `/upload/c_fit,w_${size},h_${size},f_png/`);

export function GET() {
  return Response.json(
    {
      name: "MLF Admin",
      short_name: "MLF Admin",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      background_color: "#0B0A0C",
      theme_color: "#0B0A0C",
      icons: [
        { src: icon(192), sizes: "192x192", type: "image/png" },
        { src: icon(512), sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "content-type": "application/manifest+json" } },
  );
}
