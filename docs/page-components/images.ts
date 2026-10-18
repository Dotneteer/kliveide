/**
 * Localized screenshots: `public/images/<lang>/<src>`, falling back to English (R4 of
 * .plans/DOCS_SITE_MODERNIZATION_PLAN.md). Build-time only - it reads the image folder.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const IMAGES = join(process.cwd(), "public", "images");

/** The `<lang>/<src>` path that exists, or undefined. */
export function findLocalizedImage(src: string, lang: string): string | undefined {
  for (const candidate of [lang, "en"]) {
    if (existsSync(join(IMAGES, candidate, src))) return `${candidate}/${src}`;
  }
  return undefined;
}

export type ImageSidecar = {
  width: number;
  height: number;
  markers: Record<string, { x: number; y: number }>;
};

/** The marker sidecar the doc-shots harness writes beside an image (`<image>.json`). */
export function readImageSidecar(file: string): ImageSidecar | undefined {
  const path = join(IMAGES, `${file}.json`);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as ImageSidecar) : undefined;
}
