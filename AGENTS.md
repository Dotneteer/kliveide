# AGENTS.md

Guidance for AI assistants working in this workspace.

## Project Context

- This is `klive-ide`, an Electron shell application with React renderers.
- Renderer code lives mainly under `src/renderer`.
- Future and archived implementation plans live in `.plans/`.
- Human- and AI-readable implementation pattern docs live in `.docs/`; read the relevant docs before changing established patterns.
- Additional AI-oriented notes live in `.ai/`; read them before related work.

## Working Rules

- Preserve user changes in the dirty worktree. Do not revert unrelated files.
- Prefer focused, reviewable changes with tests around touched behavior.
- Use direct imports to the file that owns a component. Avoid compatibility wrapper files that only re-export moved components.
- For layout primitives, import from `@renderer/controls/layout/<ComponentFile>`.
- Keep legacy folders only for components that still genuinely live there.
- Run focused tests first, then `npm run build:check`; run `npm run lint:renderer` when touching renderer React code.
- After moving or deleting component files, scan both alias and relative imports, then run `npx electron-vite build --config build/electron.vite.config.ts` to catch Vite import-analysis errors.

## Documentation Site (`docs/`)

The docs site is a **separate npm package** with its own `package.json` and
`package-lock.json`. It is deliberately not an npm workspace: workspaces hoist,
which would force the Electron renderer and the docs site onto the same React
version. The Electron app stays on React 18; the docs site runs Nextra 4 +
React 19 + Next 16.

- Install its dependencies with `npm run doc:install`, not a root `npm ci`.
- Only `docs/content/` produces routes. `docs/authoring/` holds working notes
  that must stay off the public site.
- **`docs/package.json` must keep `--webpack` on `dev` and `build`.** Next 16
  defaults to Turbopack, which rejects Nextra's non-serializable `mdxOptions` -
  and those options are what register the custom `z80klive` Shiki grammar used
  by 436 code blocks. The flag does not exist before Next 16.
- Adding a code fence in a language not listed in `mdxOptions...langs` in
  `docs/next.config.mjs` **fails the build**: Shiki v3 throws on unregistered
  languages where 0.14 fell back to plain text.
