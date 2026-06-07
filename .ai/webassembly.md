# WebAssembly And C Toolchain Notes

Read this before changing C/WebAssembly emulator code, Wasm build wiring, or renderer code that consumes Wasm memory.

## Current Baseline

- Target stable WebAssembly 2.0-compatible browser/Electron runtimes.
- C code is compiled directly to `wasm32` with `clang`; no Emscripten runtime is used.
- Wasm modules are freestanding:
  - compiled with `-nostdlib`
  - no start function: `-Wl,--no-entry`
  - exported linear memory: `-Wl,--export-memory`
  - explicit exported C functions per target
- Renderer TypeScript owns presentation and browser APIs. C/Wasm should prepare frame data in linear memory; TypeScript should read those buffers and render display/audio.

## Toolchain Requirement

A newly cloned repository needs:

```sh
clang --target=wasm32 --version
```

The repository does not install this automatically. On macOS, Homebrew LLVM clang is known to work. Keep respecting the project rule: do not run `npm install` automatically.

## Source And Artifact Layout

- C source lives under `src/wasm` for standalone demos and under `src/emu` for emulator code.
- The current proof-of-concept target is:
  - Source: `src/wasm/bitmap-demo/bitmap-demo.c`
  - Generated artifact: `public/wasm/bitmap-demo.wasm`
- The current Z80 migration target is:
  - Source: `src/emu/z80/z80.c`
  - Generated artifact: `public/wasm/z80.wasm`
- `public/wasm` is the renderer static-asset location. Electron Vite copies it to `out/renderer/wasm` for packaged/preview builds.
- Do not put generated `.wasm` files under `src/renderer/src`; Vite may try to module-load them instead of serving them as static assets.

## Build Commands

Use:

```sh
npm run build:wasm
```

This runs:

```sh
node build/wasm/build-wasm.mjs
```

`npm run build:app` runs `build:wasm` before typechecking and `electron-vite build`, so production builds regenerate Wasm from C.

## Dev Watch Behavior

`electron.vite.config.mts` defines `watchWasmResourcesPlugin()` for the renderer dev server.

During `npm run dev`, it:

- builds Wasm once when the renderer dev server starts
- watches `src/wasm/**/*.c`, `src/wasm/**/*.h`, `src/emu/**/*.c`, and `src/emu/**/*.h`
- debounces changes
- rebuilds `public/wasm/*.wasm`
- sends a renderer full reload so the updated binary is fetched

Do not start `npm run dev` unless the user explicitly asks; the user usually starts and tests the app manually.

## Adding Or Changing Wasm Targets

Add targets in `build/wasm/build-wasm.mjs`:

```js
const wasmTargets = [
  {
    name: "bitmap-demo",
    source: "src/wasm/bitmap-demo/bitmap-demo.c",
    output: "public/wasm/bitmap-demo.wasm",
    exports: ["bitmap_width", "bitmap_height", "bitmap_ptr", "render_frame"]
  }
];
```

For each target:

- keep standalone demo sources in `src/wasm`
- keep emulator migration sources in `src/emu`
- keep `output` in `public/wasm`
- explicitly list every C function that TypeScript must call
- keep exported buffers stable for the duration of the TypeScript read

## Current Proof Of Concept ABI

`bitmap-demo.wasm` exports:

- `memory: WebAssembly.Memory`
- `bitmap_width(): number`
- `bitmap_height(): number`
- `bitmap_ptr(): number`
- `render_frame(frameNo: number): void`

The framebuffer format is RGBA8888, one byte per channel, with alpha set to `0xff`.

Renderer loading/rendering is in:

- `src/renderer/lib/WasmBitmapDisplay/wasmBitmapDemo.ts`
- `src/renderer/lib/WasmBitmapDisplay/WasmBitmapDisplayReact.tsx`

The TypeScript side fetches `wasm/bitmap-demo.wasm` relative to the renderer page URL, instantiates it, calls `render_frame`, reads `memory.buffer` at `bitmap_ptr()`, and paints an `ImageData` to a canvas.

## Sass Warning Note

Renderer SCSS is configured to use Dart Sass's modern JS API in `electron.vite.config.mts`:

```ts
css: {
  preprocessorOptions: {
    scss: { api: "modern" },
    sass: { api: "modern" }
  }
}
```

Keep this in place; otherwise Vite 5 may emit Dart Sass `legacy-js-api` deprecation warnings during dev/build.

## Verification

Relevant checks after Wasm/C or renderer integration changes:

```sh
npm run build:wasm
npm run typecheck
npm test
npm run build:app
```

Optional low-level artifact check:

```sh
node -e "const fs=require('fs'); WebAssembly.instantiate(fs.readFileSync('public/wasm/bitmap-demo.wasm'),{}).then(({instance})=>{const e=instance.exports; e.render_frame(1); console.log(e.bitmap_width(), e.bitmap_height(), e.bitmap_ptr());})"
```
