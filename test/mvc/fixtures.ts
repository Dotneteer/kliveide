/**
 * The fixture-builder primitives every MVC dialog suite needs.
 *
 * Builders deep-merge an override onto a sensible default so a test names only
 * the field it is actually about (`aState({ busy: true })`), and so a view-model
 * builder can be derived from a real state — which is what stops a newly added
 * field from being silently missing in the fixtures.
 */

export type DeepPartial<T> = T extends (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function deepMerge<T>(base: T, over?: DeepPartial<T>): T {
  if (over === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(over)) return over as T;

  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) {
    // --- An explicit `undefined` clears a field rather than being ignored;
    // --- tests need to express "no candidate", not only "some candidate".
    result[key] =
      value !== undefined && isPlainObject(value) && isPlainObject(result[key])
        ? deepMerge(result[key], value as never)
        : value;
  }
  return result as T;
}
