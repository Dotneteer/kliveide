# React Monaco Editor Refactor

- Keep Monaco runtime bootstrap out of `MonacoEditor.tsx`; use `monacoBootstrap.ts` for worker setup, custom language registration, provider registration, and editor opener wiring.
- Keep global provider bridges in `monacoGlobals.ts`. Set callbacks from React effects and return the scoped cleanup function so unmounted editors do not leave stale callbacks.
- Monaco rename edits use 1-based line and column positions. Convert columns to zero-based string indexes when editing text buffers.
- Prefer small adapter modules for testable editor behavior (`monacoEditorOptions.ts`, `monacoDebugShortcuts.ts`, `monacoExternalEdits.ts`) before extracting the heavier breakpoint decoration logic.
- After Monaco/bootstrap changes, run the node Monaco test, focused jsdom app-shell tests, `npm run build:check`, `npm run lint:renderer`, and the Electron/Vite build.
