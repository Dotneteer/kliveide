# Renderer IPC Registration Notes

- Do not register Electron IPC listeners at module import time in React app files.
- Put listener setup in an explicit `register...Ipc()` helper that returns cleanup, then call it from an app lifecycle effect.
- Make registration idempotent so repeated effect calls or hot reload do not stack duplicate listeners.
- Tests should call the registration helper directly with a mocked `ipcRenderer` and verify `on`, `off`, `NotReady`, and normal response routing.
- The jsdom Vitest project currently includes `test/**/*.test.tsx`; use `.test.tsx` for focused renderer tests.

