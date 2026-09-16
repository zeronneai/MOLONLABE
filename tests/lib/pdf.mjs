// Reading the text back out of a PDF, with no external tool.
// TEST FIXTURE — not shipped code.
//
// WHY THIS EXISTS
//
// The guide is the one thing on this site whose content cannot be read by
// looking at the DOM. `pdftotext` would do the job in one line and would
// make the suite depend on poppler being installed, which is the kind of
// dependency that turns into "that suite doesn't run on my machine" and
// then into a suite nobody runs.
//
// WHY IT IS NOT TRIVIAL
//
// The obvious approach — inflate the content stream and pull the strings
// out of it — returns nonsense. The fonts are SUBSET and embedded, so the
// text is written as glyph ids in the subset:
//
//   /F2 8.25 Tf
//   [<0001> -280 <0002> -280 <0003> ...] TJ
//
// `<0001>` is not "M". It is whatever the first glyph of that particular
// subset happens to be, and it means something different in each of the
// three weights. The translation lives in each font's /ToUnicode CMap, so
// the decoder has to know which font was selected when each string was
// drawn. That is what the `Tf` tracking below is for.
//
// Verified against `pdftotext` on a real guide: same words, same order.

import zlib from "node:zlib";

/** Every indirect object in the file, by number. */
function parseObjects(buffer) {
  const latin = buffer.toString("latin1");
  const headers = [...latin.matchAll(/(\d+)\s+0\s+obj\b/g)];
  const objects = new Map();

  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index + headers[i][0].length;
    const end = i + 1 < headers.length ? headers[i + 1].index : latin.length;
    const body = latin.slice(start, end);

    const streamAt = body.indexOf("stream");
    if (streamAt === -1) {
      objects.set(Number(headers[i][1]), { dict: body, data: null });
      continue;
    }
    // Past the keyword and its EOL, to the last endstream in the body:
    // stream data is binary and can contain the word itself.
    const from = start + streamAt + (body.startsWith("stream\r\n", streamAt) ? 8 : 7);
    const to = start + body.lastIndexOf("endstream");
    let data = buffer.subarray(from, to);
    if (/\/FlateDecode/.test(body.slice(0, streamAt))) {
      try {
        data = zlib.inflateSync(data);
      } catch {
        data = Buffer.alloc(0);
      }
    }
    objects.set(Number(headers[i][1]), { dict: body.slice(0, streamAt), data });
  }
  return objects;
}

/**
 * Glyph code → text, out of a /ToUnicode CMap.
 *
 * THREE FORMS, and the third is the one that matters here. A bfrange may
 * end in a single destination, meaning "count up from this", or in an
 * ARRAY, meaning "these, in order". pdfkit writes the array form:
 *
 *   <0000> <001d> [<0000> <004d> <004f> <004c> ...]
 *
 * Read as the counting form — which is what a three-angle-bracket regex
 * does — that says code 1 is U+0001, code 2 is U+0002, and every heading
 * in the document comes out as a substitution cipher. It looks like text,
 * which is why it is worth spelling out here.
 */
function parseCMap(text) {
  const map = new Map();

  for (const block of text.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
    for (const [, from, to] of block.matchAll(/<([0-9a-fA-F\s]+)>\s*<([0-9a-fA-F\s]+)>/g)) {
      map.set(parseInt(from, 16), fromUtf16(to));
    }
  }

  for (const block of text.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
    const entry =
      /<([0-9a-fA-F\s]+)>\s*<([0-9a-fA-F\s]+)>\s*(\[([^\]]*)\]|<([0-9a-fA-F\s]+)>)/g;
    for (const [, lo, hi, , array, single] of block.matchAll(entry)) {
      const start = parseInt(lo, 16);
      const end = parseInt(hi, 16);
      if (array !== undefined) {
        const destinations = [...array.matchAll(/<([0-9a-fA-F\s]+)>/g)].map((m) =>
          fromUtf16(m[1]),
        );
        for (let c = start; c <= end && c - start < destinations.length; c++) {
          map.set(c, destinations[c - start]);
        }
        continue;
      }
      const base = parseInt(single, 16);
      for (let c = start; c <= end; c++) {
        map.set(c, String.fromCodePoint(base + (c - start)));
      }
    }
  }
  return map;
}

/**
 * A CMap destination is UTF-16BE and may be several code units — a
 * ligature maps one glyph to two characters, written `<0066 006c>`.
 */
function fromUtf16(hex) {
  const clean = hex.replace(/\s+/g, "");
  let out = "";
  for (let i = 0; i + 4 <= clean.length; i += 4) {
    out += String.fromCharCode(parseInt(clean.slice(i, i + 4), 16));
  }
  return out;
}

