import { ImageResponse } from "next/og";
import { getItemBySlug, itemImages } from "@/lib/db/items";
import { SHOP_SHORT_NAME } from "@/lib/brand";
import { archivoFonts } from "@/lib/og";

// A card per item, built from the row: the photo behind, the name and
// status in front. Falls back to the plain card if the item or its image
// is missing, so a share link never renders a broken image.
export const alt = "Item at Molon Labe Firearms x SunCity Outdoors";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STATUS_COLOR: Record<string, string> = {
  available: "#57b94a",
  reserved: "#c08a2e",
  sold: "#c6472f",
};

export default async function ItemOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [item, fonts] = await Promise.all([getItemBySlug(slug), archivoFonts()]);
  const image = item ? itemImages(item)[0] : undefined;
  const name = item?.name ?? SHOP_SHORT_NAME;
  const status = item?.status ?? "available";

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
          position: "relative",
          padding: 72,
        }}
      >
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(11,10,12,0.35) 0%, rgba(11,10,12,0.95) 100%)",
          }}
        />
        <div style={{ display: "flex", position: "relative", fontSize: 20, letterSpacing: 8, color: "#8a8b8f", textTransform: "uppercase" }}>
          {SHOP_SHORT_NAME}
        </div>
        <div
          style={{
            display: "flex",
            position: "relative",
            marginTop: 20,
            fontSize: name.length > 28 ? 68 : 88,
            fontWeight: 800,
            letterSpacing: -2,
            lineHeight: 1.02,
            color: "#f2efe7",
          }}
        >
          {name.toUpperCase()}
        </div>
        <div
          style={{
            display: "flex",
            position: "relative",
            marginTop: 28,
            alignItems: "center",
            alignSelf: "flex-start",
            fontSize: 22,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: STATUS_COLOR[status] ?? "#8a8b8f",
            border: `2px solid ${STATUS_COLOR[status] ?? "#8a8b8f"}`,
            borderRadius: 999,
            padding: "10px 26px",
          }}
        >
          {status}
        </div>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) },
  );
}
