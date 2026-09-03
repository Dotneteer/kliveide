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

Verify a docs change with `npm run doc:build && npm run doc:check`, which
diffs routes and assets against `.plans/docs-*.golden.txt`, audits every
internal link, and asserts the Z80 syntax highlighting actually rendered. The
last of those exists because a lost grammar leaves every page present and
merely uncoloured, which no route diff can see.

## Current Useful Commands

- Type-check: `npm run build:check`
- Renderer hook lint baseline: `npm run lint:renderer`
- Focused jsdom tests: `npm test -- --project jsdom <test files>`
- Docs build: `npm run doc:build`
- Docs verification: `npm run doc:check`
- Docs preview at the production path: `npm run doc:serve`

## Notes For React Refactors

- Fix conditional hook calls before tuning dependency arrays.
- Prefer extracting hooks/components over broad rewrites.
- When moving files, update consumers to the new direct path and delete the old file if it only re-exported the moved symbol.
