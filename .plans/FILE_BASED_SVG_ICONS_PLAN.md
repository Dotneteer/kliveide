# File-Based SVG Icons Plan

**Status:** Proposed
**Created:** 2026-09-05
**Updated:** 2026-09-05
**Scope:** Add a drop-in folder of `.svg` files that register themselves as icon IDs (filename = ID) and override same-named stock icons. Targets the renderer icon stock only (`Icon`, `getIcon`). The base64 PNG stock in `image-defs.ts` (`@name` references) is explicitly out of scope.

---

## 1. Goal

Today every icon is a hand-maintained entry in `src/renderer/theming/icon-defs.ts`. Adding an icon means editing a 638-line TypeScript array and hand-extracting a single `d` attribute.

The goal:

- Drop `sun.svg` into one folder → the ID `sun` immediately works in `<Icon iconName="sun" />`.
- No registration, no code edits, no build script to run by hand.
- A file icon **overrides** any stock icon with the same name.
- Lucide icons (stroke-based, multi-element) must render correctly and pick up the theme colour, exactly like stock icons do.

---

## 2. Current Repo Touchpoints

| File | Role today |
|---|---|
| [src/renderer/theming/icon-defs.ts](src/renderer/theming/icon-defs.ts) | `iconLibrary: IconInfo[]` — the stock icon array (~90 entries) |
| [src/renderer/theming/image-defs.ts](src/renderer/theming/image-defs.ts) | `imageLibrary: ImageInfo[]` — base64 PNGs, reached via `@name` |
| [src/renderer/theming/theme.ts:336](src/renderer/theming/theme.ts) | `IconInfo` type — `{ name, path, width, height, fill?, fill-rule?, clip-rule? }` |
| [src/renderer/theming/ThemeProvider.tsx:98](src/renderer/theming/ThemeProvider.tsx) | `getIcon` / `getImage` — linear `.find()` over the arrays |
| [src/renderer/controls/Icon.tsx](src/renderer/controls/Icon.tsx) | The **only** consumer of `getIcon`; renders one `<path d={...}>` |
| [test/Icon.test.tsx](test/Icon.test.tsx) | Three smoke tests over `Icon` |

Facts that shape the design:

- `getIcon` has exactly one consumer (`Icon.tsx`), so the render model can be extended without a wide refactor.
- `iconName` appears in ~185 places, all of them through `<Icon>` / `<IconButton>`. None of them touch `IconInfo` fields directly.
- Build is `electron-vite` 5 on Vite 6; tests run through the same Vite transform pipeline (`build/vitest.config.ts`).

---

## 3. The Central Design Problem

`IconInfo` models an icon as **one filled path**:

```tsx
<svg style={{ fill: fillValue }} viewBox={`0 0 ${w} ${h}`}>
  <path d={iconInfo.path} />
</svg>
```

A Lucide icon is neither one path nor filled:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
     fill="none" stroke="currentColor" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun">
  <circle cx="12" cy="12" r="4"/>
  <path d="M12 2v2"/>
  <path d="m19.07 4.93-1.41 1.41"/>
  ...
