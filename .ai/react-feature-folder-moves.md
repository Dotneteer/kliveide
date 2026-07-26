# React Feature Folder Moves

- Prefer physical file moves plus direct imports for renderer feature migrations; do not add compatibility barrels unless the user asks for them.
- After moving files, scan production and tests for old paths and malformed rewrite artifacts:
  - `rg "old/path|new/path typo|\\.@renderer|/@renderer|\\\"/features/|\\\"/appIde/" src test -n`
- Run both compiler layers after renderer moves:
  - `npm run build:check`
  - `npx electron-vite build --config build/electron.vite.config.ts`
- `tsc` can pass while Vite import analysis fails, especially for local shims and non-TS assets. Treat the Electron/Vite build as required after moved renderer files.
- Keep app/domain services under `appIde/services` unless the slice explicitly migrates service ownership.