/** The /Fn → unicode map for one page, following the font references. */
function fontsForPage(objects, pageDict) {
  const fonts = new Map();
  // /Resources may be inline or a reference; /Font likewise.
  let resources = pageDict;
  const resourceRef = pageDict.match(/\/Resources\s+(\d+)\s+0\s+R/);
  if (resourceRef) resources = objects.get(Number(resourceRef[1]))?.dict ?? "";

  let fontBlock = resources.match(/\/Font\s*<<([\s\S]*?)>>/)?.[1];
  const fontRef = resources.match(/\/Font\s+(\d+)\s+0\s+R/);
  if (!fontBlock && fontRef) {
    fontBlock = objects.get(Number(fontRef[1]))?.dict ?? "";
  }
  if (!fontBlock) return fonts;

  for (const [, name, id] of fontBlock.matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g)) {
    const font = objects.get(Number(id));
    if (!font) continue;
    // A composite font puts the real work in a descendant, but ToUnicode
    // stays on the parent, which is all this needs.
    const toUnicode = font.dict.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
    if (!toUnicode) continue;
    const cmap = objects.get(Number(toUnicode[1]));
    if (!cmap?.data) continue;
    fonts.set(name, parseCMap(cmap.data.toString("latin1")));
  }
  return fonts;
}

/** Decodes one content stream using the page's fonts. */
function textFromContent(content, fonts) {
  const out = [];
  let current = null;

  // Tf selects a font; Tj and TJ draw. BT starts a new text object, which
  // is as good a line break as this needs — react-pdf emits one per run.
  const tokens = content.matchAll(
    /\/(F\d+)[^\n]*?\bTf|<([0-9a-fA-F]*)>\s*Tj|\[([^\]]*)\]\s*TJ|\bBT\b/g,
  );
  for (const token of tokens) {
    if (token[1]) {
      current = fonts.get(token[1]) ?? null;
      continue;
    }
    if (token[0] === "BT") {
      out.push("\n");
      continue;
    }
    const hexes = token[2] !== undefined
      ? [token[2]]
      : [...token[3].matchAll(/<([0-9a-fA-F]*)>/g)].map((m) => m[1]);
    for (const hex of hexes) {
      for (let i = 0; i + 1 < hex.length; i += 4) {
        const code = parseInt(hex.slice(i, i + 4), 16);
        out.push(current?.get(code) ?? "");
      }
    }
  }
  return out.join("");
}

/**
 * Every word in the document, page by page.
 *
 * Returns an array of strings, one per page, in order.
 */
export function pdfPages(buffer) {
  const objects = parseObjects(buffer);
  const pages = [];

  for (const [, object] of objects) {
    if (!/\/Type\s*\/Page\b/.test(object.dict)) continue;
    const fonts = fontsForPage(objects, object.dict);

    const contents = [
      ...object.dict.matchAll(/\/Contents\s+(?:(\d+)\s+0\s+R|\[([^\]]*)\])/g),
    ].flatMap((m) =>
      m[1] ? [Number(m[1])] : [...m[2].matchAll(/(\d+)\s+0\s+R/g)].map((r) => Number(r[1])),
    );

    let text = "";
    for (const id of contents) {
      const stream = objects.get(id)?.data;
      if (stream) text += textFromContent(stream.toString("latin1"), fonts);
    }
    pages.push(text);
  }
  return pages;
}

/** The whole document as one string. */
export function pdfText(buffer) {
  return pdfPages(buffer).join("\n");
}

/**
 * The same, with every run of whitespace collapsed to one space.
 *
 * Use this for anything longer than a word. A PDF has no idea what a line
 * is — react-pdf emits a separate text object per styled run and per laid
 * out line, and this decoder puts a newline between them, so a
 * specification value like "5.56 NATO" can legitimately come back split
 * across two of them. Asserting on the raw text finds that out the hard
 * way.
 */
export function pdfFlatText(buffer) {
  return pdfText(buffer).replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------
// Images, and where they were actually drawn
// ---------------------------------------------------------------------
// "There is a JPEG in the file" is not the same claim as "the customer
// can see a photograph", and the difference is where this whole feature
// keeps failing. An image embedded at zero size, drawn off the page, or
// painted under the background rectangle all produce a document that
// contains the bytes and shows nothing.
//
// A PDF draws an image by mapping the UNIT SQUARE through the current
// transformation matrix and then saying `/Im0 Do`. So the drawn size is
// not a property of the image at all — it is a property of the matrix in
// force at that moment. That is what this reads.

/** Multiply two PDF matrices, given as [a b c d e f]. */
const mul = (m, n) => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];

