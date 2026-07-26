# AGENTS.md

Guidance for AI assistants working in this workspace.

## Project Context

- This is `klive-ide`, an Electron shell application with React renderers.
- Renderer code lives mainly under `src/renderer`.
- Future and archived implementation plans live in `.plans/`.
- React modernization work is tracked in `.plans/REACT_COMPONENT_REVIEW_PLAN.md`.
- Additional AI-oriented notes live in `.ai/`; read them before related work.

## Working Rules

- Preserve user changes in the dirty worktree. Do not revert unrelated files.
- Prefer focused, reviewable changes with tests around touched behavior.
- Use direct imports to the file that owns a component. Avoid compatibility wrapper files that only re-export moved components.
- For layout primitives, import from `@renderer/controls/layout/<ComponentFile>`.
- Keep legacy folders only for components that still genuinely live there.
- Run focused tests first, then `npm run build:check`; run `npm run lint:renderer` when touching renderer React code.
- After moving or deleting component files, scan both alias and relative imports, then run `npx electron-vite build --config build/electron.vite.config.ts` to catch Vite import-analysis errors.

## Current Useful Commands

- Type-check: `npm run build:check`
- Renderer hook lint baseline: `npm run lint:renderer`
- Focused jsdom tests: `npm test -- --project jsdom <test files>`

## Notes For React Refactors

- Start each component set with the checklists in `.plans/REACT_COMPONENT_REVIEW_PLAN.md`.
- Fix conditional hook calls before tuning dependency arrays.
- Prefer extracting hooks/components over broad rewrites.
- When moving files, update consumers to the new direct path and delete the old file if it only re-exported the moved symbol.