</svg>
```

Consequences, and why the naive approach fails:

- **"Just grab the `d` attribute"** loses every `<circle>`/`<line>` and every path after the first. A `sun` icon becomes a single stray stroke.
- **Concatenating all `d` values into one path** loses the non-path elements and still paints them *filled*, turning outlines into blobs.
- So: file icons need a second representation — **raw inner markup plus the root's paint attributes** — alongside the existing single-path form.

The colour story resolves cleanly through `currentColor`. Lucide's root already says `stroke="currentColor"`; if the rendered `<svg>` carries `color: <themeColour>` plus the source root's `fill`/`stroke`/`stroke-*` attributes, both stroke icons and fill icons inherit the theme colour with no per-element rewriting.

---

## 4. Product Decisions

Accepted as implementation requirements:

1. **Folder:** `src/renderer/assets/icons/` (sibling of `assets/fonts`, `assets/styles`).
2. **ID:** the filename without `.svg`, used verbatim. `sun.svg` → `sun`, `chevron-down.svg` → `chevron-down`.
3. **Flat folder only.** The glob is `*.svg`, not `**/*.svg`. Subfolders are silently ignored (documented), which keeps IDs unambiguous with zero collision logic. Revisit only if the folder actually gets unwieldy.
4. **Precedence:** file icon > stock `iconLibrary` entry > `unknown` fallback.
5. **Bundling:** compile-time inlining via `import.meta.glob(..., { query: "?raw" })`. No runtime `fs`, no `extraResources`, no packaging changes, works identically in `electron-vite dev` and in a packaged build.
6. **Adding a file during `dev`** triggers a Vite HMR update — no restart. (Vite invalidates glob owners when matching files are added or removed.)
7. **Stock icons stay where they are.** No mass migration of `icon-defs.ts` into files as part of this plan.
8. **Shadowing is legal and loud:** overriding a stock name logs one dev-mode console warning naming the icons.

---

## 5. Target Architecture

Three new files, three edited files.

```
src/renderer/assets/icons/          ← NEW: drop .svg files here
  README.md                         ← NEW: how the folder works
src/renderer/theming/
  svg-icon-parser.ts                ← NEW: pure SVG text → IconInfo (unit-testable)
  file-icon-defs.ts                 ← NEW: import.meta.glob + parse + export
  icon-registry.ts                  ← NEW: merged Map with override precedence
  theme.ts                          ← EDIT: widen IconInfo
  ThemeProvider.tsx                 ← EDIT: getIcon uses the registry
src/renderer/controls/Icon.tsx      ← EDIT: render markup icons
```

Splitting the parser from the glob matters: the parser is a pure function that unit-tests with string fixtures, while `file-icon-defs.ts` is a thin, hard-to-test glue module.

---

## 6. Implementation Phases

### Phase 0 — Spike (30 min, do first)

Before writing anything real, confirm the two load-bearing assumptions:

1. `import.meta.glob("../assets/icons/*.svg", { query: "?raw", import: "default", eager: true })` resolves in the **electron-vite renderer build**.
2. The same glob resolves under **vitest** (`build/vitest.config.ts`), so the registry is testable.

Do it with one throwaway module and one throwaway test asserting a fixture file's contents are non-empty. If (2) fails, fall back to keeping the glob out of the tested path (test `svg-icon-parser` + `icon-registry` with injected arrays, leave `file-icon-defs` untested). Do not proceed to Phase 2 before this is settled.

---

### Phase 1 — Widen the icon model

Edit [src/renderer/theming/theme.ts](src/renderer/theming/theme.ts). Turn `IconInfo` into a discriminated union so that **`icon-defs.ts` needs no changes at all** (the existing entries stay valid as the default variant):

```ts
/** Paint attributes copied verbatim from a source SVG root. */
export type IconPaintAttrs = {
  fill?: string;                 // e.g. "none" for Lucide
  stroke?: string;               // e.g. "currentColor"
  "stroke-width"?: string;
  "stroke-linecap"?: string;
  "stroke-linejoin"?: string;
  "fill-rule"?: string;
  "clip-rule"?: string;
};

/** The legacy single-filled-path icon (everything in icon-defs.ts). */
export type PathIconInfo = {
  kind?: "path";
  name: string;
  path: string;
  width: number;
  height: number;
  fill?: string;
  "fill-rule"?: string;
  "clip-rule"?: string;
};

/** An icon loaded from an .svg file: arbitrary sanitized inner markup. */
export type MarkupIconInfo = {
  kind: "markup";
  name: string;
  /** Sanitized inner markup of the source <svg>, ready for dangerouslySetInnerHTML. */
  content: string;
  /** viewBox of the source <svg>, e.g. "0 0 24 24". */
  viewBox: string;
  width: number;
  height: number;
  /** Root paint attributes to re-apply on the rendered <svg>. */
  paint: IconPaintAttrs;
  /** A concrete colour on the source root (not none/currentColor), used as the default fill. */
  fill?: string;
};

