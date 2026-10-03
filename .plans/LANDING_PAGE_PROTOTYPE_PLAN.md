# Landing Page Prototype Plan

Status: **prototype built** — runs locally with `npm run doc:dev`. Rich content (feature videos, screenshot gallery,
release-aware download links, theming polish) comes in later phases, after this works locally.

## Goal

Make `/` (on GitHub Pages: `https://dotneteer.github.io/kliveide/`) a plain React landing page
instead of the Nextra "Introduction" page. Its header has a **Documentation** button that opens
the existing Nextra docs. Runnable locally with `npm run doc:dev`.

## Decision: same Next.js app, two root layouts

The landing page lives **inside the existing `docs/` Next app**, not in a new package.

| Option | Verdict |
|---|---|
| **A. Route groups in `docs/app`** (chosen) | One build, one deployment, one `NEXT_PUBLIC_BASE_PATH`; the Documentation button is an ordinary in-site link. Next's *multiple root layouts* let the landing page skip Nextra's `<Layout>` entirely. |
| B. Separate Vite/React app (`site/`) | Two dev servers, two builds, and the Pages workflow would have to merge two outputs under one base path. More moving parts for no gain. |
| C. Mount docs under `/docs` (`contentDirBasePath`) | Cleaner URL space, but changes **every** public docs URL, and a static export cannot emit redirects. Not worth it for a prototype; revisit later if wanted. |

With option A, exactly one public URL changes meaning: `/` becomes the landing page and the old
Introduction moves to `/introduction`. Every other docs URL stays as it is.

## Target layout

```
docs/app/
  (landing)/
    layout.tsx          # own <html>/<body>, no Nextra; imports landing.css
    page.tsx            # the landing page  →  "/"
    landing.css
  (docs)/
    layout.tsx          # today's app/layout.tsx, moved unchanged (Nextra <Layout>)
    custom.css          # moved with it
    [...mdxPath]/       # was [[...mdxPath]]: now *required*, so it no longer claims "/"
      page.tsx
docs/content/
  introduction.mdx      # was index.mdx
  _meta.ts              # key `index` → `introduction`
```

## Steps

1. **Split the root layout into route groups.**
   Move `app/layout.tsx`, `app/custom.css` and the catch-all folder into `app/(docs)/`. Fix the
   relative import in `page.tsx` (`../../mdx-components` → `../../../mdx-components`). Route groups
   don't change URLs, so docs routes stay identical.
2. **Free up `/`.** Rename `[[...mdxPath]]` → `[...mdxPath]`, rename `content/index.mdx` →
   `content/introduction.mdx`, and update `_meta.ts`. Grep `content/` and `page-components/` for
   links to the old docs root and point them at `/introduction` (a first grep found none).
3. **Add the landing page** under `app/(landing)/`:
   - `layout.tsx`: `<html lang="en">`, `<body>`, metadata (`title: "Klive IDE"`). No Nextra imports.
   - `page.tsx`: a static server component with
     - a **header**: Klive logo + name on the left; on the right a **Documentation** button
       (`next/link` to `/introduction`, so `basePath` is applied automatically) and a GitHub link;
     - a **hero**: tagline (reuse the Introduction's opening sentence), the existing
       `/images/intro/klive-ide-intro.png` screenshot, and a **Download** button linking to
       `https://github.com/Dotneteer/kliveide/releases/latest`;
     - a 3–4 card **feature strip** (emulators, IDE/debugger, Z80 assembler, Klive BASIC) using
       text only for now;
     - a one-line **footer**.
   - `landing.css`: plain CSS, light/dark through `prefers-color-scheme`. `<img>` paths must
     carry the `basePath` prefix, the same way `(docs)/layout.tsx` does for the logo.
4. **Keep the landing page out of search.** Add `data-pagefind-ignore="all"` to the landing
   `<body>`, so Pagefind only indexes documentation.
5. **Try it locally:** `npm run doc:dev`, open `http://localhost:3000/`, click Documentation →
   `/introduction` with the normal Nextra sidebar. Also try `npm run doc:build && npm run doc:serve`
   to check the page under the production `/kliveide` base path (images and the button link).
6. **Verify:** `npm run doc:check`. The route diff will report `/introduction/index.html` as new
   — expected; once the prototype is accepted, update `.plans/docs-routes.golden.txt` so `/index.html`
   is now the landing page. The link audit and the highlighting check must still pass unchanged.

## Risks to check during the prototype

- **`generateStaticParamsFor` with a required catch-all.** Nextra's examples use the optional
  form. With `index.mdx` gone no page should ask for an empty `mdxPath`; if the build still
  generates one, filter it out in `generateStaticParams`.
- **Nextra and multiple root layouts.** `getPageMap()` should only run in `(docs)/layout.tsx`.
  If Nextra's webpack loader expects `app/layout.tsx` to exist, fall back to a minimal shared root
  layout (`<html>`/`<body>` only) with each group adding its own wrapper.
- **The `--webpack` flag and the `patch-package` patch** are unaffected; don't touch them.
- **Navigating between groups** does a full page load (that's how separate root layouts work).
  That's fine for a link from the landing page to the docs.

## Out of scope (later phases)

Embedded feature videos, an image carousel, OS-specific download buttons generated from the
GitHub Releases API, a "Docs" link back to the landing page from the Nextra navbar logo, shared
theme tokens between landing page and docs, analytics, and a `/docs` URL prefix (option C).
