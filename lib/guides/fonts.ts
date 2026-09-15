import { existsSync } from "node:fs";
import { join } from "node:path";
import { Font } from "@react-pdf/renderer";

// Archivo, for the PDF.
//
// WHY THE FILES ARE IN THE REPOSITORY
//
// The site gets Archivo through `next/font/google`, which downloads it at
// build time and emits WOFF2. `@react-pdf/renderer` parses fonts with
// fontkit, and fontkit does not read WOFF2 — so the site's copies are
// useless here and there are three TTFs checked in beside this file
// instead. They are the exact files Google Fonts serves for weights 400,
// 600 and 800, under the SIL Open Font License; OFL.txt sits with them,
// which is what the licence asks for when the font is redistributed.
//
// Fetching them at render time was the alternative and it is worse: it
// puts a network call on the critical path of something a customer has
// already paid for, and it fails at exactly the moment nobody is looking.
//
// THE FALLBACK
//
// If the files cannot be read — a deployment that trims them out of the
// bundle is the realistic way — the guide is still produced, in the PDF
// standard Helvetica. That is the wrong typeface and it is a great deal
// better than a paid-for download that 500s. It says so on the console,
// loudly, because a guide that quietly comes out in the wrong face could
// go unnoticed for months.

const FAMILY = "Archivo";
const FALLBACK = "Helvetica";

const DIR = join(process.cwd(), "lib", "guides", "fonts");
const FILES = [
  { file: "Archivo-Regular.ttf", fontWeight: 400 as const },
  { file: "Archivo-SemiBold.ttf", fontWeight: 600 as const },
  { file: "Archivo-ExtraBold.ttf", fontWeight: 800 as const },
];

/** Registration is global to the renderer and must happen exactly once. */
let resolved: string | null = null;

/**
 * Registers Archivo and returns the family the document should ask for.
 *
 * Returns "Helvetica" when the files are missing, which every style in
 * the guide then uses — see the note above.
 */
export function guideFontFamily(): string {
  if (resolved) return resolved;

  const missing = FILES.filter((f) => !existsSync(join(DIR, f.file)));
  if (missing.length > 0) {
    console.error(
      `GUIDE FONTS MISSING — ${missing
        .map((m) => m.file)
        .join(", ")} not found in ${DIR}. Guides will render in ${FALLBACK}.`,
    );
    resolved = FALLBACK;
    return resolved;
  }

  try {
    Font.register({
      family: FAMILY,
      fonts: FILES.map(({ file, fontWeight }) => ({
        // An absolute path. `src` must be a string — react-pdf tests it
        // for a data: prefix and then for a URL before falling through
        // to fontkit.open, and a Buffer fails that first test with
        // "dataUrl.substring is not a function". The existsSync sweep
        // above is what turns a missing file into the fallback rather
        // than into that message.
        src: join(DIR, file),
        fontWeight,
      })),
    });
    // The site sets hyphenation off — Archivo's display setting depends
    // on words staying whole, and a hyphenated headline is not the
    // typeface's fault. react-pdf hyphenates by default.
    Font.registerHyphenationCallback((word) => [word]);
    resolved = FAMILY;
  } catch (error) {
    console.error(
      `GUIDE FONTS FAILED TO REGISTER — falling back to ${FALLBACK}:`,
      error,
    );
    resolved = FALLBACK;
  }
  return resolved;
}
