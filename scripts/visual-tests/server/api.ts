import type { IncomingMessage, ServerResponse } from "node:http";

import { discoverCases } from "../lib/case";
import { compileNexFile } from "../lib/compile-nex";
import { REPO_ROOT } from "../lib/machines";
import { MAIN_METHODS, SdSession } from "./sd-session";

const sessions = new Map<string, SdSession>();

/** Uint8Array <-> { __bytes: base64 }, recursively, so byte arrays survive JSON. */
export function encodeBytes(v: unknown): unknown {
  if (v instanceof Uint8Array) return { __bytes: Buffer.from(v).toString("base64") };
  if (Array.isArray(v)) return v.map(encodeBytes);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encodeBytes(x)]));
  return v;
}
export function decodeBytes(v: unknown): unknown {
  if (v && typeof v === "object" && "__bytes" in (v as object)) return new Uint8Array(Buffer.from((v as { __bytes: string }).__bytes, "base64"));
  if (Array.isArray(v)) return v.map(decodeBytes);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decodeBytes(x)]));
  return v;
}

export function disposeAllSessions(): void {
  for (const s of sessions.values()) s.dispose();
  sessions.clear();
}

/*
 * /api routes. JSON in, JSON out; byte arrays travel as base64 strings.
 *
 *   GET  /api/cases              -> [{ id, title, tiers }]
 *   GET  /api/cases/:id          -> case.json
 *   GET  /api/cases/:id/nex      -> { nexBase64 }   (compiled on every request: no stale builds)
 *   POST /api/session            -> { id, realCardMtime }   clone of ~/Klive/ks2.cim
 *   POST /api/session/:id/main/:method  { args } -> { result }   SD card API (see SdSession)
 *   POST /api/session/:id/nex/:case     -> { sdPath }   compile the case, copy it onto the card
 *   DELETE /api/session/:id
 */

export async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
}

export function sendJson(res: ServerResponse, value: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(value));
}

export async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const parts = url.pathname.split("/").filter(Boolean).slice(1); // drop "api"
  const cases = () => discoverCases(REPO_ROOT);

  if (parts[0] === "cases" && parts.length === 1 && req.method === "GET") {
    return sendJson(res, cases().map((c) => ({ id: c.spec.id, title: c.spec.title, tiers: c.spec.tiers ?? ["headless"] })));
  }
  if (parts[0] === "cases" && parts.length >= 2) {
    const c = cases().find((x) => x.spec.id === parts[1]);
    if (!c) return sendJson(res, { error: `no case ${parts[1]}` }, 404);
    if (parts.length === 2) return sendJson(res, c.spec);
    if (parts[2] === "nex") {
      try {
        const nex = await compileNexFile(c.programPath);
        return sendJson(res, { nexBase64: Buffer.from(nex.bytes).toString("base64") });
      } catch (e) {
        return sendJson(res, { error: (e as Error).message }, 422);
      }
    }
  }
  if (parts[0] === "session") {
    if (parts.length === 1 && req.method === "POST") {
      const session = new SdSession();
      sessions.set(session.id, session);
      return sendJson(res, { id: session.id, realCardMtime: SdSession.realCardMtime() });
    }
    const session = sessions.get(parts[1]);
    if (!session) return sendJson(res, { error: `no session ${parts[1]}` }, 404);
    if (parts.length === 2 && req.method === "DELETE") {
      session.dispose();
      sessions.delete(session.id);
      return sendJson(res, { ok: true, realCardMtime: SdSession.realCardMtime() });
    }
    if (parts[2] === "main" && req.method === "POST") {
      const method = parts[3];
      if (!MAIN_METHODS.has(method)) return sendJson(res, { error: `method ${method} is not available` }, 404);
      try {
        const { args } = (await readJson(req)) ?? { args: [] };
        const fn = (session as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method];
        const result = await fn.apply(session, decodeBytes(args) as unknown[]);
        return sendJson(res, { result: encodeBytes(result) });
      } catch (e) {
        return sendJson(res, { error: (e as Error).message }, 500);
      }
    }
    if (parts[2] === "nex" && req.method === "POST") {
      const c = cases().find((x) => x.spec.id === parts[3]);
      if (!c) return sendJson(res, { error: `no case ${parts[3]}` }, 404);
      try {
        const nex = await compileNexFile(c.programPath);
        // --- 8.3-safe name: NextZXOS paths on the card
        const name = c.spec.id.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() + ".NEX";
        const sdPath = await session.copyBytesToSdCard(name, nex.bytes);
        return sendJson(res, { sdPath, nexBase64: Buffer.from(nex.bytes).toString("base64") });
      } catch (e) {
        return sendJson(res, { error: (e as Error).message }, 422);
      }
    }
  }
  sendJson(res, { error: `unknown route ${req.method} ${url.pathname}` }, 404);
}
