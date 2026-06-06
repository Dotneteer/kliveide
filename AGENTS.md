# Klive IDE Agent Notes

This project is an Electron shell built with TypeScript, electron-vite, XMLUI, and Vitest.

## Working Style

- Preserve the current folder split:
  - `src/main` for Electron main-process code.
  - `src/preload` for preload bridge code.
  - `src/renderer` for XMLUI renderer code.
  - `src/common` for shared state and messaging code.
  - `src/public` for static resources used by the main process.
- The app has two renderer windows:
  - Emulator window.
  - IDE window.
- Do not run `npm install` automatically. The user prefers to run installs manually.
- Do not run `npm run dev` unless explicitly requested. The user usually starts and tests the app manually.
- Before changing XMLUI code, read `.ai/xmlui.md`.

## Verification

Use these checks after code changes when relevant:

```sh
npm run typecheck
npm test
npm run build:app
```

The build may emit third-party XMLUI/Rollup warnings about Sass legacy APIs, `"use client"` directives, and Rollup pure annotations. These warnings have been non-fatal.

## Shared State And Messaging

- Keep API messaging and shared state management separate.
- API messaging is for process-to-process commands through the main process.
- Shared state is reducer-driven and forwarded among the main, emulator, and IDE processes.
- Renderer React components should access shared store management through renderer-side hooks such as `useStore`, `useSharedState`, and `useDispatch`.
- XMLUI markup should access shared state through the `SharedAppState` component API, not through globals on `window`.

## Electron Notes

- Renderer code must not import Electron or Node modules directly.
- Use the preload bridge for renderer-safe APIs.
- Packaged renderer URLs differ from dev URLs; keep dev and packaged loading paths separate in main-process window loading logic.

