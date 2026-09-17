import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * The part of Vite's dev server the visual tests use. Declared locally: the repo's test tsconfig
 * resolves modules the Node-10 way, which cannot see the types in `vite`'s export map.
 */
export type ViteDevServer = {
  transformIndexHtml(url: string, html: string): Promise<string>;
  middlewares: (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
  ssrLoadModule(url: string): Promise<Record<string, unknown>>;
  close(): Promise<void>;
};
