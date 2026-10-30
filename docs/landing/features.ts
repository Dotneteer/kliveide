/**
 * The landing page's feature sections (decision D2), in priority order.
 *
 * `since` is the first release that ships the feature. The page shows the first five features
 * whose `since` is at most the latest release tag, so it never claims something a visitor cannot
 * download yet (R6). When a release ships a feature, it appears on the next docs build by itself.
 * The status per feature was checked against CHANGELOG.md on 2026-10-18; see the release-status
 * note in .plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md §4.
 *
 * `image` is either localized (`{ localized: "get-started/x.webp" }`, from the Get Started
 * screenshots) or a plain path under public/images.
 */
export type Feature = {
  id: string;
  since: string;
  image: { localized: string } | { path: string };
  /** The documentation page the feature heading links to: area and the rest of the path */
  more: { area: string; rest: string };
};

export const FEATURES: Feature[] = [
  {
    id: "allInOne",
    since: "0.1.0",
    image: { localized: "get-started/first-program.webp" },
    more: { area: "get-started", rest: "first-assembly-program/" }
  },
  {
    id: "basicDebug",
    since: "0.63.0",
    image: { localized: "get-started/basic-debug.webp" },
    more: { area: "guides", rest: "languages/zx-basic/" }
  },
  {
    id: "timeTravel",
    since: "0.64.0",
    image: { path: "working-with-ide/step-back-over.png" },
    more: { area: "guides", rest: "debugging/reverse-debugging/" }
  },
  {
    // --- `.plans/SPECTRUM_ACCURACY_DOCS_PLAN.md` Phase 3. The ULA accuracy work ships in the release
    // after 0.64.0; confirm this version when that release is prepared, so it never shows earlier (R6).
    id: "accuracy",
    since: "0.65.0",
    image: { path: "landing/accuracy-halt2int.webp" },
    more: { area: "under-the-hood", rest: "emulator-internals/spectrum-accuracy/" }
  },
  {
    id: "speaksNext",
    since: "0.61.0",
    image: { path: "landing/sprite-editor.webp" },
    more: { area: "guides", rest: "debugging/breakpoints/" }
  },
  {
    id: "testing",
    since: "0.64.0",
    image: { path: "working-with-ide/profiler-call-tree.png" },
    more: { area: "guides", rest: "testing/unit-tests/" }
  },
  {
    id: "disassembly",
    since: "0.61.0",
    image: { path: "working-with-ide/disass-branch-verdicts.png" },
    more: { area: "guides", rest: "debugging/disassembly/" }
  },
  {
    id: "nex",
    since: "0.61.0",
    image: { path: "landing/disassembly-scrollnutter.webp" },
    more: { area: "guides", rest: "debugging/run-debug/#running-a-nex-file-directly" }
  }
];

export const SHOWN_FEATURES = 5;

/**
 * The hero carousel's pictures, in order. Localized ones come from the Get Started screenshots;
 * the others from `scripts/doc-shots/recipes/landing.cjs` (ScrollNutter.nex on the Next). `caption`
 * is a key of docs/i18n/landing/<lang>.json.
 *
 * A slide with a `video` (a path under public/images) plays it, with `image` as its poster: the
 * reverse-debugging loop comes from `scripts/doc-shots/recipes/landing-reverse.cjs`, recorded with
 * Klive's own IDE + Emulator recording. It is the first slide, the page's signature
 * (.plans/HALLMARK_SITE_POLISH_PLAN.md, H9).
 */
export type HeroSlide = { image: Feature["image"]; video?: string; caption: string; width: number; height: number };

export const HERO_SLIDES: HeroSlide[] = [
  {
    image: { path: "landing/reverse-debugging.webp" },
    video: "landing/reverse-debugging.mp4",
    caption: "slide.reverse",
    width: 1440,
    height: 820
  },
  { image: { localized: "get-started/debug-paused.webp" }, caption: "slide.debug", width: 1800, height: 1153 },
  { image: { path: "landing/emulator-scrollnutter.webp" }, caption: "slide.emulator", width: 1440, height: 1184 },
  { image: { path: "landing/disassembly-scrollnutter.webp" }, caption: "slide.disassembly", width: 2200, height: 1375 },
  { image: { path: "landing/sprite-inspector.webp" }, caption: "slide.sprites", width: 2200, height: 1375 },
  { image: { path: "landing/copper-list.webp" }, caption: "slide.copper", width: 2200, height: 1375 },
  { image: { path: "landing/sprite-editor.webp" }, caption: "slide.spriteEditor", width: 2200, height: 1375 },
  { image: { localized: "get-started/basic-debug.webp" }, caption: "slide.basic", width: 1800, height: 1153 }
];
