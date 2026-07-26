# React Cleanup Pass

- Remove plain renderer `console.log` traces during cleanup slices. Keep intentional `console.error` paths that report real failures unless there is a local error-reporting helper to use instead.
- Treat command payloads, messaging surfaces, emulator extension points, and persisted view-state fields as broad/domain boundaries; do not churn their `any` or typo-shaped names in a cleanup-only slice.
- For reusable input controls, type `onBeforeInput` as `FormEvent<HTMLInputElement>` and read typed characters from `e.nativeEvent as InputEvent`.
- After noise/type cleanup, run `rg "console\\.log" src/renderer -n`, `npm run build:check`, `npm run lint:renderer`, focused tests, and the Electron/Vite build.