export type IconInfo = PathIconInfo | MarkupIconInfo;
```

`kind` is optional on `PathIconInfo`, so all ~90 literals in `icon-defs.ts` still type-check untouched.

**Check after this phase:** `npx tsc --noEmit -p build/tsconfig.web.json` — expect errors *only* in `Icon.tsx` (it accesses `.path` on the union). Those are fixed in Phase 3. Note that `npm run build:check` is a no-op in this repo (see AGENTS.md), so use the explicit project.

---

### Phase 2 — The parser (`svg-icon-parser.ts`)

A pure module, no DOM dependency at import time. Signature:

```ts
export type ParsedIcon =
  | { ok: true; icon: MarkupIconInfo }
  | { ok: false; reason: string };

export function parseSvgIcon(name: string, source: string): ParsedIcon;
```

Responsibilities, in order:

1. **Locate the root `<svg …>` element** and its inner markup. A tolerant regex is sufficient and avoids a DOM dependency in the node test project (`DOMParser` is unavailable in the `node` vitest project; it exists in `jsdom`). Reject a file with no `<svg` root.

2. **Derive the `viewBox`.**
   - Use the root `viewBox` if present.
   - Otherwise synthesize `0 0 <width> <height>` from numeric root `width`/`height`.
   - Otherwise default to `"0 0 24 24"` (the Lucide grid) and record a warning.
   `width`/`height` on `IconInfo` are the intrinsic size from the viewBox — they only feed the fallback; the rendered size always comes from the `Icon` props.

3. **Collect root paint attributes** onto `paint`, from a strict allowlist:
   `fill`, `stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `fill-rule`, `clip-rule`.
   Drop everything else on the root (`class`, `width`, `height`, `xmlns`, `id`, `data-*`, `style`). Dropping Lucide's `class="lucide lucide-sun"` matters — `Icon` owns the class name via its `xclass` prop.

4. **Extract the default fill.** If the root `fill` is a concrete colour (not `none`, not `currentColor`), also surface it as `icon.fill`, matching the existing `iconInfo.fill ?? "white"` semantics so a hand-coloured file icon keeps its colour while the `fill` prop can still override.

5. **Sanitize the inner markup.** Defence in depth — these files are developer-authored and inlined at build time, not user input, but a copy-pasted SVG from a random site should not be able to smuggle anything in:
   - Element allowlist: `path, circle, ellipse, line, polyline, polygon, rect, g, defs, linearGradient, radialGradient, stop, clipPath, mask, use, title, desc, symbol`.
   - Strip entirely (element **and** children): `script`, `style`, `foreignObject`, `image`, `a`, `animate*`, `set`.
   - Strip any `on*` attribute.
   - Strip `href` / `xlink:href` whose value does not start with `#`.
   - Strip `style` attributes containing `url(` or `expression(`.
   - Any element outside the allowlist is dropped with a recorded warning rather than failing the whole icon.

6. **Namespace internal IDs.** If the markup defines `id="a"`, rewrite it to `id="klive-icon-<name>-a"` and rewrite every matching `url(#a)`, `href="#a"`, `clip-path="url(#a)"` accordingly. Two gradient-bearing icons on screen at once would otherwise collide document-wide — a bug that only appears with a specific pair of icons visible, i.e. exactly the kind that reaches a release. Lucide does not need this; hand-made icons will.

7. Return `{ ok: true, icon }` or a `reason` string. Never throw: one bad file must not take down the renderer.

---

### Phase 3 — Loader, registry, provider, renderer

**`file-icon-defs.ts`** — glue, deliberately trivial:

```ts
import { parseSvgIcon } from "./svg-icon-parser";
import type { MarkupIconInfo } from "./theme";

const sources = import.meta.glob("../assets/icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true
}) as Record<string, string>;

export const fileIconLibrary: MarkupIconInfo[] = Object.entries(sources)
  .map(([filePath, text]) => {
    const name = filePath.split("/").pop()!.replace(/\.svg$/i, "");
    const parsed = parseSvgIcon(name, text);
    if (!parsed.ok) {
      console.warn(`[icons] Skipping ${filePath}: ${parsed.reason}`);
      return undefined;
    }
    return parsed.icon;
  })
  .filter(Boolean) as MarkupIconInfo[];
```

Also validate the ID shape here: warn (and skip) on names not matching `/^[A-Za-z0-9][A-Za-z0-9._-]*$/`, and warn on a name starting with `@`, which would collide with the `@name` image syntax in `Icon`.

**`icon-registry.ts`** — precedence, built once at module load:

