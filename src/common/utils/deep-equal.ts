/**
 * Compares two JSON-like values structurally.
 *
 * Written for state that is persisted as JSON (workspace settings, view states, and similar): it
 * handles primitives, arrays and plain objects, and treats a missing key and an explicit
 * `undefined` value as equal, because a round trip through JSON does the same. Key order is
 * irrelevant. Values that JSON cannot represent (functions, class instances, Maps, ...) are only
 * considered equal when they are the very same reference.
 * @param a First value
 * @param b Second value
 * @returns True if the two values are structurally equal
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  // --- Only two objects can be structurally equal from here on; `null` is typeof "object" too.
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, idx) => deepEqual(item, b[idx]));
  }

  // --- Anything else with a custom prototype (Date, Map, class instances, ...) is compared by
  // --- reference only, which Object.is has already ruled out.
  if (!isPlainObject(a) || !isPlainObject(b)) return false;

  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

/**
 * Tests whether the specified value is a plain object (an object literal or a null-prototype
 * object), as opposed to an instance of some other class.
 * @param value Value to test
 */
function isPlainObject(value: object): value is Record<string, unknown> {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