- `docs/patches/` carries a one-line `patch-package` fix for
  `nextra-theme-docs@4.6.1`, whose `<Layout>` cannot render without it
  (upstream shuding/nextra#5036; fixed in an unpublished 4.6.2). When
  `patch-package` starts failing, the upstream fix has shipped - delete the
  patch and the `postinstall`.
- The deployment path is `NEXT_PUBLIC_BASE_PATH` (see `docs/.env.production`),
  never a hardcoded `/kliveide` and never keyed off `NODE_ENV`.

- **Screenshots can be generated rather than hand-captured.** `scripts/doc-shots/` launches
  Klive under Playwright's Electron driver, drives it through the IDE's own command prompt,
  and captures element-scoped PNGs — no manual cropping, no window chrome. Output stages to
  `.doc-shots/` for review; `DOC_SHOTS_OUT=docs/public/images` publishes. Read
  `.ai/doc-screenshots-guide.md` before using or extending it: it carries the command
  vocabulary, the settings-seeding that makes runs reproducible, and the fixture-project
  guard that keeps a recipe away from a real `~/KliveProjects` folder.

Verify a docs change with `npm run doc:build && npm run doc:check`, which
diffs routes and assets against `.plans/docs-*.golden.txt`, audits every
internal link, and asserts the Z80 syntax highlighting actually rendered. The
last of those exists because a lost grammar leaves every page present and
merely uncoloured, which no route diff can see.

## Current Useful Commands

- Type-check: `npm run build:check` - runs `scripts/check-types.cjs`, which type-checks both
  referenced projects and compares the result against `build/type-errors-baseline.json`. It fails
  on errors that are **new**, not on the backlog that accumulated while the command was a no-op
  (plain `tsc` on a solution-style root config resolves no inputs and exits 0). Clearing an entry
  from the baseline is a normal part of touching a file; run `npm run build:check -- --update` to
  record it. Raising a count needs a reason in the PR.
- Renderer hook lint baseline: `npm run lint:renderer`
- Focused jsdom tests: `npm test -- --project jsdom <test files>`
- Docs build: `npm run doc:build`
- Docs verification: `npm run doc:check`
- Docs preview at the production path: `npm run doc:serve`

## Icons

- To add an icon, drop an `.svg` file into `src/renderer/assets/icons/`. The file
  name is the icon ID (`sun.svg` -> `<Icon iconName="sun" />`). Do **not** hand-add
  entries to `src/renderer/theming/icon-defs.ts`; that array is the legacy stock.
- File icons override stock icons of the same name.
- Lucide icons can be saved verbatim: they paint with `currentColor`, which the
  `Icon` component wires to the theme colour.
- The folder's `README.md` documents the naming rules, the sanitizing, and the
  theming contract. `src/renderer/theming/svg-icon-parser.ts` is the parser and
  `icon-registry.ts` owns the override precedence.

## Theming, Tokens, And Shared UI Primitives

- Colour, spacing, type and motion come from the four token layers in
  `src/renderer/theming/tokens/` (L1 primitives -> L2 semantics -> L3 dimensions -> L4 legacy
  aliases). **Do not put a colour literal in a stylesheet or a component**; alias it at L4 or add it
  to L1/L2. The light theme is *derived*, not hand-copied.
- Data-dense panels build on `@renderer/controls/data` (`DataPanel`, `DataRow`, `DataLabel`,
  `PanelHeader`, `EmptyState`, `HexValue`, ...). `controls/layout`'s `Label`/`Value`/`Secondary`
  delegate to those and add only tooltip behaviour.
- Three rules have tests that will fail you: no `em` font sizes (M1), no px column widths - use `ch`
  (M2), and no component-private row-height constants - use `theming/tokens/rowSizes.ts` (M3).
- The Monaco syntax palette is mid-revision: **read `.plans/SYNTAX_PALETTE_REVISION_PLAN.md`**
  before changing `theming/tokens/syntax.ts`. It supersedes §8.1 of the modernization plan.
- **Any style, theming or visual change must update `.ai/ui-theming-intent-and-lessons.md` in the
  same change** — a standing instruction from the project author. Record the durable rule the change
  taught, not what happened: fold it into the existing sections, replace anything it supersedes, and
  keep no history. That file is how style decisions reach sessions that never saw the work.
- **Read `.ai/ui-theming-intent-and-lessons.md` before this kind of work.** It records the settled
  product decisions, how to run and visually inspect the app (CDP, the app menu, the
  `.plans/baseline/` scripts), and the failure modes this work already hit.
- Every accent has a **primary and a secondary hue** (`--accent-*` / `--accent-secondary-*`) — the
  secondary exists for two things in one view that must both read as accent-tied yet stay clearly
  apart (see the memory dump's hovered byte and disassembly's opcode column). The memory dump, the
  disassembly view **and the converted register/state panels** (Z80 CPU, ULA & I/O, Next Registers, Next Memory Mapping, Call Stack, Watch, Breakpoints — one shared
  `--color-state-value`) are the deliberate exceptions to the otherwise-neutral data hierarchy;
  unconverted panels stay neutral. Full detail in `.ai/ui-theming-intent-and-lessons.md` and
  `.plans/UI_MODERNIZATION_PLAN.md` §10.
- **A `DataRow` can contain another `DataRow`.** `Bit16Value`/`Bit8Value`/`SimpleValue`/`FlagValue`
  each render their own row for their label/value pair, so a register row is a row inside a row.
  Any horizontal padding put on the row primitive therefore lands *twice* on register rows and once
  on rows built from bare divs. See the alignment traps in `.ai/ui-theming-intent-and-lessons.md`.
- **Verify panel geometry in the running app, not in a standalone HTML replica.** A replica that
  omits one wrapper "proves" an alignment that is wrong on screen; this cost two failed rounds. Use
  the CDP recipe in `.ai/ui-theming-intent-and-lessons.md`.
- Type-check with `npx tsc --noEmit -p build/tsconfig.web.json`; tests need an explicit project
  (`--project=jsdom` or `--project='!perf'`) and the `build/vitest.config.ts` config.

## Notes For React Refactors

- Dialogs with async orchestration use a Model/Controller/View split so their behavior can be
  tested without rendering. Read `.ai/ui-mvc-guide.md` before adding or migrating one; the full
  pattern is in `.docs/dialog-mvc-pattern.md` and the reference implementation is
  `src/renderer/appIde/dialogs/sjasmplus/`.
- Fix conditional hook calls before tuning dependency arrays.
- Prefer extracting hooks/components over broad rewrites.
- When moving files, update consumers to the new direct path and delete the old file if it only re-exported the moved symbol.