```ts
import { iconLibrary } from "./icon-defs";
import { fileIconLibrary } from "./file-icon-defs";
import type { IconInfo } from "./theme";

const registry = new Map<string, IconInfo>();
for (const icon of iconLibrary) registry.set(icon.name, icon);

const shadowed: string[] = [];
for (const icon of fileIconLibrary) {
  if (registry.has(icon.name)) shadowed.push(icon.name);
  registry.set(icon.name, icon);          // file icons win
}
if (import.meta.env?.DEV && shadowed.length) {
  console.info(`[icons] File icons override stock icons: ${shadowed.join(", ")}`);
}

export const unknownIcon = registry.get("unknown");
export function lookupIcon(name: string): IconInfo | undefined {
  return registry.get(name) ?? unknownIcon;
}
export function listIconNames(): string[] {
  return [...registry.keys()].sort();
}
```

Free side benefit: `getIcon` stops being a linear `.find()` over ~90 entries on every icon render (185 call sites, re-rendered constantly) and becomes an O(1) `Map` lookup.

**`ThemeProvider.tsx`** — replace the two `.find()` chains for icons with `lookupIcon(key)`. Leave `getImage` exactly as it is; images are out of scope.

**`Icon.tsx`** — branch on `kind`. Keep the existing `fill` resolution (`--var` → theme property, else literal, else `iconInfo.fill ?? "white"`) unchanged, and feed the resolved colour to **`color`** so `currentColor` in the markup resolves to it:

```tsx
const iconInfo = theme.getIcon(iconName);
const fillValue = /* unchanged resolution */;

if (iconInfo.kind === "markup") {
  return (
    <svg
      className={xclass}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={iconInfo.viewBox}
      fill={iconInfo.paint.fill}
      stroke={iconInfo.paint.stroke}
      strokeWidth={iconInfo.paint["stroke-width"]}
      strokeLinecap={iconInfo.paint["stroke-linecap"] as any}
      strokeLinejoin={iconInfo.paint["stroke-linejoin"] as any}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        color: fillValue,          // ← currentColor resolves to the theme colour
        fillOpacity: opacity,
        strokeOpacity: opacity,    // ← stroke icons need this; fillOpacity alone does nothing
        transform: `rotate(${rotate ?? 0}deg)`,
        flexShrink: 0,
        flexGrow: 0,
        ...style
      }}
      dangerouslySetInnerHTML={{ __html: iconInfo.content }}
    />
  );
}
// ...existing single-path branch unchanged
```

Three details worth stating explicitly:

- The existing branch sets `style.fill = fillValue`. The markup branch must **not**, or Lucide's `fill="none"` gets overridden and every outline icon fills in solid. Colour reaches the markup through `color` + `currentColor` only.
- `opacity` currently maps to `fillOpacity` alone; a stroke icon ignores that entirely, so `strokeOpacity` has to be set too.
- The `@name` image branch stays ahead of both and is untouched.

---

### Phase 4 — Seed content and docs

- Add 2–3 real Lucide files to `src/renderer/assets/icons/` to exercise the path end to end — one pure-stroke multi-element icon (`sun.svg`), and one deliberately shadowing an existing stock name to prove precedence (e.g. `rocket.svg`, which exists in `icon-defs.ts`).
- Add `src/renderer/assets/icons/README.md`: filename = ID, flat folder only, overrides stock icons, `currentColor` recommended, `@`-prefixed names forbidden, and how to grab an icon from lucide.dev.
- Add a short section to [AGENTS.md](AGENTS.md) under the renderer notes pointing at the folder, so future agent sessions add an icon by dropping a file instead of editing `icon-defs.ts`.

---

## 7. Tests

New file `test/theming/svg-icon-parser.test.ts` (node project — no DOM, pure strings):

| Case | Assertion |
|---|---|
| Lucide `sun` fixture | `kind === "markup"`, `viewBox === "0 0 24 24"`, `paint.fill === "none"`, `paint.stroke === "currentColor"`, content contains both `<circle` and multiple `<path` |
| Root without `viewBox` but with `width`/`height` | synthesized `0 0 W H` |
| Root with neither | defaults to `0 0 24 24` |
| Root `fill="rgb(245,245,67)"` | surfaced as `icon.fill` |
| `class="lucide lucide-sun"` on root | absent from output |
| `<script>alert(1)</script>` in body | stripped |
| `onload="x()"` on a `<path>` | stripped |
| `<image href="http://…">` | stripped |
| `id="a"` + `url(#a)` | both rewritten to the namespaced ID |
| Non-SVG text | `{ ok: false }`, no throw |

