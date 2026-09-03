# Nextra 4 + Next.js 16 Documentation Migration Plan

**Status:** Phases 0-5 complete (2026-09-03); Phase 6 (Next 16) next
**Branch:** `dotneteer/update-nextra`
**Owner:** @dotneteer
**Created:** 2026-09-03

---

## 1. Executive summary

The `docs/` site is a **Nextra 3.3.0 / Next.js 15.5.5 / React 18.3.1** Pages-Router
site that shares the **root `package.json` of the Electron app**. Nextra 3 does not
run on Next.js 16, which is why commit `60431b1` had to pin `"next": "15.5.5"` in the
root `overrides` block right after Dependabot bumped `next` to `16.3.4` in `#1285`.

The target is **Nextra 4.6.1 + Next.js 16.3.4 + React 19**, which is the combination
the Nextra project itself ships and tests
(`examples/docs/package.json` on `shuding/nextra@main` declares `next: ^16.0.7`,
`react: 19.1.0`, and `"build": "next build --webpack"` —
<https://github.com/shuding/nextra/blob/main/examples/docs/package.json>).

Nextra 4 is not a version bump. It is an **App Router rewrite**: `pages/` becomes
`content/`, `theme.config.tsx` disappears, and FlexSearch is replaced by Pagefind.

The plan is deliberately ordered so that **GitHub Pages publishing is proven from
this branch in Phase 3 — before a single Nextra 4 change is made.** Everything after
that is a framework/content transformation validated against an already-working
publishing pipeline.

### The spine

| Phase | What | Framework at end of phase | Publishing proven? |
|---|---|---|---|
| 0 | ✅ Baseline + golden route snapshot | Nextra 3 / Next 15 / React 18 | — |
| 1 | ✅ Split `docs/` into its own npm package | unchanged | — |
| 2 | ✅ Parameterize `basePath`, kill hardcoded `/kliveide` | unchanged | — |
| 3 | ✅ **Preview deploy to GitHub Pages from this branch** | unchanged | ✅ **proven live** |
| 4 | ✅ Nextra 3 → 4 structural migration (Next 15, React 19) | Nextra 4 / Next 15 / React 19 | ✅ re-verified live |
| 5 | ✅ Pagefind search | Nextra 4 / Next 15 / React 19 | ✅ re-verified live |
| 6 | Next 15 → 16 | **Nextra 4 / Next 16 / React 19** | re-verified |
| 7 | Content sweep — the "entirely updated docs" pass | — | re-verified |
| 8 | Production cutover to `master` | — | ✅ live |
| 9 | Cleanup of root package + CI | — | — |

Phases 0–3 are pure infrastructure with **zero content risk** and can land as their own
PR. Phase 4 is the only large, irreversible-feeling step, and by the time it runs, the
deployment pipeline is already a known-good constant.

---

## 2. Current state (measured, not assumed)

### 2.1 Versions

| Package | Installed | Declared |
|---|---|---|
| `next` | 15.5.5 | root `overrides.next = "15.5.5"` (not a direct dep) |
| `nextra` | 3.3.0 | root `devDependencies` |
| `nextra-theme-docs` | 3.3.0 | root `devDependencies` |
| `react` / `react-dom` | 18.3.1 | root `devDependencies` (shared with the Electron renderer) |
| `shiki` | 0.14.7 | root `devDependencies` |
| Node (CI) | 22.x | `.github/workflows/*.yml` |

### 2.2 Layout

```
docs/
  next.config.mjs        11 KB — embedded Z80 TextMate grammar + custom Shiki theme
  theme.config.tsx       Nextra 3 DocsThemeConfig
  tsconfig.json          moduleResolution: "node", jsx: "preserve"
  declarations.d.ts, next-env.d.ts
  page-components/       ClickableImage.tsx + ClickableImage.module.scss + index.ts
  resources/icon.png
  public/images/**       102 tracked files
  pages/                 98 files: 81 .mdx, 7 .md, 7 _meta.ts, _app.tsx,
                         _mdx-components.tsx, custom.css
```

Content volume: **~141 000 words**, 8 sections
(`getting-started`, `working-with-ide`, `howto`, `z80-assembly`, `contribute`,
`scripting`, `book`, plus root pages).

### 2.3 What the content actually uses (this is the good news)

The MDX surface is remarkably uniform, which makes the migration far cheaper than the
file count suggests:

| Usage | Count | Migration impact |
|---|---|---|
| `import { Callout } from 'nextra/components'` | 50 files, 112 usages | **None** — `Callout` is still exported from `nextra/components` in 4.6.1 |
| `ClickableImage` (local component) | 30 files, 94 usages | Import path changes; component itself is replaceable by Nextra 4's built-in `ImageZoom` |
| Static image `import` (Next `Image`) | 5 usages | Path depth changes |
| Raw HTML in MDX | **0 files** | No `rehype-raw` concerns |
| Frontmatter | 12 files | Carries over |
| Mermaid / LaTeX | 0 | Not needed |

Code fences:

| Language | Blocks |
|---|---|
| `z80klive` (**custom grammar**) | **436** |
| `js` / `javascript` | 42 |
| `text` | 32 |
| `json` | 4 |
| `markdown`, `asm`, `typescript`, `jsx`, `bash` | 7 total |

> **The 436 `z80klive` blocks are the single highest-risk item in this migration.**
> They depend on a custom TextMate grammar registered through
> `mdxOptions.rehypePrettyCodeOptions.getHighlighter`, plus a custom Shiki theme.

### 2.4 Publishing today

`.github/workflows/deploy-doc.yml`:

- triggers on `push` to `master` only
- `npm ci` at the repo root, then `npm run doc:build && touch docs/out/.nojekyll`
- `JamesIves/github-pages-deploy-action@v4.6.4` → branch `gh-pages`, folder `docs/out`

GitHub Pages (`gh api repos/Dotneteer/kliveide/pages`):

```json
{"status":"built","html_url":"https://dotneteer.github.io/kliveide/",
 "build_type":"legacy","source":{"branch":"gh-pages","path":"/"},"https_enforced":true}
```

So: **legacy build, served from the `gh-pages` branch root, at the `/kliveide/` path.**
That single fact drives the whole preview strategy in Phase 3.

### 2.5 Known warts to fix along the way

1. **`_meta` routes leak into the static export.** The current build emits
   `out/_meta/`, `out/_mdx-components/`, `out/z80-assembly/_meta/`, etc. — Nextra 3 on
   the Pages Router turns those files into real routes. Nextra 4's `content/` dir
   removes this class of bug entirely.
2. **`/kliveide` is hardcoded in three places** —
   `next.config.mjs` (`basePath`/`assetPrefix`),
   `theme.config.tsx` (logo `src`),
   `page-components/ClickableImage.tsx` (`getAdjustedPath`).
   This makes a preview deploy at a different path impossible until Phase 2.
3. **`doc:build` has a side effect**: it rebuilds
   `_experiments/testprojects/next-examples.zip` and copies it into `docs/public/`.
   `docs/pages/book/flying-start.mdx` links to `/next-examples.zip`. This step must be
   preserved through every phase.
4. The custom highlighter registers only
   `javascript, typescript, json, html, bash, z80klive` — so `asm`, `jsx`, and
   `markdown` fences are currently unhighlighted. Worth fixing in Phase 7.

---

## 3. Key decisions, with evidence

### Decision 1 — Split `docs/` into its own npm package (Phase 1)

**Why this is the highest-leverage move in the plan.**

The root `package.json` serves the Electron app: `react@18.3.1`, `@monaco-editor/react`,
`@radix-ui/*`, `virtua`, `electron@43`. Nextra 4's *declared* peers are loose (`react: ">=18"`), but **Next.js 16 forces
React 19** — its App Router "uses the latest React Canary release, which includes the
newly released React 19.2 features"
(<https://nextjs.org/docs/app/guides/upgrading/version-16>). Nextra's own dev pin is
`react: 19.1.0`, and `nextra-theme-docs@4.6.1` ships `react-compiler-runtime@^19.1.0-rc.2`. Upgrading React across the Electron renderer to
unblock a docs site is a large, unrelated risk.

Isolating `docs/` as its own package with its own lockfile means:

- the Electron app keeps React 18 and is **completely untouched** by this migration;
- the docs site can move to React 19 / Next 16 / Nextra 4 freely;
- the root `overrides.next` pin can be deleted;
- the six `!node_modules/next*`, `!node_modules/nextra*` exclusions in the
  `electron-builder` `files` array become unnecessary;
- `npm ci` at the root gets meaningfully smaller and faster.

This is **not** an npm workspace. Workspaces hoist and would recreate the exact React
version conflict we are trying to eliminate. `docs/` gets a fully independent
`package.json` + `package-lock.json`.

### Decision 2 — Target Nextra **4.6.1**, not Nextra 5

`npm view nextra dist-tags` → `latest: 4.6.1`. The only 5.x on the registry is
`5.0.0-alpha.24`, and the registry metadata says that is an **accidental publish, not a
v5 line**: it was published between `4.3.0-alpha.23` and `4.3.0-alpha.24` (the latter
landing ~13 hours later with the same alpha counter), it has the **same
`unpackedSize` (388 856 bytes)** as its 4.3 sibling, it carries **no dist-tag**, no
README and no CHANGELOG, and nothing was ever published after it. There is no Nextra 5
feature set, announcement, or release note.

4.6.1 is the current stable and is what Nextra's own example app runs against Next 16.
Its CHANGELOG entry reads verbatim: *"update zod to v4 stable / fix compatibility with
Next.js 16"*, and `nextra@4.6.1`'s own devDependencies pin `next: ^16.0.7`,
`react: 19.1.0`, `react-dom: 19.1.0` — Nextra is developed and tested against exactly
our target stack. Maintainer `dimaMachina` closed
[issue #4830 "Support for next 16?"](https://github.com/shuding/nextra/issues/4830)
with *"Try nextra 4.6.1"*.

**Caveat to carry into Phase 4:** because 4.6.2 was never published, three merged
upstream fixes are **not** available on npm — the Pagefind basePath change, a
`LayoutPropsSchema` fix (see R11), and further Next 16 hardening. We are deliberately
adopting the newest *published* stable, not `main`.

### Decision 3 — Build with `next build --webpack` (and treat this as a **silent** failure mode)

Next.js 16 makes **Turbopack the default** for both `next dev` and `next build`
(verified against `next@16.3.4`: `next build --help` lists `--turbopack` *and*
`--webpack`; `next dev --help` lists the same).

Nextra's own docs are explicit that Turbopack cannot accept non-serializable options:

> "For this moment only JSON serializable values can be passed in `nextra` function.
> This mean that with Turbopack enabled you can't pass custom `remarkPlugins`,
> `rehypePlugins` or `recmaPlugins` since they are functions."
> — <https://github.com/shuding/nextra/blob/main/docs/app/docs/guide/turbopack/page.mdx>

Our `getHighlighter` **is** a function, and it is what registers the `z80klive`
grammar for 436 code blocks. Confirming the decision: Nextra's own example sets
`"build": "next build --webpack"`.

**Why this is worse than a normal config mistake.** Next 16 has a fatal guard that
stops the build when it finds a `webpack` config but no `turbopack` config
(`next@16.3.4/dist/lib/turbopack-warning.js`: `if (process.env.TURBOPACK === 'auto' &&
hasWebpackConfig && !hasTurboConfig) { Log.error(...); process.exit(1) }`).

That guard **will not save us.** Read from `nextra@4.6.1/dist/server/index.js`:

```js
const [nextMajorVersion, nextMinorVersion] = require('next/package.json').version.split('.', 2).map(Number)
const shouldUseConfigTurbopack = nextMajorVersion > 15 || (nextMajorVersion === 15 && nextMinorVersion > 2)
// ...
...(shouldUseConfigTurbopack && { turbopack }),
```

On Next 16, Nextra **itself sets a top-level `turbopack` key**, so `hasTurboConfig` is
true and the guard never fires. The build succeeds, and the custom grammar is simply
not applied — **436 code blocks lose their highlighting with no error, no warning, and
a green CI run.**

Therefore `--webpack` goes on **both** `dev` and `build` scripts, it is added in
Phase 4 (before Next 16 arrives), it is an explicit exit criterion in Phases 4 and 6,
and it gets written into `AGENTS.md` in Phase 9.

### Decision 4 — Preview deploys go to `gh-pages/preview/<branch>/`, never to the root

Pages is served from the `gh-pages` branch root, so there is no second branch we can
point a preview at. The preview therefore lives in a **subfolder** of the same branch:

- deploy with `target-folder: preview/update-nextra` and **`clean: false`**
- build with `NEXT_PUBLIC_BASE_PATH=/kliveide/preview/update-nextra`
- production deploys from `master` get `clean-exclude: preview/**` so they never
  wipe a preview

`clean: false` is chosen deliberately: the `JamesIves/github-pages-deploy-action`
README defines `clean` as deleting "files from your deployment destination that no
longer exist in your deployment source" but **does not document whether that scope is
the target folder or the whole branch**. Rather than gamble the live site on an
ambiguity, Phase 3 disables cleaning for previews and adds an explicit cleanup step.

### Decision 5 — Pagefind: verify the index location *and* the basePath behaviour

Nextra's search guide gives, for static exports:

```json
"postbuild": "pagefind --site .next/server/app --output-path out/_pagefind"
```

— <https://github.com/shuding/nextra/blob/main/docs/app/docs/guide/static-exports/page.mdx>

Note `--site` is `.next/server/app` in **both** the server and static-export recipes,
which is counterintuitive under `output: 'export'`. Nextra issue
[#3987](https://github.com/shuding/nextra/issues/3987) records users for whom
`_pagefind` did not land in `out/` and who needed
`... --output-path public/_pagefind && cp -r ./public/_pagefind ./out`.
**Phase 5 tests this rather than trusting it**, with two documented fallbacks.

Two further traps, both confirmed:

**(a) `postbuild` only fires via `npm run build`.** `npx next build` does not run npm
lifecycle scripts. If CI ever calls `next build` directly, search ships as an empty
index with no error. Our workflow calls `npm run doc:build`, which must chain through
to the docs package's `npm run build`.

**(b) The `baseUrl` question — evidence points both ways, so measure it.**
`nextra@4.6.1/dist/client/components/search.js` contains:

```js
window.pagefind = await import(addBasePath('/_pagefind/pagefind.js'))   // basePath-aware ✅
await window.pagefind.options({ baseUrl: '/' })                          // hardcoded ⚠
```

Pagefind's `baseUrl` is prepended to result URLs, so a hardcoded `/` looks wrong for a
site served at `/kliveide/`. **However**, reading further in the same file, results are
rendered as `ComboboxOption as={NextLink} href={subResult.url}` (line 416) and
navigated with `router.push(searchResult.url)` (line 232) — and both `next/link` and
the `next/navigation` router **apply `basePath` themselves**. With `baseUrl: '/'`,
Pagefind returns `/z80-assembly/pragmas/` and `next/link` renders
`/kliveide/z80-assembly/pragmas/`, which is correct. Setting `baseUrl` to the basePath
would arguably *double* it.

Upstream nevertheless merged
[PR #4885 "use addBasePath for Pagefind baseUrl"](https://github.com/shuding/nextra/pull/4885)
for release as **4.6.2 — which was never published to npm.** Nextra's release workflow
has been failing since 2025-12
([issue #5010](https://github.com/shuding/nextra/issues/5010)), stranding the Next 16
compatibility work, the Pagefind basePath fix, and a `LayoutPropsSchema` fix on `main`.

**Conclusion:** do not pre-emptively patch anything. Phase 5 has an explicit live
check of a search result link under the real `/kliveide/preview/...` path. If links
come back missing the prefix, the workaround is a thin client wrapper around `<Search>`
that re-calls `window.pagefind.options({ baseUrl })` — recorded as R6 below.

---

## 4. The phases

Each phase is a **separately committable, separately testable unit**. Do not start the
next phase until the current one's exit criteria are all green.

---

### Phase 0 — Baseline and golden snapshot

**Goal:** freeze a machine-checkable definition of "the docs site still works", so
every later phase can be diffed against it.

**Steps**

1. Confirm the current build is green:
   ```bash
   npm run doc:build
   ```
   (Verified on 2026-09-03: exits 0.)
2. Capture the **golden route list**:
   ```bash
   ( cd docs && find out -name '*.html' | sed 's|^out||' | sort ) > .plans/docs-routes.golden.txt
   ```
   Commit this file. Every phase diffs against it.
3. Capture a **golden asset list** the same way for `docs/out/images/**` and
   `docs/out/next-examples.zip`.
4. Add `scripts/check-docs-routes.mjs` that rebuilds the list and diffs it against the
   golden file, exiting non-zero on unexpected removals. Wire it as
   `npm run doc:check:routes`.
5. Add `scripts/serve-docs.mjs` (or just document `npx serve docs/out`) for local
   smoke testing under a path prefix.

**Exit criteria**

- [ ] `npm run doc:build` exits 0
- [ ] `.plans/docs-routes.golden.txt` committed, contains ~100 routes
- [ ] `npm run doc:check:routes` is green against a fresh build

**Note for Phase 4:** the golden list *intentionally* still contains the bogus
`_meta` / `_mdx-components` routes. Phase 4 removes them; that is the one expected
diff, and the golden file gets re-baselined at that point with a commit message
explaining why.

---

### Phase 1 — Isolate `docs/` into its own npm package

**Goal:** the docs site builds from `docs/` with its own dependency tree.
**No version changes yet** — Nextra 3.3.0, Next 15.5.5, React 18.3.1.

**Steps**

1. Create `docs/package.json`:
   ```json
   {
     "name": "klive-docs",
     "private": true,
     "version": "0.0.0",
     "scripts": {
       "dev": "next dev",
       "build": "next build",
       "start": "next start"
     },
     "dependencies": {
       "next": "15.5.5",
       "nextra": "3.3.0",
       "nextra-theme-docs": "3.3.0",
       "react": "18.3.1",
       "react-dom": "18.3.1"
     },
     "devDependencies": {
       "@types/react": "^18.3.0",
       "sass": "^1.75.0",
       "sharp": "^0.35.3",
       "shiki": "^0.14.7",
       "typescript": "^5.9.0"
     }
   }
   ```
   Pin exact versions here so Phase 4/6 bumps are explicit, reviewable diffs.

   > `typescript` is intentionally **not** `^6.0.2` here. The root pins TS 6 with
   > `ignoreDeprecations: "6.0"`; the docs package only needs TS for `next build`'s
   > type step and should not be coupled to the Electron app's compiler version.

2. Generate `docs/package-lock.json` (`cd docs && npm install`).

   > **Gotcha:** the root `.gitignore` line 32 is a bare `package-lock.json`, which
   > matches at any depth. The root lockfile is tracked only because it was
   > force-added. Add an explicit negation so the docs lockfile is not silently
   > dropped:
   > ```gitignore
   > !docs/package-lock.json
   > ```
   > Verify with `git check-ignore -v docs/package-lock.json` (must print nothing).

3. Rewrite the root scripts:
   ```json
   "doc:install": "cd docs && npm ci",
   "doc:dev":     "npm run doc:assets && cd docs && npm run dev",
   "doc:build":   "npm run doc:assets && cd docs && npm run build",
   "doc:assets":  "node scripts/build-doc-assets.cjs"
   ```
   Move the `next-examples.zip` shell pipeline out of the inline `doc:build` string
   and into `scripts/build-doc-assets.cjs` — it is currently an unreadable
   `&&`-chain and it is a hard dependency of `book/flying-start.mdx`.

4. Remove from the **root** `package.json`:
   - `devDependencies`: `nextra`, `nextra-theme-docs`, `shiki`
   - `overrides`: `"next": "15.5.5"` ← the pin this whole plan exists to remove
   - keep `react`, `react-dom`, `sass`, `sharp` (the Electron renderer uses them)

5. Simplify the `electron-builder` `files` array — drop
   `!node_modules/next/**/*`, `!node_modules/next*/**/*`,
   `!node_modules/nextra/**/*`, `!node_modules/nextra*/**/*`;
   add `!docs` and `!docs/**/*`.

6. Update `.github/workflows/deploy-doc.yml` to install docs deps:
   ```yaml
   - run: npm ci
   - run: npm run doc:install
   - run: npm run doc:build && touch docs/out/.nojekyll
   ```
   Add `cache-dependency-path: |` with both lockfiles to `actions/setup-node`.

7. Add `.github/dependabot.yml` with a second `npm` ecosystem entry for `/docs`,
   so the docs stack gets its own update stream instead of colliding with the
   Electron app's.

**Exit criteria**

- [ ] `rm -rf docs/node_modules && npm run doc:install && npm run doc:build` exits 0
- [ ] `npm run doc:check:routes` green — **byte-identical** to Phase 0 golden
- [ ] `rm -rf node_modules && npm ci && npm run build:check && npm run test:unit` green
- [ ] `npx electron-vite build --config build/electron.vite.config.ts` green
- [ ] `git check-ignore -v docs/package-lock.json` prints nothing
- [ ] `node_modules/next` no longer exists at the repo root

**Rollback:** revert the commit. Nothing outside `package.json`, `docs/package.json`,
`.gitignore` and the workflow changed.

---

### Phase 2 — Parameterize `basePath` and remove the hardcoded `/kliveide`

**Goal:** the site can be built for *any* deployment path. This is what makes a
preview deploy possible in Phase 3, and it is required regardless of Nextra version.

**Steps**

1. `docs/next.config.mjs`:
   ```js
   const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
   // ...
   basePath,
   assetPrefix: basePath ? `${basePath}/` : ''
   ```
   Replace both `process.env.NODE_ENV === "production" ? "/kliveide" : ""` ternaries.
   Deployment path is a **deployment** concern, not a `NODE_ENV` concern — the current
   coupling is precisely why a preview at a different path cannot work today.

2. `docs/theme.config.tsx` — logo `src`:
   ```tsx
   src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/images/klive-logo.svg`}
   ```

3. `docs/page-components/ClickableImage.tsx` — `getAdjustedPath()`:
   replace the `isProduction ? '/kliveide' : ''` logic with
   `process.env.NEXT_PUBLIC_BASE_PATH ?? ''`.

   > `NEXT_PUBLIC_`-prefixed vars are inlined into the client bundle by Next.js, so
   > this works in both the server render and the browser. Keep the prefix.

4. Add `docs/.env.production` containing `NEXT_PUBLIC_BASE_PATH=/kliveide` so a plain
   `npm run doc:build` still produces the production site by default and nobody has to
   remember an env var.

5. Grep for stragglers:
   ```bash
   grep -rn "kliveide" docs --include='*.tsx' --include='*.ts' --include='*.mjs' \
     --include='*.mdx' --include='*.css' | grep -v 'github.com'
   ```

**Exit criteria**

- [ ] `npm run doc:build` (default) → identical routes **and** identical
      `/kliveide/...` asset URLs to Phase 1
- [ ] `NEXT_PUBLIC_BASE_PATH=/kliveide/preview/x npm run doc:build` produces a site
      whose HTML references `/kliveide/preview/x/...` for CSS, JS, the logo, and
      `ClickableImage` targets
- [ ] Serving that build under a matching path prefix locally renders correctly:
      logo visible, images load, in-page nav works, no 404s in the console

---

### Phase 3 — Prove GitHub Pages publishing from this branch ⭐

**This is the milestone the whole ordering exists to reach early.** Still Nextra 3,
still Next 15 — so any failure here is unambiguously a *pipeline* problem, never a
framework problem.

#### 3a — CI build, zero deployment risk

Add `.github/workflows/deploy-doc-preview.yml`:

```yaml
name: GitHub Pages preview deploy

on:
  workflow_dispatch:
  push:
    branches: [dotneteer/update-nextra]

concurrency:
  group: docs-preview-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  preview:
    runs-on: ubuntu-latest
    env:
      PREVIEW_PATH: preview/update-nextra
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          cache: npm
          cache-dependency-path: |
            package-lock.json
            docs/package-lock.json
      - run: npm ci
      - run: npm run doc:install
      - run: npm run doc:build
        env:
          NEXT_PUBLIC_BASE_PATH: /kliveide/${{ env.PREVIEW_PATH }}
      - run: touch docs/out/.nojekyll
      - uses: actions/upload-artifact@v4
        with:
          name: docs-preview
          path: docs/out
```

Push, confirm the artifact builds and downloads. **Nothing has touched `gh-pages` yet.**

#### 3b — Deploy to the preview subfolder

Append to the same job:

```yaml
      - name: Deploy preview 🚀
        uses: JamesIves/github-pages-deploy-action@v4.6.4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          branch: gh-pages
          folder: docs/out
          target-folder: ${{ env.PREVIEW_PATH }}
          clean: false
          commit-message: "docs preview: ${{ github.sha }}"
```

> `clean: false` is **load-bearing**, not laziness — see Decision 4. Confirm after the
> first run that `git ls-tree origin/gh-pages` still contains every production path.

#### 3c — Ensure `.nojekyll` sits at the branch root

GitHub Pages' legacy Jekyll build **strips paths beginning with `_`** — which would
silently delete `_next/` and, later, `_pagefind/`. The current workflow creates
`docs/out/.nojekyll`, which lands at the `gh-pages` root only because production
deploys to the root. A preview deploying into a subfolder puts it at
`preview/update-nextra/.nojekyll`, which does **not** disable Jekyll for the branch.

Add an explicit guard step before deploying:

```yaml
      - name: Ensure root .nojekyll on gh-pages
        run: |
          git fetch origin gh-pages --depth=1
          git ls-tree --name-only origin/gh-pages | grep -qx '.nojekyll' \
            || echo "::error::gh-pages is missing a root .nojekyll"
```

If it is missing, add it once via a one-off root deploy with `clean: false`.

#### 3d — Harden the production workflow

In `.github/workflows/deploy-doc.yml`, add to the deploy step:

```yaml
          clean-exclude: |
            preview/**
```

so a `master` deploy can never wipe an in-flight preview.

#### 3e — Verify live

Browse **<https://dotneteer.github.io/kliveide/preview/update-nextra/>** and check:

- [ ] home page renders with CSS and the Klive logo
- [ ] sidebar navigation works; deep link to `/z80-assembly/pragmas/` works
- [ ] a `ClickableImage` renders **and** its click-through opens the full image
- [ ] `z80klive` code blocks are syntax-coloured (baseline for Phase 4 comparison)
- [ ] `/next-examples.zip` downloads
- [ ] FlexSearch search returns results (this is the Nextra 3 baseline; Phase 5
      replaces it)
- [ ] **<https://dotneteer.github.io/kliveide/> is completely unchanged**
- [ ] no 404s in DevTools Network for `_next/*`

**Exit criteria**

- [ ] all of 3e green
- [ ] production site verified untouched
- [ ] a second push to the branch redeploys the preview cleanly

> **From here on, every subsequent phase re-runs this checklist.** That is the payoff:
> the publishing pipeline becomes a fixed, trusted constant while the framework moves.

---

### Phase 4 — Nextra 3 → 4 structural migration

The big one. Still on **Next 15.5.5** — only Nextra and React move. Splitting Nextra 4
and Next 16 into two phases means a failure has one obvious cause.

Reference: <https://the-guild.dev/blog/nextra-4> and
<https://github.com/shuding/nextra/tree/main/examples/docs>.

#### 4.1 — Dependencies

In `docs/package.json`:

```diff
-  "next": "15.5.5",
+  "next": "15.5.5",
-  "nextra": "3.3.0",
-  "nextra-theme-docs": "3.3.0",
-  "react": "18.3.1",
-  "react-dom": "18.3.1"
+  "nextra": "4.6.1",
+  "nextra-theme-docs": "4.6.1",
+  "react": "19.1.0",
+  "react-dom": "19.1.0"
```
devDependencies: `@types/react` → `^19`, `@types/react-dom` → `^19`,
`shiki` → `^3.2.1`, add `pagefind` → `^1.3.0`.

Also set `docs/tsconfig.json` → `"moduleResolution": "bundler"` (required by Nextra 4)
and `"jsx": "preserve"` stays.

#### 4.2 — File restructure

```bash
cd docs
git mv pages content
mkdir -p app/'[[...mdxPath]]'
git rm content/_app.tsx content/_mdx-components.tsx
git mv content/custom.css app/custom.css
git rm ../docs/theme.config.tsx     # after 4.3 has ported it
```

`docs/mdx-components.tsx` (project root of the docs package):

```tsx
import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs'
import ClickableImage from './page-components/ClickableImage'

const docsComponents = getDocsMDXComponents()

export const useMDXComponents = components => ({
  ...docsComponents,
  ClickableImage,
  ...components
})
```

> Registering `ClickableImage` globally here lets Phase 4.6 delete **94 per-file
> imports** instead of rewriting their relative depths.

`docs/app/[[...mdxPath]]/page.tsx` — verbatim from the official example
(<https://github.com/shuding/nextra/blob/main/examples/docs/src/app/docs/%5B%5B...mdxPath%5D%5D/page.jsx>),
with the import depth adjusted:

```tsx
import { generateStaticParamsFor, importPage } from 'nextra/pages'
import { useMDXComponents as getMDXComponents } from '../../mdx-components'

export const generateStaticParams = generateStaticParamsFor('mdxPath')

export async function generateMetadata(props) {
  const params = await props.params
  const { metadata } = await importPage(params.mdxPath)
  return metadata
}

const Wrapper = getMDXComponents().wrapper

export default async function Page(props) {
  const params = await props.params
  const { default: MDXContent, toc, metadata, sourceCode } =
    await importPage(params.mdxPath)
  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
      <MDXContent {...props} params={params} />
    </Wrapper>
  )
}
```

#### 4.3 — `theme.config.tsx` → `app/layout.tsx`

Verified against the actual `LayoutProps` in
`nextra-theme-docs@4.6.1/dist/types.generated.d.mts`:

| Nextra 3 `theme.config` | Nextra 4 |
|---|---|
| `logo` | `<Navbar logo={…} />` |
| `project.link` | `<Navbar projectLink={…} />` |
| `docsRepositoryBase` | `<Layout docsRepositoryBase>` |
| `footer.content: null` | `<Layout footer={null}>` |
| `head` | Next.js `export const metadata` + `<Head />` from `nextra/components` |
| `sidebar.defaultMenuCollapseLevel`, `.toggleButton` | `<Layout sidebar={{…}}>` — same keys |
| `toc.backToTop: true` | `<Layout toc={{ backToTop: … }}>` — ⚠️ now a **`ReactNode`**, not a boolean; pass a label like `'Scroll to top'` |
| `search.placeholder` | `<Layout search={<Search placeholder="…" />}>` — now a **node** |
| `editLink.component: null` | `<Layout editLink={null}>` |
| `feedback.content: null` | `<Layout feedback={{ content: null }}>` |

`app/layout.tsx` also owns the CSS imports that `_app.tsx` used to:

```tsx
import 'nextra-theme-docs/style.css'
import './custom.css'
```

#### 4.4 — `next.config.mjs`

- **Delete** `theme: "nextra-theme-docs"` and `themeConfig: "./theme.config.tsx"`.
  `NextraConfigSchema` in 4.6.1 is a **strict** Zod object — unknown keys throw.
  (Verified in `nextra@4.6.1/dist/server/schemas.d.ts`: the schema accepts
  `defaultShowCopyCode, search, staticImage, readingTime, latex, codeHighlight,
  mdxOptions, whiteListTagsStyling, contentDirBasePath, unstable_shouldAddLocaleToLinks`
  — and nothing else.)
- **Keep** the whole `z80Language` grammar object and `customTheme` object as-is.
- **Port the highlighter to Shiki v3**: `getHighlighter` is removed in Shiki 1+;
  the replacement is `createHighlighter`.
  ```js
  import { createHighlighter } from 'shiki'   // NOT getHighlighter — removed in shiki 2
  // ...
  rehypePrettyCodeOptions: {
    theme: { myTheme: customTheme },
    getHighlighter: options => createHighlighter({ ...options, langs: [ /* … */ ] })
  }
  ```
  Two renames to apply, both verified against `shiki@3`'s `dist/index.d.mts` (which
  exports **neither** old name): `getHighlighter` → `createHighlighter`
  (<https://shiki.style/blog/v2>) and `BUNDLED_LANGUAGES` → `bundledLanguages`
  (<https://shiki.style/guide/migrate>). Note the *option key* stays
  `getHighlighter` — that name belongs to `rehype-pretty-code@0.14.1`, whose
  `Options` type still declares
  `getHighlighter?(options): Promise<Highlighter>` and which peer-depends on
  `shiki: ^1 || ^2 || ^3`. Only the imported function changes.
  `mdxOptions.rehypePrettyCodeOptions` **still exists** in Nextra 4 — confirmed in the
  schema and documented at
  <https://github.com/shuding/nextra/blob/main/docs/app/docs/guide/syntax-highlighting/page.mdx>
  ("Custom grammar" / "Custom themes" sections).
- Keep `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true`,
  the `basePath`/`assetPrefix` from Phase 2, the `.tmLanguage.json` webpack rule, and
  `eslint.ignoreDuringBuilds`.
- Add `"build": "next build --webpack"` and `"dev": "next dev --webpack"` to
  `docs/package.json` (see Decision 3). On Next 15 the flag is a harmless no-op;
  adding it now means Phase 6 is a pure version bump.

#### 4.5 — `_meta.ts` files

All seven move with the content (`git mv pages content` already did it). Verified in
the 4.6.1 schema: `display: 'hidden' | 'normal' | 'children'` is still supported, so
`book: { display: "hidden" }` in `content/_meta.ts` carries over unchanged — `/book/`
stays reachable by URL, just hidden from the sidebar. No edits expected.

Things to check while you are in there:

- `_meta` files must be **server components** — no `'use client'`. Ours are plain
  object exports, so fine.
- **Removed fields:** `newWindow`, `theme.topContent`, `theme.bottomContent`,
  `theme.layout: 'raw'`. External links now open in a new tab with an ↗ icon
  automatically. We use none of these.
- **New in v4:** `type: 'page'` promotes an item to the *navbar* rather than the
  sidebar. Worth considering in Phase 7 for `commands-reference` / `machine-types`.
- **Sidebar title resolution changed** to: `_meta` title → `sidebarTitle` front matter
  → `title` front matter → **first `# h1` heading (new)** → filename. Our `_meta.ts`
  files set titles explicitly, so they still win — but pages *not* listed in a `_meta`
  (all 32 under `content/book`) will now take their label from their `# h1` instead of
  the filename. Expect the `book` sidebar labels to change; that is an improvement, but
  verify it.
- **Do not mix** `_meta.global` with per-folder `_meta` files. We stay with per-folder.
- Folders that have an index page now need `asIndexPage: true` in that page's front
  matter. Check `book.mdx` vs the `book/` folder, which is exactly this shape.

⚠ **Front matter and `export const metadata` are now mutually exclusive** in a single
MDX file — front matter is compiled *into* `metadata`. Our 12 front-matter files
declare no `metadata` export, so no conflict, but grep to confirm.

#### 4.6 — MDX import cleanup (scripted)

```bash
cd docs/content
# ClickableImage is now global via mdx-components.tsx
grep -rl "page-components" . | xargs sed -i '' \
  -e "/^import ClickableImage from '.*page-components\/ClickableImage'$/d" \
  -e "/^import { ClickableImage } from '.*page-components'$/d"
```
Then fix the 5 static image imports (`../../public/images/...`) — depth is unchanged by
`pages`→`content`, so these should need no edit; verify by grep.

`import { Callout } from 'nextra/components'` — **leave alone**, still valid in 4.6.1.

#### 4.7 — SCSS module

`ClickableImage.module.scss` works in the App Router, but confirm `sass` is in
`docs/devDependencies` and that the component needs no `'use client'` (it has no hooks
and no event handlers beyond a plain `<a href>`, so it stays a server component).

#### 4.8 — Build and diff

```bash
cd docs && npm run build
npm run doc:check:routes
```

**Expected, intentional diff vs. the Phase 0 golden:** the `_meta` and
`_mdx-components` routes disappear. Re-baseline `.plans/docs-routes.golden.txt` in this
commit and say so in the message. **Any other route change is a regression.**

**Exit criteria**

- [ ] `npm run doc:build` exits 0 with `--webpack`
- [ ] route diff contains *only* the `_meta` / `_mdx-components` removals
- [ ] spot-check 10 pages across all 8 sections: headings, sidebar position, TOC
- [ ] **all 436 `z80klive` blocks still coloured** — check `z80-assembly/pragmas`,
      `z80-assembly/macros`, and `book/06-zxndma` specifically
- [ ] all 112 `Callout`s render with the right variant
- [ ] all 94 `ClickableImage`s render and click through
- [ ] `book` section still hidden from the sidebar but reachable at `/book/`
- [ ] Phase 3e checklist re-run against a fresh preview deploy

---

### Phase 5 — Pagefind search

Nextra 4 dropped FlexSearch. Without this phase the site builds and renders but the
search box is dead.

**Steps**

1. `docs/package.json`:
   ```json
   "postbuild": "pagefind --site .next/server/app --output-path out/_pagefind"
   ```
   > **Verify, do not assume** (see Decision 5). Confirm `.next/server/app` actually
   > contains prerendered `.html` under `output: 'export'` on Next 16. Fallbacks, in
   > order of preference:
   > 1. `pagefind --site out --output-subdir _pagefind` — index the export directly
   > 2. `pagefind --site .next/server/app --output-path public/_pagefind && cp -r public/_pagefind out/_pagefind`
   >    — the workaround from [#3987](https://github.com/shuding/nextra/issues/3987)
   >
   > Both `--output-path` and `--output-subdir` confirmed present in `pagefind --help`.

   ⚠ **`postbuild` only runs via `npm run build`, never `npx next build`.** Confirm the
   root `doc:build` → docs `npm run build` chain is intact, or search silently ships an
   empty index. Assert `docs/out/_pagefind/pagefind-entry.json` exists in CI.

2. Add `--include-characters` for Z80 syntax so `#8000`, `$FFFF`, `.defb` and `%1010`
   are searchable:
   ```
   pagefind --site out --output-subdir _pagefind --include-characters '#$.%'
   ```

3. Wire `<Search>` into `app/layout.tsx` (`nextra/components` export confirmed in
   4.6.1), carrying over the old `placeholder: "Search documentation..."`.

4. `.gitignore`: `_pagefind/` (already covered transitively by the `out` rule, but be
   explicit).

5. Re-confirm the root `.nojekyll` from Phase 3c — **`_pagefind` starts with an
   underscore and Jekyll would delete it.** This is the most likely "works locally,
   broken on Pages" failure in the entire plan.

**Exit criteria**

- [ ] `docs/out/_pagefind/pagefind.js` exists after a build
- [ ] local serve under a `/kliveide/preview/...` prefix: search returns results and
      clicking one navigates correctly (this validates the
      `addBasePath` + `baseUrl: "/"` + `next/link` interaction from Decision 5)
- [ ] **preview deploy: click an actual search result and confirm it navigates, not
      404s.** This is the R6 / Decision 5 check — inspect the rendered `href` and
      confirm it carries the `/kliveide/preview/...` prefix exactly once
- [ ] searching `defb`, `nextreg`, `ZX Spectrum Next` returns sensible hits
- [ ] search box is absent/graceful in `next dev` (expected — Pagefind indexes built
      HTML; Nextra shows an explanatory notice)

---

### Phase 6 — Next.js 15 → 16

With Nextra 4 proven on Next 15, this becomes a small, isolated bump.

**Steps**

1. `docs/package.json`: `"next": "16.3.4"`.
2. Confirm `--webpack` is on both `dev` and `build` (added in 4.4). **Re-read
   Decision 3** — on Next 16 this failing is silent, not loud.
3. **Node ≥ 20.9.0** is a hard floor in Next 16 (Node 18 is unsupported; TypeScript
   5.1+). CI is already on 22.x; add `"engines": { "node": ">=20.9" }` to
   `docs/package.json`. Note this overrides Nextra's own looser `node >=18`.
4. **Remove `eslint: { ignoreDuringBuilds: true }` from `next.config.mjs`.** Next 16
   removed `next lint` *and* the `eslint` key from the config; `next build` no longer
   lints at all, so the option is dead and may be rejected.
   (<https://nextjs.org/docs/app/guides/upgrading/version-16>)
5. Async request APIs: synchronous `params`/`searchParams` access is **fully removed**.
   Our catch-all already `await`s `props.params`, so it is compliant — but run
   `npx @next/codemod@canary next-async-request-api docs/` to be sure nothing else
   slipped in.
6. Confirm the `turbopack` top-level key Nextra injects does not conflict with anything
   we set (Next 16 moved `experimental.turbopack` → top-level `turbopack`).
7. Non-issues, checked so nobody re-litigates them: **`basePath`, `assetPrefix` and
   `trailingSlash` are unchanged in Next 16** — the bundled `version-16.md` in the
   `next@16.3.4` tarball mentions none of the three, and does not mention
   `output: 'export'` either. AMP removal, `serverRuntimeConfig`/`publicRuntimeConfig`
   removal, `middleware` → `proxy`, and the image-config changes
   (`images.qualities`, `minimumCacheTTL`, `localPatterns.search`) do not apply to us —
   we set `images.unoptimized: true`.
8. Delete `docs/next-env.d.ts`'s stale
   `/// <reference path="./.next/types/routes.d.ts" />` if Next 16 regenerates it
   differently — let `next build` rewrite the file and commit the result.

**Exit criteria**

- [ ] `npm run doc:build` exits 0 on Next 16.3.4
- [ ] route list unchanged from Phase 5
- [ ] **`npm run doc:check:highlighting` green** — this is what `--webpack`
      protects, and the only guard against R1's silent failure
- [ ] Pagefind index still produced at the same path
- [ ] full Phase 3e checklist green on a preview deploy
- [ ] root `npm ci` no longer resolves any `next` package

---

### Phase 7 — Content sweep ("entirely updated documentation")

Now that the framework is stable, do the content work Nextra 4 unlocks.

1. **Replace `ClickableImage` with Nextra 4's built-in `ImageZoom`.**
   `ImageZoom` is exported from `nextra/components` in 4.6.1 and gives proper zoom
   instead of a new-tab link. This **deletes the entire `getAdjustedPath` basePath
   hack** — the last hand-rolled basePath logic in the repo. ~94 usages; scriptable.
   Do this as its own commit so it can be reverted independently.

2. **Convert images to static imports** so Next.js handles `basePath`, dimensions, and
   `srcset` (`staticImage` defaults to `true` in Nextra 4). Removes another whole class
   of broken-image-on-Pages bug.

3. **Add an `_meta.ts` for `content/book`** — its 32 chapters currently fall back to
   alphabetical ordering, which is why `app-A`…`app-E` sort after `22-game` but
   `flying-start`, `introduction`, `preface` land at the end. Explicit ordering fixes
   the reading sequence.

4. **Consistent frontmatter** (`title`, `description`) on all 88 content pages —
   drives `generateMetadata`, improves Pagefind result snippets and OG tags.

5. **Fix code-fence coverage**: register `asm`, `jsx`, `markdown`, `text` in the
   highlighter `langs`, or let Shiki's bundled languages through. Currently only 6
   languages are registered, so a handful of blocks render unhighlighted.

6. **Consider `Callout` → GitHub alert syntax.** Nextra 4 ships `withGitHubAlert`, so
   `> [!NOTE]` renders as a callout with no import. That would let 50 files drop their
   `import { Callout }` line and render correctly on GitHub too. Optional — 112
   usages — decide based on appetite.

7. **Link + image audit** across all 98 pages. Add `scripts/check-docs-links.mjs`
   walking `docs/out/**/*.html` for internal `href`/`src` targets that do not exist on
   disk, and wire it into CI.

8. Verify the `book` download flow end to end: `doc:assets` → `next-examples.zip` →
   `book/flying-start.mdx` link.

**Exit criteria**

- [ ] link checker reports zero broken internal links or images
- [ ] `page-components/` deleted (if step 1 is taken)
- [ ] no `kliveide` string remains in `docs/` outside GitHub URLs and `.env.production`
- [ ] visual pass over all 8 sections on the preview deploy

---

### Phase 8 — Production cutover

1. Update `.github/workflows/deploy-doc.yml`: `npm run doc:install` step present,
   `NEXT_PUBLIC_BASE_PATH=/kliveide`, `clean-exclude: preview/**` retained.
2. Merge the branch to `master`.
3. Watch the deploy; verify <https://dotneteer.github.io/kliveide/> against the full
   Phase 3e checklist.
4. Remove the preview folder from `gh-pages` and disable the branch trigger in
   `deploy-doc-preview.yml` (keep `workflow_dispatch` — it is genuinely useful for the
   next migration).

---

### Phase 9 — Cleanup

- [ ] Confirm root `package.json` has no `next`/`nextra`/`shiki` and no `overrides.next`
- [ ] Confirm `electron-builder` `files` no longer needs the `next*`/`nextra*` excludes
- [ ] Confirm the produced Electron artifact size did not grow
- [ ] `.github/dependabot.yml` covers `/docs`
- [ ] Update `AGENTS.md` with the docs-package split and the `--webpack` requirement
      (a future contributor *will* drop that flag otherwise)
- [ ] Archive this plan with an outcome note

---

## 4b. Execution log — Phases 0-3 (2026-09-03)

Branch `dotneteer/update-nextra`, commits `baedccb` … `59075e1`.

**Live preview: <https://dotneteer.github.io/kliveide/preview/update-nextra/>**

### Verified

- Production site untouched across **two** preview deploys: `git ls-tree -r` on
  `gh-pages` shows **0 production paths removed**, and every added path is under
  `preview/update-nextra/`. `https://dotneteer.github.io/kliveide/` still 200s.
- Golden snapshots byte-identical through Phases 1 and 2 (91 routes, 102 assets).
- Preview build rewrites `basePath` correctly in all three formerly-hardcoded
  places (CSS/JS, logo, `ClickableImage` targets) with no stray bare `/kliveide/`.
- All 69 assets referenced by the preview home page resolve; `_next/` survives
  Jekyll (root `.nojekyll` was already present on `gh-pages`).
- Custom `z80klive` grammar and theme render live — `.org` `#C586C0`, `ld`
  `#569CD6` bold, `#6000` `#4D8061`, matching `customTheme` exactly.
- **Nextra 3 search baseline captured** for the Phase 5 Pagefind comparison:
  the FlexSearch index loads from
  `…/preview/update-nextra/_next/static/chunks/nextra-data-en-US.json` (200), a
  query returns results, and result `href`s carry the full preview basePath
  **exactly once** (`/kliveide/preview/update-nextra/z80-assembly/z80-assembler/`).
  Phase 5 must reproduce this with Pagefind — see R6.
- Electron app unaffected: `build:check`, 18 938 unit tests, and
  `electron-vite build` all green. Root lockfile shrank 27 868 → 18 058 lines.

### Findings not anticipated by the plan

1. **`docs/tsconfig.json` carried `ignoreDeprecations: "6.0"`**, valid only under
   the root's TypeScript 6. The first isolated build failed with
   *"Invalid value for '--ignoreDeprecations'"*. Removed — exactly the hidden
   coupling Phase 1 exists to break. Phase 4 rewrites this file anyway
   (`moduleResolution: "bundler"`).
2. **A route/asset diff cannot detect lost syntax highlighting.** R1's failure
   mode leaves every page present and merely uncoloured. Added
   `scripts/check-docs-highlighting.cjs`, which counts rendered token colours and
   fails below 80 % of baseline (2154 keyword / 1372 pragma / 1579 numeric /
   1968 identifier / 1157 comment / 387 string spans across 31 pages).
   Negative-tested by stripping colours from a build. Now `npm run doc:check`
   (routes + assets + highlighting) in both workflows. **This becomes the
   load-bearing exit criterion for Phase 6.**
3. **Preview deploys accumulate stale files.** `clean: false` is required for
   safety (Decision 4), so each redeploy leaves the previous build's hashed
   `_next/` chunks behind — `gh-pages` went 310 → 620 → 710 files over two
   deploys. Harmless to serving, but Phase 8 should delete
   `preview/update-nextra/` wholesale at cutover rather than assume it self-cleans.

### Deviations from the plan as written

- Checker scripts are `.cjs`, not `.mjs`, to match the existing `scripts/`
  convention.
- Phase 3d (`clean-exclude: preview/**` on production) landed early, in Phase 1,
  since that workflow was already being edited.
- Added `@types/react-dom` to the docs package (the plan listed only
  `@types/react`).

---

## 4c. Execution log — Phase 4 (2026-09-03)

Commit `e7ebb44`. Live: <https://dotneteer.github.io/kliveide/preview/update-nextra/>

Now on **Nextra 4.6.1 + React 19.1 + Next 15.5.5**. Route diff vs the Phase 0
golden is exactly one removal — `/_mdx-components/`, the bogus page Nextra 3
made of the dummy component file — so the golden is re-baselined at 90 routes.

### Four upstream incompatibilities, none fully predicted

1. **R11 hit, and it is worse than "a bug": `<Layout>` in 4.6.1 cannot render at
   all.** Upstream [#5036](https://github.com/shuding/nextra/issues/5036) — the
   compiled component rest-destructures `children` out of props *before*
   validating the remainder against `LayoutPropsSchema`, where `children` is
   required, so Zod always sees a missing key. Every page 500s regardless of
   usage. Fixed upstream for 4.6.2, which R13 means was never published.
   Applied the documented workaround with **patch-package**
   (`patches/nextra-theme-docs+4.6.1.patch`, one line,
   `children: reactNode` → `children: reactNode.optional()`), wired as a
   `postinstall`. Chosen over a sed script precisely because it will **fail
   loudly** when 4.6.2 finally lands, which is the signal to delete it.

2. **Shiki v3 silently dropped the Z80 grammar.** v3 ignores the 0.14
   `{ id, scopeName, grammar }` shape — the grammar object *is* the
   registration and `name` is the id. It registered as `undefined`, so all 436
   `z80klive` blocks fell back to plaintext. **The build stayed green.** Only
   `check-docs-highlighting.cjs` caught it — the script written in Phase 3 for
   R1, firing two phases early and for an entirely different cause. Without it
   this would have shipped.

3. **`rehype-pretty-code` identifies a single theme solely by
   `Object.hasOwn(theme, "tokenColors")`.** Our theme used the TextMate
   `settings` key, so it was read as a *map* of themes whose values became theme
   names — failing with ``Theme `dark` not found`` (from `type: "dark"`).
   Renamed the key; Shiki accepts either spelling.

4. **Shiki v3 throws on unregistered fence languages** where 0.14 fell back
   silently. `markdown`, `asm` and `jsx` were used in content but never
   registered, so the build failed outright. Widened the `langs` list; adding a
   fence in a new language now fails the build until it is registered there.

### Corrections to the plan

- **`--webpack` cannot be pre-staged on Next 15** — the flag does not exist
  until Next 16 (`error: unknown option '--webpack'`). Phase 4.4's advice was
  wrong. It moves to Phase 6; Next 15 already defaults to webpack, and
  `doc:check:highlighting` is what guards against forgetting it.
- Phase 4.2's `_meta` expectation was overstated: the Nextra 3 export leaked
  only `/_mdx-components/`, not the per-folder `_meta` routes.

### Verified

- 90 routes, 102 assets; all six Z80 token colours at Nextra 3 levels
  (2154 / 1372 / 1579 / 1968 / 1157 / 385).
- 111 callouts and 93 ClickableImages render. The apparent shortfalls against
  the source counts (112 / 94) are **documentation examples inside code
  fences** in `book/toc.md` and `contribute/improve-docs.mdx`, not regressions.
- `book` still hidden from the sidebar, reachable at `/book/`.
- All 69 home-page assets resolve; CI ran `patch-package` under `npm ci` and
  the golden checks passed on the runner.
- Production site untouched.

### Early signal for Phase 5 (R6 / Decision 5)

Search is dead, as expected — but the failing request is
`…/preview/update-nextra/_pagefind/pagefind.js` (404). `addBasePath` already
resolves correctly under the preview basePath, so only the index is missing.
That removes one of the two unknowns in Decision 5 before Phase 5 starts; the
remaining one is whether **result links** carry the basePath. The Nextra 3
baseline to match is in §4b.

---

## 4d. Execution log — Phase 5 (2026-09-03)

Commit `dd7e5222`. Search is live at
<https://dotneteer.github.io/kliveide/preview/update-nextra/>

```
postbuild: pagefind --site out --output-path out/_pagefind --include-characters '#$.%'
```

### The `--site` question, settled empirically

Nextra's docs prescribe `--site .next/server/app` for static exports. **That is
wrong for this site**, and Decision 5's instruction to measure rather than trust
paid off. Both directories index the same 88 pages, but the URLs differ:

| `--site` | result URL | after Nextra strips `.html` | matches our routes? |
|---|---|---|---|
| `.next/server/app` | `/book/21-rtc-i2c.html` | `/book/21-rtc-i2c` | ✗ no trailing slash |
| **`out`** | `/book/book-writing-guidelines/` | unchanged | ✓ exact |

We use `trailingSlash: true`, so indexing `out/` is the correct choice and
avoids a redirect hop on every search result.

### R6 resolved — in favour of the source reading, not the bug report

The hardcoded `baseUrl: "/"` in `nextra@4.6.1` is **not** a problem here. Live,
under the preview basePath, result hrefs come back as
`/kliveide/preview/update-nextra/book/02-io-and-nextregs/` — basePath applied
**exactly once**, trailing slash intact, anchors working — because Nextra renders
results through `next/link`, which re-applies basePath itself. That matches the
Nextra 3 baseline in §4b. **No patch, and no need for the unreleased 4.6.2
change.** Verified both locally and on the live GitHub Pages deploy.

### `--include-characters` is what makes Z80 searchable

Without it, `.defb` and `#6000` tokenise away to nothing. With it the index grew
7466 → 10261 words and normal prose queries are unaffected:

| query | hits |
|---|---|
| `assembler` | 31 |
| `.defb` | 5 |
| `#6000` | 4 |
| `nextreg` | 31 |
| `ZX Spectrum Next` | 46 |

### Search is now better than Nextra 3

`nextreg` returned **zero** results under FlexSearch (measured in Phase 3) and
returns 31 under Pagefind, which indexes the hidden `book` section too.

### R2 confirmed mitigated

`_pagefind/` starts with an underscore and would have been deleted by Pages'
Jekyll build. It serves 200 live because of the root `.nojekyll` guard added in
Phase 3c — the risk landed exactly where predicted and the mitigation held.

### Also verified

- `out/_pagefind/pagefind.js` present, 1.5 MB index, 88 pages.
- Clicking a result navigates correctly under basePath.
- Dev mode degrades gracefully with Nextra's "Search isn't available in
  development" notice rather than erroring.
- Routes (90), assets (102) and all six highlight colours still green; the
  `_pagefind` output is invisible to both golden checks by construction.

---

## 5. Risk register

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | **Turbopack silently becomes default and drops the custom grammar** — 436 code blocks lose highlighting | High | `--webpack` on `dev` *and* `build`, added in Phase 4 before Next 16; documented in `AGENTS.md`; explicit exit criterion in Phases 4 and 6 |
| R2 | **Jekyll strips `_next/` or `_pagefind/`** on `gh-pages` | High — blank site | Phase 3c asserts a **root** `.nojekyll`; re-checked in Phase 5 |
| R3 | **Preview deploy wipes the production site** | Critical | `clean: false` on previews, `clean-exclude: preview/**` on production; Phase 3a ships artifact-only first so the pipeline is proven before anything touches `gh-pages` |
| R4 | Shiki 0.14 → 3 changes the custom theme format | Medium | The theme is a standard TextMate `{colors, settings}` object; verify visually against the Phase 3 baseline screenshots |
| R5 | React 19 breaks the Electron renderer | High | **Eliminated by design** — Phase 1 isolates the docs package; the Electron app never leaves React 18 |
| R6 | Pagefind indexes the wrong root, so results 404 under `basePath` | Medium | Decision 5 documents the mechanism (`baseUrl: "/"` + `next/link` re-applying basePath); Phase 5 verifies live, not just locally |
| R7 | Relative MDX imports break when `pages/` → `content/` | Medium | Register `ClickableImage` globally in `mdx-components.tsx` and delete 94 imports rather than rewriting depths |
| R8 | Route loss goes unnoticed across ~100 pages | Medium | Golden route list from Phase 0, diffed at every phase |
| R9 | `docs/package-lock.json` silently gitignored by the bare `package-lock.json` rule | Medium — non-reproducible CI | Explicit `!docs/package-lock.json` negation + `git check-ignore` exit criterion in Phase 1 |
| R10 | `next-examples.zip` generation lost during the script refactor | Low — broken book download | Extracted to `scripts/build-doc-assets.cjs` in Phase 1; asset presence is an exit criterion |
| R11 | [`#5036`](https://github.com/shuding/nextra/issues/5036) — `<Layout>` throws *"Invalid input: expected nonoptional, received undefined → at children"*; the `LayoutPropsSchema` fix is among the **unreleased** 4.6.2 changes | High if hit — Phase 4 cannot build | Surfaces immediately in Phase 4.8 on Next 15, well before Next 16 is in play. If hit: pass `children` explicitly, or pin to a `main` build. Re-check the issue before starting Phase 4 |
| R12 | [`#4683`](https://github.com/shuding/nextra/issues/4683) — relative Markdown links drop `basePath` and 404 under a subpath deploy | Medium — we deploy at `/kliveide/` | The Phase 7 link checker walks the *built* HTML, so it catches this. Prefer root-relative or Nextra `<Link>` over relative `../` links |
| R13 | Nextra's npm release pipeline has been broken since 2025-12 ([`#5010`](https://github.com/shuding/nextra/issues/5010)) — 4.6.2 exists on `main` but not on npm | Medium — no upstream fixes arriving | Plan targets published 4.6.1 only; workarounds are local and documented (R6, R11). Do not build the migration on an unreleased version |
| R14 | `postbuild` skipped because CI calls `next build` directly → search ships an empty index, silently | Medium | Phase 5 asserts `docs/out/_pagefind/pagefind-entry.json` exists as a CI step |
| R15 | Next 16 rejects the now-removed `eslint` key in `next.config.mjs` | Low | Explicit removal step in Phase 6.4 |

## 6. Rollback

Phases 0–3 and 5–9 are individually revertible commits. Phase 4 is large; make it a
single squashable commit so `git revert` returns to a working Nextra 3 site. Because
`docs/` is an isolated package after Phase 1, **no rollback at any point can affect the
Electron application.**

## 7. Sources

- Nextra 4 migration guide — <https://the-guild.dev/blog/nextra-4>
- Official Nextra 4 example (Next 16 + React 19 + `--webpack`) — <https://github.com/shuding/nextra/tree/main/examples/docs>
- Catch-all route — <https://github.com/shuding/nextra/blob/main/examples/docs/src/app/docs/%5B%5B...mdxPath%5D%5D/page.jsx>
- Search / Pagefind — <https://github.com/shuding/nextra/blob/main/docs/app/docs/guide/search/page.mdx>
- Static exports — <https://github.com/shuding/nextra/blob/main/docs/app/docs/guide/static-exports/page.mdx>
- Turbopack limitations — <https://github.com/shuding/nextra/blob/main/docs/app/docs/guide/turbopack/page.mdx>
- Custom grammar & themes — <https://github.com/shuding/nextra/blob/main/docs/app/docs/guide/syntax-highlighting/page.mdx>
- Next.js 16 upgrade guide — <https://nextjs.org/docs/app/guides/upgrading/version-16>
- Deploy action — <https://github.com/JamesIves/github-pages-deploy-action>
- Nextra `_meta` file reference — <https://nextra.site/docs/file-conventions/meta-file>
- Nextra `content` directory reference — <https://nextra.site/docs/file-conventions/content-directory>
- Shiki v2 rename `getHighlighter` → `createHighlighter` — <https://shiki.style/blog/v2>
- Shiki migration (`BUNDLED_LANGUAGES` → `bundledLanguages`) — <https://shiki.style/guide/migrate>
- Pagefind config & search options — <https://pagefind.app/docs/config-options/>, <https://pagefind.app/docs/search-config/>
- Nextra issues referenced: [#3987](https://github.com/shuding/nextra/issues/3987) (pagefind + static export), [#4683](https://github.com/shuding/nextra/issues/4683) (relative links + basePath), [#4830](https://github.com/shuding/nextra/issues/4830) (Next 16 support), [#4885](https://github.com/shuding/nextra/pull/4885) (pagefind basePath fix), [#5010](https://github.com/shuding/nextra/issues/5010) (release pipeline broken), [#5036](https://github.com/shuding/nextra/issues/5036) (`<Layout>` children schema)
- `nextra@4.6.1` config schema, `LayoutProps`, `Search` implementation, and the
  `shouldUseConfigTurbopack` logic — read directly from the published npm tarballs
- `next@16.3.4` `dist/lib/turbopack-warning.js` — the webpack/Turbopack guard, read
  from the published tarball

> **Note:** `https://nextra.site/docs/guide/migration/nextra-4` returns **404**. There
> is no standalone official migration page; Nextra's own sidebar links "Migration from
> Nextra v3" directly to the Guild blog post, which *is* the official guide.
