import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import EditorialIndex, { type IndexItem } from "@/components/inventory/EditorialIndex";

// Hardcoded for step 3; step 4 pulls the newest items from the DB.
const items: IndexItem[] = [
  {
    slug: "nighthawk-custom-revolver",
    name: "Nighthawk Custom Revolver",
    category: "Revolver",
    status: "available",
    image:
      "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786043151/Revolver_on_black_velvet_2K_202608061301_boa0qr.jpg",
  },
  {
    slug: "competition-pistol-red-dot",
    name: "Competition Pistol",
    category: "Pistol",
    status: "available",
    image:
      "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786043151/Pistol_with_red_dot_optic_202608061301_ggybgq.jpg",
  },
  {
    slug: "taran-tactical-glock",
    name: "Taran Tactical Glock",
    category: "Pistol",
    status: "reserved",
    image:
      "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786043151/Pistol_on_black_granite_2K_202608061302_zzzmjb.jpg",
  },
  {
    slug: "sig-mpx-carbon",
    name: "SIG MPX, Carbon",
    category: "PCC",
    status: "available",
    image:
      "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786043151/Firearm_on_textured_surface_2K_202608061302_ln1qnw.jpg",
  },
  {
    slug: "savior-equinox-9",
    name: "Savior Equinox 9MM",
    category: "Pistol",
    status: "available",
    image:
      "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786043151/Pistol_on_black_granite_2K_202608061302_zzzmjb.jpg",
  },
  {
    slug: "retrorifle-xm-clone",
    name: "RetroRifle XM Clone",
    category: "Rifle",
    status: "sold",
    image:
      "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786043151/Firearm_on_textured_surface_2K_202608061302_ln1qnw.jpg",
  },
];

export default function FreshArrivals() {
  return (
    <section className="px-page py-24">
      <Reveal>
        <p className="label text-acid">Fresh Arrivals</p>
        <h2 className="display mt-6 max-w-3xl text-[clamp(2rem,4vw,3.5rem)]">
          NEWEST IN THE CASE
        </h2>
      </Reveal>
      <Reveal delay={60} className="mt-12">
        <EditorialIndex items={items} />
      </Reveal>
      <div className="mt-10">
        <Link href="/inventory" className="cta-secondary">
          View all inventory →
        </Link>
      </div>
    </section>
  );
}
