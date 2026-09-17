import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { extname, join, normalize, resolve } from "node:path";
import type { ViteDevServer } from "./vite-types";

import { REPO_ROOT } from "../lib/machines";
import { disposeAllSessions, handleApi } from "./api";

const PAGE_DIR = join(REPO_ROOT, "scripts/visual-tests/browser");
const PUBLIC_DIR = join(REPO_ROOT, "src/public");
const WASM = join(REPO_ROOT, "src/emu/machines/zxNext/wasm/dist/zx-spectrum-next.wasm");

const TYPES: Record<string, string> = { ".wasm": "application/wasm", ".rom": "application/octet-stream", ".bin": "application/octet-stream" };

export type VisualServer = { url: string; close(): Promise<void> };

/**
 * The browser tier's "main process": the page, its modules (through Vite), the emulator's static
 * files (ROMs under /public, the WASM artifact) and the /api routes (assembler, SD card).
 */
export async function startVisualServer(vite: ViteDevServer, options: { port?: number } = {}): Promise<VisualServer> {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
      if (url.pathname === "/" || url.pathname === "/index.html") {
        const html = readFileSync(join(PAGE_DIR, "index.html"), "utf8");
        res.setHeader("Content-Type", "text/html");
        // --- Without the Vite HMR client: the test page never hot-reloads, and with WebSockets off
        // --- the client would only report a connection error on every load.
        const page = (await vite.transformIndexHtml(url.pathname + url.search, html)).replace(
          /<script type="module" src="\/@vite\/client"><\/script>\s*/,
          ""
        );
        res.end(page);
        return;
      }
      if (url.pathname === "/favicon.ico") {
        res.statusCode = 204;
        res.end();
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url);
        return;
      }
      if (url.pathname === "/wasm/zx-spectrum-next.wasm") return sendFile(res, WASM);
      if (url.pathname.startsWith("/public/")) {
        const file = normalize(join(PUBLIC_DIR, decodeURIComponent(url.pathname.slice("/public/".length))));
        if (!file.startsWith(PUBLIC_DIR)) return notFound(res);
        return sendFile(res, file);
      }
      vite.middlewares(req, res, () => notFound(res));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain");
      res.end(e instanceof Error ? e.stack ?? e.message : String(e));
    }
  });
  await new Promise<void>((r) => server.listen(options.port ?? 0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise<void>((r) => {
        disposeAllSessions();
        server.close(() => r());
      })
  };
}

function sendFile(res: ServerResponse, file: string): void {
  if (!existsSync(file) || !statSync(file).isFile()) return notFound(res);
  res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
  res.end(readFileSync(file));
}

function notFound(res: ServerResponse): void {
  res.statusCode = 404;
  res.end("Not found");
}

export function resolveInside(base: string, rel: string): string | undefined {
  const p = resolve(base, rel);
  return p.startsWith(base) ? p : undefined;
}
