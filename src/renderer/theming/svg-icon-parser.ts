import type { IconPaintAttrs, MarkupIconInfo } from "./theme";

/**
 * Turns the text of an `.svg` file into a `MarkupIconInfo`.
 *
 * This module is deliberately DOM-free: it runs at renderer module-load time
 * and in the `node` test project, where `DOMParser` does not exist. The parsing
 * it does is intentionally shallow - enough to lift the root paint attributes,
 * keep the inner markup, and throw away everything that has no business in an
 * icon.
 */

/**
 * Elements an icon may contain. Anything else is dropped along with its
 * children. Compared case-insensitively; the source casing is preserved in the
 * output, because SVG element names are case-sensitive (`linearGradient`).
 */
const ALLOWED_ELEMENTS = new Set([
  "path",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "rect",
  "g",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "mask",
  "use",
  "title",
  "desc",
  "symbol"
]);

/**
 * Root attributes that describe how the icon is painted, and therefore have to
 * be re-applied on the rendered `<svg>`. Everything else on the root (`class`,
 * `width`, `height`, `xmlns`, `id`, `style`, `data-*`) is discarded: the
 * `Icon` component owns those.
 */
const PAINT_ATTRIBUTES = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "fill-rule",
  "clip-rule"
] as const;

/**
 * Fill values that are not concrete colours and so must not be surfaced as the
 * icon's default fill.
 */
const NON_COLOR_FILLS = new Set(["none", "currentcolor", "transparent", "inherit"]);

const DEFAULT_VIEWBOX = "0 0 24 24";

/**
 * The result of parsing one file.
 *
 * Note for callers: this project compiles with `strictNullChecks: false`, and
 * in that mode TypeScript does **not** narrow a discriminated union through a
 * truthiness test. Compare the discriminant explicitly (`parsed.ok === false`)
 * rather than writing `!parsed.ok`, which fails to narrow and breaks the build.
 */
export type ParsedIcon =
  | { ok: true; icon: MarkupIconInfo; warnings: string[] }
  | { ok: false; reason: string };

type Attributes = Record<string, string>;

/**
 * Parses the text of an SVG file into an icon definition.
 *
 * Never throws: a malformed file must not take the renderer down with it, so
 * failures come back as `{ ok: false, reason }` and the caller skips the file.
 *
 * @param name Icon ID, derived from the file name
 * @param source Raw contents of the `.svg` file
 */
export function parseSvgIcon(name: string, source: string): ParsedIcon {
  try {
    return parseSvgIconCore(name, source);
  } catch (error) {
    return { ok: false, reason: `Unexpected parse error: ${(error as Error)?.message ?? error}` };
  }
}

function parseSvgIconCore(name: string, source: string): ParsedIcon {
  const warnings: string[] = [];

  // --- Drop the XML prolog, doctype and comments before anything else
  const text = source
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // --- Locate the root <svg ...> element
  const rootStart = findElementStart(text, "svg");
  if (rootStart < 0) {
    return { ok: false, reason: "No <svg> root element found" };
  }
  const rootTagEnd = findTagEnd(text, rootStart);
  if (rootTagEnd < 0) {
    return { ok: false, reason: "Unterminated <svg> start tag" };
  }

  const rootAttrText = text.slice(rootStart + "<svg".length, rootTagEnd);
  const rootAttrs = parseAttributes(rootAttrText);

  // --- A self-closing root (<svg .../>) has no content at all
  const selfClosing = text[rootTagEnd - 1] === "/";
  const bodyStart = rootTagEnd + 1;
  const bodyEnd = selfClosing ? bodyStart : text.lastIndexOf("</svg");
  if (!selfClosing && bodyEnd < bodyStart) {
    return { ok: false, reason: "Missing </svg> closing tag" };
  }
  const rawBody = selfClosing ? "" : text.slice(bodyStart, bodyEnd);

  // --- Geometry
  const { viewBox, width, height, viewBoxWarning } = resolveViewBox(rootAttrs);
  if (viewBoxWarning) {
    warnings.push(viewBoxWarning);
  }

  // --- Paint attributes carried over from the root
  const paint: IconPaintAttrs = {};
  for (const attr of PAINT_ATTRIBUTES) {
    const value = rootAttrs[attr];
    if (value !== undefined && value !== "") {
      paint[attr] = value;
    }
  }

  // --- A concrete root fill becomes the icon's default fill, matching the
  // --- `iconInfo.fill ?? "white"` semantics of the single-path icons.
  const rootFill = rootAttrs["fill"];
  const defaultFill =
    rootFill && !NON_COLOR_FILLS.has(rootFill.trim().toLowerCase()) ? rootFill : undefined;

  // --- Sanitize, then namespace any internal IDs
  const sanitized = sanitizeMarkup(rawBody, warnings);
  const content = namespaceIds(sanitized, name);

  if (!content.trim()) {
    return { ok: false, reason: "The <svg> element has no renderable content" };
  }

  const icon: MarkupIconInfo = {
    kind: "markup",
    name,
    content,
    viewBox,
    width,
    height,
    paint,
    ...(defaultFill ? { fill: defaultFill } : {})
  };

  return { ok: true, icon, warnings };
}

