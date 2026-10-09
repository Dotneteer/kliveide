/*
 * The Automation pane's lines (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D13, T11).
 *
 * One line per connection event and per method call, arguments summarised. The token is never
 * printed, and neither is a memory or picture payload: the `token` key is redacted wherever it
 * appears, payload keys print only their size, any other long string is cut, and a message that
 * echoes a request goes through `redactSecrets` first.
 */

/** Keys whose value is a secret */
const SECRET_KEYS = new Set(["token"]);

/** Keys whose value is a payload: only its size is shown */
const PAYLOAD_KEYS = new Set(["data", "bytes", "pixels"]);

/** The longest string shown as it is */
const MAX_STRING = 80;

/** The deepest nesting shown */
const MAX_DEPTH = 3;

/** How many bytes a base64 string holds */
function base64Bytes(text: string): number {
  const clean = text.replace(/\s+/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

function summarizeValue(key: string | undefined, value: unknown, depth: number): string {
  if (key !== undefined && SECRET_KEYS.has(key)) return "<redacted>";
  if (key !== undefined && PAYLOAD_KEYS.has(key)) {
    if (typeof value === "string") return `<${base64Bytes(value)} bytes>`;
    if (Array.isArray(value)) return `<${value.length} bytes>`;
    if (value && typeof value === "object" && "length" in (value as object)) {
      return `<${(value as { length: number }).length} bytes>`;
    }
  }
  if (value === null || value === undefined) return String(value);
  switch (typeof value) {
    case "string": {
      const text = value.replace(/[\r\n]+/g, " ");
      return JSON.stringify(text.length > MAX_STRING ? `${text.slice(0, MAX_STRING)}…` : text);
    }
    case "number":
    case "boolean":
      return String(value);
    case "object": {
      if (depth >= MAX_DEPTH) return Array.isArray(value) ? "[…]" : "{…}";
      if (ArrayBuffer.isView(value)) return `<${(value as ArrayBufferView).byteLength} bytes>`;
      if (Array.isArray(value)) {
        const items = value.slice(0, 8).map((item) => summarizeValue(undefined, item, depth + 1));
        if (value.length > 8) items.push(`…+${value.length - 8}`);
        return `[${items.join(", ")}]`;
      }
      const entries = Object.entries(value as Record<string, unknown>).map(
        ([k, v]) => `${k}: ${summarizeValue(k, v, depth + 1)}`
      );
      return `{${entries.join(", ")}}`;
    }
    default:
      return typeof value;
  }
}

/** A request's parameters as a short, safe summary */
export function summarizeParams(params: unknown): string {
  if (params === undefined || params === null) return "";
  if (typeof params !== "object" || Array.isArray(params)) return summarizeValue(undefined, params, 0);
  const entries = Object.entries(params as Record<string, unknown>);
  if (!entries.length) return "";
  return entries.map(([k, v]) => `${k}: ${summarizeValue(k, v, 1)}`).join(", ");
}

/** Removes every occurrence of the secrets from a text (an error message that echoes a request) */
export function redactSecrets(text: string, secrets: (string | undefined)[]): string {
  let result = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 8) result = result.split(secret).join("<redacted>");
  }
  // --- A token-shaped value that is not the current token (a wrong one a client sent) too
  return result.replace(/\b[0-9a-f]{64}\b/g, "<redacted>");
}

export type CallOutcome = { ok: true } | { ok: false; error: string };

/** One method call as an Automation pane line */
export function formatCallLine(
  client: string,
  method: string,
  params: unknown,
  outcome: CallOutcome,
  elapsedMs: number
): string {
  const args = summarizeParams(params);
  const status = "error" in outcome ? `error: ${outcome.error}` : "ok";
  return `[${client}] ${method}(${args}) → ${status} (${Math.round(elapsedMs)} ms)`;
}
