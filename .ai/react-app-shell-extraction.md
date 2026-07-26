# React App Shell Extraction Notes

- Keep app shell components focused on selecting visual state and composing panels/dialog hosts.
- Move one-time startup effects into named hooks with tests for idempotency, IPC cleanup, cache setup, and loading-screen removal.
- Prefer dialog host registries over inline conditional dialog blocks in app shells.
- When extracting imports used by renderer entry paths, run `npx electron-vite build --config build/electron.vite.config.ts` to catch bundler-resolution issues.
