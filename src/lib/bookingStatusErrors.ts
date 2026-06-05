export type SupabaseWriteError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

export function isDeclinedStatusUnsupported(error: SupabaseWriteError) {
  const text = [
    error.message,
    error.details,
    error.hint,
    error.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const isStatusError =
    text.includes("declined") ||
    text.includes("status");

  return (
    isStatusError &&
    (error.code === "23514" ||
      error.code === "22P02" ||
      text.includes("check constraint") ||
      text.includes("invalid input value"))
  );
}

export function supabaseErrorDetails(error: SupabaseWriteError) {
  return Array.from(
    new Set(
      [
        error.message,
        error.details,
        error.hint,
        error.code ? `Code ${error.code}` : null,
      ].filter((value): value is string => Boolean(value)),
    ),
  ).join(" · ");
}
