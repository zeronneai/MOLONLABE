/* eslint-disable jsx-a11y/alt-text -- react-pdf's Image is not an <img>. */
import {
  Document,
  Image,
  Page,
  Text,
  View,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { GUIDE_COLORS as C, MARGIN, PAGE_SIZE, TYPE, pt } from "./theme";
import { guideFontFamily } from "./fonts";
import type { GuideImage } from "./images";
import { GUIDE_FIELDS } from "./fields";
import {
  SHOP_ADDRESS,
  SHOP_NAME,
  SHOP_PHONE_DISPLAY,
  SHOP_SHORT_NAME,
} from "@/lib/brand";
import { FIREARM_DISCLAIMER } from "@/lib/legal";

// The guide itself.
//
// This is the thing the customer is buying, so the three owner sections
// are the spine of it and the catalogue copy is the supporting material
// around them — not the other way round. The item's own name, brand,
// specifications, description and photographs come straight from the
// catalogue, which is why the owner is not asked to type any of it twice.
//
// WHAT IS DELIBERATELY NOT IN HERE
//
// Anything about the drawing, what a spot is, or what the purchase
// entitles anybody to. The wording for all of that is with the attorney
// and the terms are frozen until it comes back. A guide that described
// the arrangement in its own words would be a fourth version of it, free
// to contradict the other three. So this document is about the piece, and
// the receipt and the confirmation email say what was bought.

export type GuideData = {
  /** The game's own title. Printed once, quietly, on the cover. */
  gameTitle: string;
  item: {
    name: string;
    brand: string | null;
    category: string;
    shortDesc: string | null;
    longDesc: string | null;
    specs: [string, string][];
  };
  /** The three owner fields, already validated as present. */
  why: string;
  care: string;
  pairs: string;
  /** Decoded and format-checked. The first is the cover. */
  images: GuideImage[];
};

/** A paragraph break in a textarea is a blank line, and it should stay one. */
function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

export function GuideDocument(data: GuideData): ReactElement<DocumentProps> {
  // Mixed into every style rather than named in the scale, so that a
  // deployment without the font files produces a guide in Helvetica
  // instead of an exception. See lib/guides/fonts.ts.
  const family = guideFontFamily();
  const t = <K extends keyof typeof TYPE>(key: K) => ({
    ...TYPE[key],
    fontFamily: family,
  });

  const { item } = data;
  const [cover, ...rest] = data.images;
  const hasCatalogueCopy = Boolean(
    item.shortDesc || item.longDesc || item.specs.length > 0,
  );

  // One 11px label, one hairline, one heading — the section opener used
  // on every page of the site.
  const Section = ({
    label,
    heading,
    color = C.acid,
  }: {
    label: string;
    heading: string;
    color?: string;
  }) => (
    <View style={{ marginBottom: pt(18) }}>
      <View
        style={{ height: 1, backgroundColor: C.rule, marginBottom: pt(18) }}
      />
      <Text style={{ ...t("label"), color }}>{label}</Text>
      <Text style={{ ...t("heading"), color: C.bone, marginTop: pt(10) }}>
        {heading}
      </Text>
    </View>
  );

  const Body = ({ text }: { text: string }) => (
    <>
      {paragraphs(text).map((p, i) => (
        <Text
          key={i}
          style={{
            ...t("body"),
            color: C.bone,
            marginTop: i === 0 ? 0 : pt(12),
          }}
        >
          {p}
        </Text>
      ))}
    </>
  );

  /**
   * A photograph, sized to the column.
   *
   * `objectFit: "cover"` with a fixed height, because the catalogue's
   * shots are not a consistent aspect ratio and a page whose rhythm
   * changes with the photograph looks like an accident.
   */
  const Plate = ({
    image,
    height,
    fill = false,
  }: {
    image: GuideImage;
    height?: number;
    /** Cover only: take whatever is left of the page rather than a set
     *  height, so the photograph reaches the foot instead of leaving a
     *  third of the page empty under it. */
    fill?: boolean;
  }) => (
    <View
      style={{
        marginTop: pt(24),
        marginBottom: fill ? pt(24) : 0,
        flexGrow: fill ? 1 : 0,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.rule,
      }}
    >
      <Image
        src={image}
        style={fill ? { flexGrow: 1, objectFit: "cover" } : { height, objectFit: "cover" }}
      />
    </View>
  );

  return (
    <Document
      title={`${item.name}: a guide`}
      author={SHOP_NAME}
      subject={data.gameTitle}
      creator={SHOP_SHORT_NAME}
      producer={SHOP_SHORT_NAME}
    >
      {/* ------------------------------------------------------- cover */}
      <Page
        size={PAGE_SIZE}
        style={{
          backgroundColor: C.ink,
          paddingTop: MARGIN.top,
          paddingBottom: MARGIN.bottom,
          paddingHorizontal: MARGIN.side,
        }}
      >
        <Text style={{ ...t("label"), color: C.muted }}>{SHOP_NAME}</Text>

        <View style={{ marginTop: pt(64) }}>
          <Text style={{ ...t("label"), color: C.acid }}>A guide to</Text>
          <Text style={{ ...t("hero"), color: C.bone, marginTop: pt(14) }}>
            {item.name.toUpperCase()}
          </Text>
          {/* Set as a label rather than as body text. The category is a
              bare catalogue word — "pcc", "optic" — and at body size in
              lower case it reads as a typo rather than as a category. */}
          <Text style={{ ...t("label"), color: C.muted, marginTop: pt(18) }}>
            {[item.brand, item.category].filter(Boolean).join(" · ")}
          </Text>
        </View>

        {cover && <Plate image={cover} fill />}

        {/* Pushed to the foot whether or not there is a cover photo. */}
        <View style={{ marginTop: "auto" }}>
          <View style={{ height: 1, backgroundColor: C.rule }} />
          <Text style={{ ...t("label"), color: C.muted, marginTop: pt(14) }}>
            {data.gameTitle}
          </Text>
        </View>
      </Page>

      {/* ----------------------------------------------------- the rest */}
      <Page
        size={PAGE_SIZE}
        wrap
        style={{
          backgroundColor: C.ink,
          paddingTop: MARGIN.top,
          paddingBottom: MARGIN.bottom,
          paddingHorizontal: MARGIN.side,
        }}
      >
        {/* Fixed, so it repeats on every page this one flows onto. */}
        <Text
          fixed
          style={{
            ...t("label"),
            color: C.muted,
            position: "absolute",
            top: pt(24),
            left: MARGIN.side,
          }}
        >
          {item.name}
        </Text>
        {/* The page number, and a trap worth knowing about.
            A `render` prop makes this text dynamic, and react-pdf
            re-measures dynamic text from a forced height of zero. With an
            explicit `lineHeight` in the style it measures to nothing and
            the number silently does not appear — no error, no warning,
            just a missing page number. So the label style is used here
            without its line height. Verified by bisection: every other
            property in the scale is fine. */}
        <Text
          fixed
          render={({ pageNumber }) => String(pageNumber).padStart(2, "0")}
          style={{
            ...t("label"),
            lineHeight: undefined,
            color: C.muted,
            position: "absolute",
            bottom: pt(28),
            right: MARGIN.side,
          }}
        />

        {/* Only when there is something to say. An item with no
            description and no specifications would otherwise get a page
            with a heading on it and nothing underneath, which looks like
            a bug and reads like one. */}
        {hasCatalogueCopy && <Section label="The piece" heading="WHAT IT IS." />}
        {item.shortDesc && (
          <Text
            style={{
              ...t("body"),
              fontSize: pt(15),
              color: C.bone,
              marginBottom: pt(14),
            }}
          >
            {item.shortDesc}
          </Text>
        )}
        {item.longDesc && <Body text={item.longDesc} />}

        {item.specs.length > 0 && (
          <View style={{ marginTop: pt(24) }} wrap={false}>
            <Text style={{ ...t("label"), color: C.muted }}>
              Specifications
            </Text>
            <View style={{ marginTop: pt(10) }}>
              {item.specs.map(([key, value]) => (
                <View
                  key={key}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    borderBottomWidth: 1,
                    borderBottomColor: C.rule,
                    paddingVertical: pt(8),
                  }}
                >
                  <Text style={{ ...t("small"), color: C.muted }}>{key}</Text>
                  <Text style={{ ...t("small"), color: C.bone }}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {rest[0] && <Plate image={rest[0]} height={pt(260)} />}

        {/* The three.
            The first starts on a fresh page — they are the reason this
            document exists and should not begin four lines from the
            bottom of the catalogue copy. The other two flow. Giving each
            its own page was the first attempt and it was wrong: a shop
            owner who writes three honest sentences got three pages that
            were nine-tenths empty, which reads as padding rather than as
            space. Flowing, three sentences make one good page and three
            paragraphs make three. */}
        {GUIDE_FIELDS.map((field, i) => (
          <View
            key={field.key}
            // No break at all when there was no catalogue copy above —
            // that would leave page two holding the running header and
            // nothing else.
            break={i === 0 && hasCatalogueCopy}
            style={{ marginTop: i === 0 ? 0 : pt(40) }}
          >
            <Section
              label={`From the shop · ${i + 1} of ${GUIDE_FIELDS.length}`}
              heading={field.heading}
            />
            <Body
              text={
                field.key === "guide_why"
                  ? data.why
                  : field.key === "guide_care"
                    ? data.care
                    : data.pairs
              }
            />
            {rest[i + 1] && <Plate image={rest[i + 1]} height={pt(220)} />}
          </View>
        ))}

        {/* ----------------------------------------------- the colophon */}
        {/* Flows rather than breaking, for the same reason the sections
            do: a closing page containing an address and a disclaimer is
            a page of nothing when the guide is short. It lands on its
            own page by itself once the sections are long enough to fill
            the one before it. */}
        <View style={{ marginTop: pt(56) }} wrap={false}>
          <Section label="The shop" heading="COME AND SEE IT." color={C.amber} />
          <Text style={{ ...t("body"), color: C.bone }}>
            {SHOP_ADDRESS.street}
            {"\n"}
            {SHOP_ADDRESS.city}, {SHOP_ADDRESS.region} {SHOP_ADDRESS.postalCode}
          </Text>
          <Text style={{ ...t("body"), color: C.acid, marginTop: pt(10) }}>
            {SHOP_PHONE_DISPLAY}
          </Text>

          <View
            style={{ height: 1, backgroundColor: C.rule, marginTop: pt(36) }}
          />
          {/* Verbatim. The wording is the attorney's and is not this
              file's to reflow, shorten or paraphrase. */}
          <Text style={{ ...t("fine"), color: C.muted, marginTop: pt(18) }}>
            {FIREARM_DISCLAIMER}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
