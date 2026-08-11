import { getSessionSupabase } from "@/lib/supabase/session";
import { getGameStats } from "@/lib/db/gameStats";
import { DEFAULT_EXCLUSION_NOTE } from "@/lib/admin/constants";
import { DESKTOP_TUNING, MOBILE_TUNING } from "@/lib/game/config";
import {
  DifficultyForm,
  OfferForm,
  OfferSwitch,
  type OfferValue,
} from "@/components/admin/GameOfferControls";

export const dynamic = "force-dynamic";

type Raw = Record<string, unknown>;

function asObject(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};
}

function readOffer(value: unknown): OfferValue {
  const raw = asObject(value);
  return {
    enabled: raw.enabled === true,
    code: typeof raw.code === "string" ? raw.code : "",
    value: typeof raw.value === "string" ? raw.value : "",
    expires: typeof raw.expires === "string" && raw.expires ? raw.expires : null,
    note: typeof raw.note === "string" && raw.note ? raw.note : DEFAULT_EXCLUSION_NOTE,
  };
}

function readDifficulty(
  value: unknown,
  mode: "desktop" | "mobile",
): { roundMs: number; targetCount: number; popMs: number; magSize: number } {
  const base = mode === "desktop" ? DESKTOP_TUNING : MOBILE_TUNING;
  const raw = asObject(asObject(value)[mode]);
  const num = (key: string, fallback: number) =>
    Number.isFinite(Number(raw[key])) ? Number(raw[key]) : fallback;
  return {
    roundMs: num("roundMs", base.roundMs),
    targetCount: num("targetCount", base.targetCount),
    popMs: num("popMs", Math.round((base.popMinMs + base.popMaxMs) / 2)),
    magSize: num("magSize", base.magSize),
  };
}

const pct = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate * 100)}%`);

export default async function AdminGamePage() {
  const sb = await getSessionSupabase();
  if (!sb) return null;

  const [{ data: rows }, stats] = await Promise.all([
    sb.from("settings").select("key, value").in("key", ["game_offer", "game_difficulty"]),
    getGameStats(sb),
  ]);
  const byKey = new Map((rows ?? []).map((row) => [row.key, row.value]));
  const offer = readOffer(byKey.get("game_offer"));
  const difficultyRaw = byKey.get("game_difficulty");

  const statRows = [
    ["Games played", stats.last7.played, stats.allTime.played],
    ["Games won", stats.last7.won, stats.allTime.won],
    ["Win rate", pct(stats.last7.winRate), pct(stats.allTime.winRate)],
    ["Code copied", stats.last7.copied, stats.allTime.copied],
  ] as const;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-2xl">GAME &amp; OFFER</h1>

      {/* The reward — kill switch first, always at the top */}
      <section className="mt-6">
        <OfferSwitch enabled={offer.enabled} />
        {!offer.enabled && (
          <p className="mt-3 text-[11px] text-muted">
            While off, the code is unreadable by the public site — winners see
            a plain &quot;cleared&quot; screen with no reward.
          </p>
        )}
        <OfferForm offer={offer} />
      </section>

      {/* Difficulty */}
      <section className="mt-14">
        <h2 className="label text-acid">Difficulty</h2>
        <p className="mt-2 max-w-[52ch] text-[11px] text-muted">
          Watch the win rate next to each mode after a change instead of
          guessing. Roughly 30% is the sweet spot.
        </p>
        <div className="mt-6 space-y-10">
          <DifficultyForm
            mode="desktop"
            values={readDifficulty(difficultyRaw, "desktop")}
            winRate={stats.byMode7.desktop}
          />
          <DifficultyForm
            mode="mobile"
            values={readDifficulty(difficultyRaw, "mobile")}
            winRate={stats.byMode7.mobile}
          />
        </div>
      </section>

      {/* What happened */}
      <section className="mt-14 pb-10">
        <h2 className="label text-acid">What happened</h2>
        <div className="mt-4 border-t hairline">
          <div className="grid grid-cols-[1fr_90px_90px] gap-2 border-b hairline py-3">
            <span className="label text-muted">&nbsp;</span>
            <span className="label text-right text-muted">7 days</span>
            <span className="label text-right text-muted">All time</span>
          </div>
          {statRows.map(([label, week, all]) => (
            <div
              key={label}
              className="grid grid-cols-[1fr_90px_90px] items-baseline gap-2 border-b hairline py-3"
            >
              <span className="text-sm">{label}</span>
              <span className="text-right font-extrabold tabular-nums">{week}</span>
              <span className="text-right tabular-nums text-muted">{all}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
