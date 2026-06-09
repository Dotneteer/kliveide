# WebAssembly And C Toolchain Notes

Read this before changing C/WebAssembly emulator code, Wasm build wiring, or renderer code that consumes Wasm memory.

## Current Baseline

- Target stable WebAssembly 2.0-compatible browser/Electron runtimes.
- C code is compiled directly to `wasm32` with `clang`; no Emscripten runtime is used.
- Wasm modules are freestanding:
  - compiled with `-nostdlib`
  - compiled with `-fno-builtin` so Clang does not lower simple loops to libc calls such as `memset`
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
- The current ZX Spectrum 48K skeleton target is:
  - Source: `src/emu/sp48/sp48.c`
  - Generated artifact: `public/wasm/sp48.wasm`
  - TypeScript adapter: `src/emu/sp48/WasmZxSpectrum48Machine.ts`
  - Renderer proof: `src/renderer/lib/WasmSp48Display/WasmSp48DisplayReact.tsx`
- ZX Spectrum ROM resources used by the main process live under `src/public/roms`. The default 48K ROM is `src/public/roms/sp48.rom`, copied from the reference workspace.
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

## Current SP48 ROM And Memory ABI

`sp48.wasm` keeps a single static 64K memory array. The first 16K is ROM and the rest is RAM:

- `sp48UploadRomByte(offset, value)` writes a byte only while `offset < 0x4000`.
- `sp48ReadMemory(address)` reads the 16-bit address space.
- `sp48WriteMemory(address, value)` ignores writes below `0x4000` and writes RAM at `0x4000-0xffff`.
- `sp48Reset()` resets runtime counters/devices without clearing memory.
- `sp48HardReset(is16k, isNtsc)` preserves uploaded ROM and clears RAM. In 16K mode, `0x8000-0xffff` is initialized to `0xff`.

Renderer code must load ROM bytes through the main API, not Node or Electron imports. The current adapter setup path is:

```ts
const machine = await loadWasmZxSpectrum48Machine();
await machine.setup(readBinaryFile);
machine.hardReset();
```

`WasmZxSpectrum48Machine.setup()` maps the default `romId` (`"sp48"`) to `roms/sp48.rom` and calls `readBinaryFile(path, "public")`.

## Current SP48 CPU Integration

`src/emu/z80/z80.c` is still the single Z80 CPU implementation. It builds as standalone `z80.wasm` for CPU tests, and `src/emu/sp48/sp48.c` also includes it directly with `Z80_EXTERNAL_BUS` defined.

When embedded in `sp48.c`, the Z80 core is configured with macros:

- memory reads/writes use the SP48 ROM/RAM map
- port reads/writes use the SP48 port implementation, currently `$FE`
- base tacts are mirrored into both the Z80 CPU counter and the SP48 machine tact counter
- memory and I/O delays apply the SP48 contention tables

Keep this single-source pattern when expanding the machine core. Do not fork instruction implementations into `sp48.c`; add new bus/timing hooks to `z80.c` only when they keep standalone `z80.wasm` behavior unchanged by default.

The SP48 adapter exposes CPU diagnostics such as PC, AF/HL, CPU tacts, and instruction counters. These are used by tests and by the temporary UI overlay to prove that Step 7 is active before the full frame runner and debugger are migrated.

`sp48ExecuteFrame()` currently implements the no-debug frame loop in C. It executes complete embedded Z80 cycles until `sp48Tacts` crosses `sp48NextFrameStartTact + sp48TactsInFrame`, then marks the frame complete, advances `sp48NextFrameStartTact`, renders the ULA display buffer plus temporary fake audio samples, and returns normal termination mode `0`. It deliberately does not snap `sp48Tacts` to the frame boundary; the final instruction can overshoot, matching the original machine runner shape.

The frame-start INT line is recalculated before every `sp48ExecuteInstruction()` call with `currentFrameTact() < 32`. SP48 exposes `sp48GetInterruptsRaised()` and `sp48GetInterruptLineActive()` as diagnostics. Keep debug stepping, breakpoints, code injection, and queued-keystroke frame commands outside this C loop until those features are migrated deliberately.

## Current SP48 Display Rendering

The fake SP48 display pattern has been removed. `src/emu/sp48/sp48.c` renders the Spectrum screen into an original-style border-inclusive static buffer:

- bitmap bytes are read from `$4000-$57ff`
- attribute bytes are read from `$5800-$5aff`
- Spectrum's non-linear bitmap row layout is mirrored from the original `CommonScreenDevice`
- color values use the original 16-entry normal/bright palette
- FLASH swaps ink and paper based on `frames / 16`
- the PAL screen shape exposed to the renderer is `352x288`
- `sp48GetPixelBufferStartOffset()` returns one screen row (`352` for PAL), matching the original panel copy offset
- the 256x192 display is placed within the buffer at the same border offset as the original screen device
- border pixels are currently filled from the latest `$FE` border color

`sp48RenderInstantScreen()` is exported for UI and tests that need to repaint the screen immediately after memory or border-color writes. The backing pixel buffer is taller than the displayed height by a few guard rows, just like the TypeScript screen device allocation pattern; TypeScript consumers should copy from `getPixelBufferStartOffset()` for `screenWidthInPixels * screenHeightInPixels` pixels.

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
