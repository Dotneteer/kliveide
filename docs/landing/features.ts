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
  /** The documentation page "Read more" opens: area and the rest of the path */
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
    id: "speaksNext",
    since: "0.61.0",
    image: { path: "working-with-ide/bp-view.png" },
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
    image: { path: "working-with-ide/banked-disass-view.png" },
    more: { area: "guides", rest: "debugging/run-debug/#running-a-nex-file-directly" }
  }
];

export const SHOWN_FEATURES = 5;
