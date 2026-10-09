/*
 * Structured clone → JSON, at one boundary (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` T7).
 *
 * Results from `EmuApi` and `IdeApi` cross Electron's IPC by structured clone, so they carry
 * `Uint8Array`s, `Map`s and `undefined`s that `JSON.stringify` would mangle (a typed array becomes
 * `{"0":1,"1":2,...}`) or drop inconsistently. Every result the server sends goes through
 * `toJsonValue` first:
 *
 * - byte arrays (`Uint8Array`, `Uint8ClampedArray`, `Buffer`) become base64 strings;
 * - other typed arrays become plain number arrays;
 * - a `Map` becomes an object, a `Set` an array;
 * - `undefined` fields and functions are dropped, `undefined` array items become `null`;
 * - a `bigint` becomes its decimal string; `NaN` and the infinities become `null`;
 * - a `Date` becomes its ISO string; an `Error` its message.
 */
export function toJsonValue(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null) return null;
  switch (typeof value) {
    case "undefined":
    case "function":
    case "symbol":
      return undefined;
    case "bigint":
      return value.toString();
    case "number":
      return Number.isFinite(value) ? value : null;
    case "string":
    case "boolean":
      return value;
  }
  const obj = value as object;
  if (obj instanceof Uint8Array || obj instanceof Uint8ClampedArray) {
    return bytesToBase64(obj);
  }
  if (ArrayBuffer.isView(obj)) {
    return Array.from(obj as unknown as ArrayLike<number>, (n) => (typeof n === "bigint" ? String(n) : n));
  }
  if (obj instanceof ArrayBuffer) {
    return bytesToBase64(new Uint8Array(obj));
  }
  if (obj instanceof Date) {
    return Number.isNaN(obj.getTime()) ? null : obj.toISOString();
  }
  if (obj instanceof Error) {
    return obj.message;
  }
  if (seen.has(obj)) {
    // --- A cycle cannot be written as JSON
    return null;
  }
  seen.add(obj);
  try {
    if (Array.isArray(obj)) {
      return obj.map((item) => {
        const encoded = toJsonValue(item, seen);
        return encoded === undefined ? null : encoded;
      });
    }
    if (obj instanceof Map) {
      const result: Record<string, unknown> = {};
      for (const [key, item] of obj) {
        const encoded = toJsonValue(item, seen);
        if (encoded !== undefined) result[String(key)] = encoded;
      }
      return result;
    }
    if (obj instanceof Set) {
      return Array.from(obj, (item) => {
        const encoded = toJsonValue(item, seen);
        return encoded === undefined ? null : encoded;
      });
    }
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(obj)) {
      const encoded = toJsonValue(item, seen);
      if (encoded !== undefined) result[key] = encoded;
    }
    return result;
  } finally {
    seen.delete(obj);
  }
}

/** Bytes as base64 */
export function bytesToBase64(bytes: Uint8Array | Uint8ClampedArray): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
}

/**
 * Base64 (or an array of byte values) as bytes; undefined when it is neither.
 * Strict: a string with characters outside the base64 alphabet is rejected rather than skipped.
 */
export function bytesFromJson(value: unknown): Uint8Array | undefined {
  if (typeof value === "string") {
    const text = value.replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text) || text.length % 4 === 1) return undefined;
    return new Uint8Array(Buffer.from(text, "base64"));
  }
  if (Array.isArray(value)) {
    if (!value.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)) return undefined;
    return Uint8Array.from(value as number[]);
  }
  return undefined;
}