/**
 * Finds the index of the start of the named element, ignoring matches inside
 * attribute values.
 */
function findElementStart(text: string, tagName: string): number {
  const pattern = new RegExp(`<${tagName}(\\s|/|>)`, "i");
  const match = pattern.exec(text);
  return match ? match.index : -1;
}

/**
 * Finds the index of the `>` that closes the tag starting at `start`, skipping
 * over any `>` that appears inside a quoted attribute value.
 */
function findTagEnd(text: string, start: number): number {
  let quote: string | undefined;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) {
        quote = undefined;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return i;
    }
  }
  return -1;
}

const ATTRIBUTE_PATTERN = /([:A-Za-z_][-.:\w]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

/**
 * Parses a tag's attribute text into a map. Attribute names are lower-cased,
 * since SVG attribute names are case-insensitive in HTML parsing contexts and
 * we only ever look them up by a known lower-case key.
 */
function parseAttributes(attrText: string): Attributes {
  const result: Attributes = {};
  ATTRIBUTE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTRIBUTE_PATTERN.exec(attrText)) !== null) {
    const rawName = match[1];
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    result[rawName.toLowerCase()] = decodeEntities(value);
  }
  return result;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Works out the viewBox and the intrinsic size.
 *
 * The viewBox wins, because it is what actually maps the icon geometry onto the
 * rendered box. `width`/`height` only serve as a fallback for files that omit
 * it; the rendered size always comes from the `Icon` props.
 */
function resolveViewBox(attrs: Attributes): {
  viewBox: string;
  width: number;
  height: number;
  viewBoxWarning?: string;
} {
  const rawViewBox = attrs["viewbox"];
  if (rawViewBox) {
    const parts = rawViewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return {
        viewBox: `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`,
        width: parts[2],
        height: parts[3]
      };
    }
  }

  const width = parseLength(attrs["width"]);
  const height = parseLength(attrs["height"]);
  if (width !== undefined && height !== undefined) {
    return { viewBox: `0 0 ${width} ${height}`, width, height };
  }

  const [, , fallbackWidth, fallbackHeight] = DEFAULT_VIEWBOX.split(" ").map(Number);
  return {
    viewBox: DEFAULT_VIEWBOX,
    width: fallbackWidth,
    height: fallbackHeight,
    viewBoxWarning: `No usable viewBox or width/height; defaulting to "${DEFAULT_VIEWBOX}"`
  };
}

