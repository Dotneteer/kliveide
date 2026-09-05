// --- The `err?.message ?? String(err)` idiom, in one place. Async ports reject
// --- with anything at all, and every handler needs the same readable string.
export function messageOf(error: unknown, fallback = "Unknown error"): string {
  if (error === undefined || error === null) return fallback;
  if (typeof error === "string") return error || fallback;
  const message = (error as { message?: unknown }).message;
  if (typeof message === "string" && message) return message;
  const text = String(error);
  return text && text !== "[object Object]" ? text : fallback;
}
