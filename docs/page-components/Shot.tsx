/**
 * An annotated, localized screenshot (R3/R4 of .plans/DOCS_SITE_MODERNIZATION_PLAN.md).
 *
 *   <Shot src="get-started/debug-breakpoint.webp" figure="7.1" caption="Paused at a breakpoint"
 *         markers={["breakpoint", "registers"]} width={900} alt="..." />
 *
 * - The image is looked up as `public/images/<lang>/<src>`, falling back to English, so a page
 *   translated before its screenshots shows the English ones rather than nothing. `lang` is not
 *   written in MDX: the docs route binds it (`app/[lang]/(docs)/[...mdxPath]/page.tsx`).
 * - Markers are numbered badges drawn in HTML over the image, never into its pixels, so the text
 *   they point to stays translatable. A marker is either a name from the recipe's sidecar file
 *   (`<image>.json`, written by `scripts/doc-shots/harness.cjs`; positions follow the layout) or
 *   an explicit `{ x, y }` in percent. They are numbered in the order given; the page explains
 *   them in an ordinary numbered list under the image.
 * - `figure` and `caption` make the figure label above the image ("FIG. 7.1 · Paused at a
 *   breakpoint"), the docs' borrowing from design direction C (decision D8).
 *
 * A server component: it reads the image folder at build time, which a static export allows.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import styles from "./Shot.module.scss";

type Marker = string | { x: number; y: number };

type ShotProps = Readonly<{
  src: string;
  alt: string;
  width?: number;
  figure?: string;
  caption?: string;
  markers?: Marker[];
  lang?: string;
}>;

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const IMAGES = join(process.cwd(), "public", "images");

/** The language folder that has this image: the page's own, or English. */
function resolveImage(src: string, lang: string): string {
  for (const candidate of [lang, "en"]) {
    if (existsSync(join(IMAGES, candidate, src))) return `${candidate}/${src}`;
  }
  throw new Error(`<Shot>: no image "${src}" for "${lang}" or "en" under public/images/`);
}

type Sidecar = { width: number; height: number; markers: Record<string, { x: number; y: number }> };

function readSidecar(file: string): Sidecar | undefined {
  const path = join(IMAGES, `${file}.json`);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Sidecar) : undefined;
}

export default function Shot({ src, alt, width, figure, caption, markers = [], lang = "en" }: ShotProps) {
  const file = resolveImage(src, lang);
  const sidecar = readSidecar(file);
  const url = `${basePath}/images/${file}`;
  const points = markers.map((m, i) => {
    if (typeof m !== "string") return m;
    const p = sidecar?.markers[m];
    if (!p) throw new Error(`<Shot src="${src}">: marker "${m}" is not in ${file}.json`);
    return p;
  });
  // --- The intrinsic size lets the browser reserve the space before the image loads
  const intrinsic = sidecar ? { width: sidecar.width, height: sidecar.height } : {};

  return (
    <figure className={styles.figure} style={width ? { maxWidth: `${width}px` } : undefined}>
      {(figure || caption) && (
        <figcaption className={styles.label}>
          {figure && <span className={styles.number}>Fig. {figure}</span>}
          {caption && <span>{caption}</span>}
        </figcaption>
      )}
      <a className={styles.frame} href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt={alt} loading="lazy" decoding="async" {...intrinsic} />
        {points.map((p, i) => (
          <span
            key={i}
            className={styles.marker}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            aria-label={`${i + 1}`}
          >
            {i + 1}
          </span>
        ))}
      </a>
    </figure>
  );
}
