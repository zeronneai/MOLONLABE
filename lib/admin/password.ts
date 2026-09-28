// What makes an admin password acceptable. Shared by the form, which says
// so as you type, and the server action, which refuses regardless.
//
// Length is what matters most, so the rule leads with it: twelve
// characters at least. Beyond that it refuses only the passwords that
// are guessable in ways a person would not think of as weak: built from
// your own name or email, from the shop's name, from the word password,
// one character repeated, or a straight run of keys or digits. Supabase
// applies its own rules on top (its minimum length and, if switched on,
// its check against leaked passwords), and the form reports those too.

export const PASSWORD_MIN = 12;

const SEQUENCES = ["0123456789", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

/** Why a new password is not acceptable, in words, or null if it is. */
export function passwordProblem(
  next: string,
  { current, email, name }: { current?: string; email?: string; name?: string } = {},
): string | null {
  if (next.length < PASSWORD_MIN) {
    return `Use at least ${PASSWORD_MIN} characters (this one has ${next.length}). A few ordinary words together are easy to remember and hard to guess.`;
  }
  if (current && next === current) return "That is your current password. Choose a new one.";
  const lower = next.toLowerCase();
  if (/^(.)\1+$/.test(next)) return "That is one character repeated. Choose something harder to guess.";
  const squashed = lower.replace(/[^a-z0-9]/g, "");
  if (squashed.length >= 6 && SEQUENCES.some((seq) => seq.includes(squashed) || (seq + seq).includes(squashed))) {
    return "That is a straight run of keys or digits. Choose something harder to guess.";
  }
  const words = [
    "password", "molon", "labe", "suncity", "molonlabe",
    ...(email ? [email.split("@")[0]] : []),
    ...(name ? name.split(/\s+/) : []),
  ]
    .map((w) => w.toLowerCase().trim())
    .filter((w) => w.length >= 4);
  const used = words.find((w) => lower.includes(w));
  if (used) {
    return `Don't build it from "${used}": names, your email and the shop's name are the first things anyone tries.`;
  }
  return null;
}