/** Where the unit square lands, as a bounding box in page coordinates. */
function placedBox(ctm) {
  const corner = (x, y) => [
    ctm[0] * x + ctm[2] * y + ctm[4],
    ctm[1] * x + ctm[3] * y + ctm[5],
  ];
  const points = [corner(0, 0), corner(1, 0), corner(0, 1), corner(1, 1)];
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

/** The image XObjects a page's resources name, with their pixel sizes. */
function imageXObjects(objects, pageDict) {
  const found = new Map();
  let resources = pageDict;
  const resourceRef = pageDict.match(/\/Resources\s+(\d+)\s+0\s+R/);
  if (resourceRef) resources = objects.get(Number(resourceRef[1]))?.dict ?? "";

  let block = resources.match(/\/XObject\s*<<([\s\S]*?)>>/)?.[1];
  const ref = resources.match(/\/XObject\s+(\d+)\s+0\s+R/);
  if (!block && ref) block = objects.get(Number(ref[1]))?.dict ?? "";
  if (!block) return found;

  for (const [, name, id] of block.matchAll(/\/(\w+)\s+(\d+)\s+0\s+R/g)) {
    const object = objects.get(Number(id));
    if (!object || !/\/Subtype\s*\/Image/.test(object.dict)) continue;
    found.set(name, {
      pixelWidth: Number(object.dict.match(/\/Width\s+(\d+)/)?.[1] ?? 0),
      pixelHeight: Number(object.dict.match(/\/Height\s+(\d+)/)?.[1] ?? 0),
      // DCTDecode is JPEG. Anything else here is a format react-pdf
      // could not have been given by our own conversion step.
      jpeg: /\/DCTDecode/.test(object.dict),
    });
  }
  return found;
}

/**
 * Every image actually painted, page by page, with its drawn rectangle.
 *
 * Each entry: `{ page, name, x, y, width, height, pixelWidth,
 * pixelHeight, jpeg, insidePage }`. Sizes are in points — 72 to the
 * inch, so a photograph across a Letter page is around 500.
 */
export function pdfImages(buffer) {
  const objects = parseObjects(buffer);
  const out = [];
  let pageNumber = 0;

  for (const [, object] of objects) {
    if (!/\/Type\s*\/Page\b/.test(object.dict)) continue;
    pageNumber++;

    const media = object.dict.match(
      /\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/,
    );
    const box = media
      ? { x0: +media[1], y0: +media[2], x1: +media[3], y1: +media[4] }
      : { x0: 0, y0: 0, x1: 612, y1: 792 };

    const images = imageXObjects(objects, object.dict);
    if (images.size === 0) continue;

    const contents = [
      ...object.dict.matchAll(/\/Contents\s+(?:(\d+)\s+0\s+R|\[([^\]]*)\])/g),
    ].flatMap((m) =>
      m[1] ? [Number(m[1])] : [...m[2].matchAll(/(\d+)\s+0\s+R/g)].map((r) => Number(r[1])),
    );

    for (const id of contents) {
      const stream = objects.get(id)?.data;
      if (!stream) continue;
      const content = stream.toString("latin1");

      let ctm = [1, 0, 0, 1, 0, 0];
      const stack = [];
      const token =
        /(?:^|\s)q(?=\s)|(?:^|\s)Q(?=\s)|([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+cm(?=\s)|\/(\w+)\s+Do(?=\s|$)/g;

      for (const m of content.matchAll(token)) {
        const text = m[0].trim();
        if (text === "q") {
          stack.push([...ctm]);
        } else if (text === "Q") {
          ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
        } else if (m[1] !== undefined) {
          ctm = mul([+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]], ctm);
        } else if (m[7] !== undefined && images.has(m[7])) {
          const rect = placedBox(ctm);
          out.push({
            page: pageNumber,
            name: m[7],
            ...rect,
            ...images.get(m[7]),
            insidePage:
              rect.width > 0 &&
              rect.height > 0 &&
              rect.x + rect.width > box.x0 &&
              rect.y + rect.height > box.y0 &&
              rect.x < box.x1 &&
              rect.y < box.y1,
          });
        }
      }
    }
  }
  return out;
}

/** How many pages, without decoding any of them. */
export function pdfPageCount(buffer) {
  return (buffer.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length;
}

export const isPdf = (buffer) =>
  Buffer.isBuffer(buffer) && buffer.subarray(0, 5).toString() === "%PDF-";
