import { redirect } from "next/navigation";
import { getHomeDrop } from "@/lib/games/queries";
import { dropPath } from "@/lib/games/paths";

// The old "current drop" address. It is kept only so links already out
// in the world (an Instagram bio, an old email) still land somewhere.
//
// It used to render whichever drop was newest, which with two drops open
// sent people who clicked one drop to the other. Now it only forwards:
// to the drop the owner features on the home page, or to the one running
// drop when there is only one, and otherwise to the list of drops, where
// every drop is shown by name. Nothing on the site links here any more.
export const dynamic = "force-dynamic";

export default async function Featured() {
  const { featured } = await getHomeDrop();
  redirect(featured ? dropPath(featured.id) : "/games");
}
