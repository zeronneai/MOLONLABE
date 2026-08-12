import { ImageResponse } from "next/og";
import { SHOP_ADDRESS, SHOP_SHORT_NAME } from "@/lib/brand";
import { archivoFonts } from "@/lib/og";

// Default social card. Per-route cards override this by exporting their
// own opengraph-image; the item detail one is generated from the row.
export const alt = "Molon Labe Firearms x SunCity Outdoors — El Paso, TX";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const fonts = await archivoFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          backgroundColor: "#0b0a0c",
          padding: 72,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 8,
            color: "#57b94a",
            textTransform: "uppercase",
          }}
        >
          {SHOP_SHORT_NAME}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 104,
            fontWeight: 800,
            letterSpacing: -3,
            lineHeight: 1,
            color: "#f2efe7",
          }}
        >
          IN THE CASE.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 26,
            color: "#8a8b8f",
          }}
        >
          {SHOP_ADDRESS.street}, {SHOP_ADDRESS.city}, {SHOP_ADDRESS.region}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 44,
            height: 4,
            width: 180,
            backgroundColor: "#57b94a",
          }}
        />
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) },
  );
}
