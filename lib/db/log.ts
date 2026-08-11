// Full-detail Supabase error logging. PostgrestError's `message` is a
// non-enumerable Error prop, so a bare JSON.stringify(error) drops it —
// spell every field out explicitly.

type DbError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

export function logDbError(context: string, error: DbError): void {
  console.error(
    `[db] ${context}:`,
    JSON.stringify({
      code: error.code ?? null,
      message: error.message,
      details: error.details ?? null,
      hint: error.hint ?? null,
    }),
  );
}