New file `test/theming/icon-registry.test.ts` (node): a file icon overrides a same-named stock icon; an unknown name falls back to `unknown`; `listIconNames()` contains both stock and file names.

Extend [test/Icon.test.tsx](test/Icon.test.tsx) (jsdom):

- Rendering a seeded file icon produces an `<svg>` whose `stroke` is `currentColor` and whose inline `color` is the resolved theme colour.
- It contains more than one child element (the multi-element regression that a `d`-only implementation would fail).
- The existing three stock-icon tests still pass untouched — the regression gate for the union change.

Run: `npm test -- --project node test/theming/…` then `npm test -- --project jsdom test/Icon.test.tsx`.

---

## 8. Verification Checklist

1. `npx tsc --noEmit -p build/tsconfig.web.json` — clean.
2. `npm test -- --project node test/theming` and `npm test -- --project jsdom test/Icon.test.tsx` — green.
3. `npm run lint:renderer` — clean (renderer React code is touched).
4. `npx electron-vite build --config build/electron.vite.config.ts` — succeeds; the glob is import-analysed at build time, so a broken pattern surfaces here and not in dev.
5. Manual, in `npm run dev`: place a new `sun.svg`, refer to it from a toolbar button, confirm it renders, picks up the theme colour, and flips correctly between the light and dark themes.
6. Manual: confirm the shadowing seed icon (`rocket`) renders the *file* version, and that removing the file restores the stock one after a reload.
7. Sanity: `git grep -n "iconLibrary" src` shows no remaining direct consumers besides `icon-registry.ts`.

---

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `import.meta.glob` + `?raw` misbehaves under vitest | Registry untestable | Phase 0 spike settles it before any real code; parser and registry are testable with injected arrays regardless |
| Union `IconInfo` breaks an unseen consumer | Compile errors | `getIcon` has exactly one consumer today; `kind` is optional on the legacy variant so `icon-defs.ts` is untouched. Verified by step 1 of the checklist |
| Lucide icons render as filled blobs | Visually wrong icons | Root `fill="none"` is preserved and the markup branch never sets `style.fill`; covered by an explicit test and manual step 5 |
| Icons ignore the theme colour | Invisible icons on dark/light | Colour flows via `color` + `currentColor`; both themes checked manually in step 5 |
| Gradient/clip-path ID collisions between two icons | Rare, pair-dependent visual corruption | Per-icon ID namespacing in the parser (Phase 2, step 6) |
| Bundle growth | Larger renderer chunk | Lucide SVGs are ~0.3–0.6 KB each; dozens ≈ 20 KB of inlined text — negligible next to the existing base64 PNG stock in `image-defs.ts` |
| A malformed `.svg` breaks the renderer at import | White screen | Parser never throws; bad files are skipped with a `console.warn` and the icon falls back to `unknown` |
| Someone adds `foo.svg` in a subfolder and it silently does nothing | Confusion | Documented in the folder README; optionally add a dev-mode warn if `**/*.svg` finds files the flat glob missed |

---

## 10. Explicitly Out of Scope

- Migrating existing `icon-defs.ts` entries into files.
- File-based **images** (the `@name` / base64 PNG path in `image-defs.ts`).
- Runtime/user-supplied icon folders (loading SVGs from a project directory at runtime) — a different problem with real sanitization requirements, not just defence in depth.
- Generating a TypeScript union of valid icon IDs for compile-time checking of `iconName`.
- Per-theme icon variants (a `sun-light.svg` / `sun-dark.svg` convention).

---

## 11. Optional Follow-Ups

- `npm run icons:list` — a small script printing `listIconNames()`, useful when hunting for an existing ID.
- A dev-only "icon gallery" panel rendering every registered ID with its name, which makes both the stock and the file set browsable.
- Generated `export type IconId = "sun" | "rocket" | …` so a typo in `iconName` fails the type-check.
