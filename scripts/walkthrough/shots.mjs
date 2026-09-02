// The walkthrough's shot list and its captions.
//
// Shared by capture.mjs (which shoots them) and build.mjs (which lays
// them out), so the document can never drift from what was captured.
//
// Captions are written for the shop owner, not for us. No component
// names, no routes, no jargon. If a sentence needs a developer to parse
// it, it is the wrong sentence.

export const SHOTS = [
  {
    n: "01",
    label: "First contact",
    title: "The intro game",
    caption:
      "Everyone who lands on the site plays a few seconds of this before they see anything else. Clear enough targets and it hands out a discount code — that code has nothing to do with the giveaway, which is always free to enter.",
    frames: [{ id: "game", kind: "wide" }],
  },
  {
    n: "02",
    label: "Compliance",
    title: "The age check",
    caption:
      "Straight after the game, before anyone can browse. It is the age confirmation customers expect in this category, and it remembers the answer so nobody is asked twice.",
    frames: [{ id: "agegate", kind: "wide" }],
  },
  {
    n: "03",
    label: "Home",
    title: "The hero, as it pulls back",
    caption:
      "The top of the home page. As the customer scrolls, the shot pulls back to reveal the whole scene. It is built from still frames rather than a video, so it starts moving instantly instead of buffering.",
    frames: [
      { id: "hero-1", kind: "third" },
      { id: "hero-2", kind: "third" },
      { id: "hero-3", kind: "third" },
    ],
  },
  {
    n: "04",
    label: "The case",
    title: "Browsing the inventory",
    caption:
      "Everything on hand, in one list. Running a finger or a cursor down the rows brings each gun up on the right, so a customer can take in the whole case without clicking into anything.",
    frames: [{ id: "inventory", kind: "wide" }],
  },
  {
    n: "05",
    label: "One gun",
    title: "An item page",
    caption:
      "The photos stay in place on the left while the description and specifications scroll past on the right, so the customer never loses sight of what they are reading about.",
    frames: [
      { id: "item-top", kind: "half" },
      { id: "item-scrolled", kind: "half" },
    ],
  },
  {
    n: "06",
    label: "The giveaway",
    title: "Featured, and how to enter",
    caption:
      "The gun currently up for grabs, with the entry form underneath. Anyone can enter without spending anything — that free route is what keeps the promotion lawful, so it is stated plainly rather than buried.",
    frames: [
      { id: "featured-top", kind: "half" },
      { id: "featured-entry", kind: "half" },
    ],
  },
  {
    n: "07",
    label: "Back office",
    title: "Running the shop from your phone",
    caption:
      "The side only you see, shot at phone size because that is where it will be used. Listing a gun, adding photos straight from the camera roll, and switching the game's discount on or off — all of it one-handed, standing at the counter.",
    frames: [
      { id: "admin-inventory", kind: "phone", note: "The list" },
      { id: "admin-upload", kind: "phone", note: "Adding photos" },
      { id: "admin-game", kind: "phone", note: "Game and offer" },
    ],
  },
  {
    n: "08",
    label: "The draw",
    title: "Picking a winner on camera",
    caption:
      "Practice mode, so you can rehearse before going live. Names fill the screen weighted by how many entries each person holds, they slow to a stop, and one locks in. The winner is decided before the animation starts, and the line along the bottom lets anyone check the result afterwards.",
    frames: [
      { id: "draw-pool", kind: "vertical", note: "The pool" },
      { id: "draw-spin", kind: "vertical", note: "The spin" },
      { id: "draw-lock", kind: "vertical", note: "The winner" },
    ],
  },
];

/** Every frame id, flattened — used to check what a capture produced. */
export const FRAME_IDS = SHOTS.flatMap((s) => s.frames.map((f) => f.id));

export const VIEWPORTS = {
  wide: { width: 1440, height: 900 },
  third: { width: 1440, height: 900 },
  half: { width: 1440, height: 1000 },
  // Shot at real phone width, because a desktop capture of the admin
  // would show a layout the owner will never actually see.
  phone: { width: 390, height: 844 },
  vertical: { width: 450, height: 800 },
};
