import { MessengerBase } from "@messaging/MessengerBase";
import type { Channel, RequestMessage } from "@messaging/messages-core";

/*
 * A MessengerBase that answers `createMainApi(messenger)` calls over HTTP.
 *
 * In the app, the EMU renderer's messenger carries "ApiMethodRequest" messages to the main process
 * over IPC. Here the "main process" is the visual test server, and a request becomes
 * POST /api/session/<id>/main/<method> { args }. Byte arrays travel as { __bytes: base64 }.
 */

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function encodeBytes(v: unknown): unknown {
  if (v instanceof Uint8Array) return { __bytes: toBase64(v) };
  if (Array.isArray(v)) return v.map(encodeBytes);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encodeBytes(x)]));
  return v;
}

export function decodeBytes(v: unknown): unknown {
  if (v && typeof v === "object" && "__bytes" in (v as object)) return fromBase64((v as { __bytes: string }).__bytes);
  if (Array.isArray(v)) return v.map(decodeBytes);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decodeBytes(x)]));
  return v;
}

export class HttpMessenger extends MessengerBase {
  /** Number of main-API calls made, by method - shown on the page, useful when a boot stalls. */
  readonly calls: Record<string, number> = {};

  constructor(private readonly sessionId: string) {
    super();
  }

  override async sendMessage(message: RequestMessage): Promise<any> {
    if (message.type !== "ApiMethodRequest") {
      return { type: "ErrorResponse", message: `HttpMessenger only carries API calls (got ${message.type})` };
    }
    const { method, args } = message as unknown as { method: string; args: unknown[] };
    this.calls[method] = (this.calls[method] ?? 0) + 1;
    const r = await fetch(`/api/session/${this.sessionId}/main/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args: encodeBytes(args) })
    });
    const body = await r.json();
    if (!r.ok) return { type: "ErrorResponse", message: body.error ?? `HTTP ${r.status}` };
    return { type: "ApiMethodResponse", result: decodeBytes(body.result) };
  }

  protected send(): void {
    throw new Error("HttpMessenger sends through sendMessage only");
  }

  get requestChannel(): Channel {
    return "visual-tests-http" as Channel;
  }

  get responseChannel(): Channel {
    return "visual-tests-http" as Channel;
  }
}
