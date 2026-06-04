# Klive IDE Electron Shell

A minimal Electron shell built with TypeScript, electron-vite, and XMLUI.

The app starts with an Emulator window. The Emulator window has a button that opens the IDE window.

## Scripts

- `npm run dev` starts electron-vite and launches Electron.
- `npm run start` previews the built Electron app.
- `npm test` runs Vitest tests.
- `npm run typecheck` checks renderer and Electron TypeScript.
- `npm run build:app` typechecks and builds main, preload, and renderer output.
- `npm run build` builds the app and creates the default platform installer.
- `npm run build:win` creates a Windows x64 NSIS installer.
- `npm run build:mac` creates a macOS x64 PKG installer.
- `npm run build:mac:arm64` creates a macOS arm64 PKG installer.
- `npm run build:linux` creates a Linux x64 AppImage.
- `npm run build:linux:arm64` creates a Linux arm64 AppImage.

## Windows

- `emulator.html` hosts the Emulator renderer.
- `ide.html` hosts the IDE renderer.
- `src/electron/main.ts` creates and coordinates the Electron browser windows.
- `src/electron/preload.ts` exposes the renderer-safe Electron bridge.
- `src/renderer/emu/src/Main.xmlui` defines the Emulator UI.
- `src/renderer/ide/src/Main.xmlui` defines the IDE UI.