function parseLength(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const numeric = parseFloat(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

/**
 * Walks the markup, keeping only allow-listed elements and safe attributes.
 *
 * These files are developer-authored and inlined at build time, so this is
 * defence in depth rather than a security boundary - but an SVG pasted from a
 * random site should not be able to smuggle anything into the renderer.
 */
function sanitizeMarkup(markup: string, warnings: string[]): string {
  let out = "";
  let index = 0;

  while (index < markup.length) {
    const lt = markup.indexOf("<", index);
    if (lt < 0) {
      out += markup.slice(index);
      break;
    }

    // --- Text between elements is kept verbatim; it cannot contain "<"
    out += markup.slice(index, lt);

    const tagEnd = findTagEnd(markup, lt);
    if (tagEnd < 0) {
      // --- Unterminated tag: drop the rest rather than emit broken markup
      warnings.push("Unterminated tag; the remainder of the markup was dropped");
      break;
    }

    const inner = markup.slice(lt + 1, tagEnd);

    // --- Closing tag
    if (inner.startsWith("/")) {
      const closeName = inner.slice(1).trim();
      if (ALLOWED_ELEMENTS.has(closeName.toLowerCase())) {
        out += `</${closeName}>`;
      }
      index = tagEnd + 1;
      continue;
    }

    const nameMatch = /^([:A-Za-z_][-.:\w]*)/.exec(inner);
    if (!nameMatch) {
      index = tagEnd + 1;
      continue;
    }

    const tagName = nameMatch[1];
    const isSelfClosing = inner.trimEnd().endsWith("/");
    const attrText = inner.slice(tagName.length, isSelfClosing ? inner.lastIndexOf("/") : undefined);

    if (!ALLOWED_ELEMENTS.has(tagName.toLowerCase())) {
      warnings.push(`Dropped <${tagName}> element`);
      index = isSelfClosing
        ? tagEnd + 1
        : skipElement(markup, tagEnd + 1, tagName);
      continue;
    }

    const attrs = sanitizeAttributes(attrText, warnings);
    out += `<${tagName}${attrs}${isSelfClosing ? "/" : ""}>`;
    index = tagEnd + 1;
  }

  return out;
}

/**
 * Skips past the matching closing tag of a dropped element, so its children go
 * with it. Handles nesting of the same element name.
 */
function skipElement(markup: string, from: number, tagName: string): number {
  const lower = tagName.toLowerCase();
  let depth = 1;
  let index = from;

  while (index < markup.length && depth > 0) {
    const lt = markup.indexOf("<", index);
    if (lt < 0) return markup.length;
    const tagEnd = findTagEnd(markup, lt);
    if (tagEnd < 0) return markup.length;

    const inner = markup.slice(lt + 1, tagEnd);
    if (inner.startsWith("/")) {
      if (inner.slice(1).trim().toLowerCase() === lower) {
        depth--;
      }
    } else {
      const nameMatch = /^([:A-Za-z_][-.:\w]*)/.exec(inner);
      if (
        nameMatch &&
        nameMatch[1].toLowerCase() === lower &&
        !inner.trimEnd().endsWith("/")
      ) {
        depth++;
      }
    }
    index = tagEnd + 1;
  }

  return index;
}

function sanitizeAttributes(attrText: string, warnings: string[]): string {
  const attrs = parseAttributes(attrText);
  let out = "";

  for (const [name, value] of Object.entries(attrs)) {
    // --- Event handlers never belong in an icon
    if (name.startsWith("on")) {
      warnings.push(`Dropped event handler attribute "${name}"`);
      continue;
    }

    // --- Only same-document references are allowed
    if (name === "href" || name === "xlink:href") {
      if (!value.startsWith("#")) {
        warnings.push(`Dropped external reference "${name}=${value}"`);
        continue;
      }
    }

    // --- Inline styles may not pull in external resources
    if (name === "style" && /url\(|expression\(/i.test(value)) {
      warnings.push("Dropped a style attribute referencing an external resource");
      continue;
    }

    // --- Classes cannot do anything useful here (no <style> survives
    // --- sanitizing) but could accidentally collide with application CSS
    if (name === "class") {
      continue;
    }

    out += ` ${name}="${escapeAttribute(value)}"`;
  }

  return out;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Rewrites internal IDs so that two icons defining the same gradient or clip
 * path ID cannot collide.
 *
 * IDs live in a single document-wide namespace, so without this, two icons that
 * both ship an `id="a"` corrupt each other - but only while both happen to be
 * on screen, which is exactly the kind of bug that survives review and reaches
 * a release.
 */
function namespaceIds(markup: string, iconName: string): string {
  const ids = new Set<string>();

  // --- IDs defined by this icon...
  const idPattern = /\bid="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = idPattern.exec(markup)) !== null) {
    ids.add(match[1]);
  }

  // --- ...and IDs it merely references. A reference whose target this icon
  // --- does not define would otherwise stay global and could resolve against
  // --- an unrelated element in the document; scoping it makes it dangle
  // --- harmlessly instead.
  const refPattern = /url\(\s*#([^)\s]+)\s*\)|\b(?:href|xlink:href)="#([^"]+)"/g;
  while ((match = refPattern.exec(markup)) !== null) {
    ids.add(match[1] ?? match[2]);
  }
  if (ids.size === 0) {
    return markup;
  }

  const prefix = `klive-icon-${iconName.replace(/[^A-Za-z0-9_-]/g, "-")}-`;
  let result = markup;

  for (const id of ids) {
    const quoted = escapeRegExp(id);
    const scoped = `${prefix}${id}`;
    result = result
      .replace(new RegExp(`\\bid="${quoted}"`, "g"), `id="${scoped}"`)
      .replace(new RegExp(`url\\(\\s*#${quoted}\\s*\\)`, "g"), `url(#${scoped})`)
      .replace(new RegExp(`\\b(href|xlink:href)="#${quoted}"`, "g"), `$1="#${scoped}"`);
  }

  return result;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
