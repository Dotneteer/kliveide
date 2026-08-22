# ZX Spectrum Next ULA WASM Parity Audit

Created: 2026-08-22

## Verdict

ULA and screen parity is not complete. The TypeScript implementation remains
the oracle for ULA-visible behavior.

The WASM backend can boot and covers useful instant-rendering slices, but the
current WASM ULA implementation still does not implement the full timed
composed screen pipeline used by the TypeScript ZX Spectrum Next machine.

## Scope Checked

TypeScript oracle sources:

- `src/emu/machines/zxNext/UlaDevice.ts`
- `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts`
- `src/emu/machines/zxNext/NextRegDevice.ts`
- `src/emu/machines/zxNext/PaletteDevice.ts`
- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`
- `src/emu/machines/zxNext/ZxNextMachine.ts`

WASM sources:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ula.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-palette.c`
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`

## Parity Slices Currently Covered

- Port `$FE` keyboard-row reads and basic border/EAR/MIC latch behavior.
- TypeScript-compatible analog EAR discharge timing for `$FE` bit 6.
- Issue 2 MIC contribution controlled by NextReg `$08`.
- Standard ULA colour packing in the app pixel format.
- Standard ULA instant rendering with horizontal pixel doubling.
- Timex ULA HiColor instant rendering for modes 2/3, including per-line
  attributes at `0x2000 | bitmapAddress`, ULA palette lookup, horizontal pixel
  doubling, X/Y scroll, clipping, fallback colour, and flash-aware attribute
  ink/paper selection. The instant renderer reads physical screen memory
  bank 5 or shadow bank 7, not the CPU-visible MMU mapping at `$4000`.
- Timex ULA HiRes instant rendering for modes 4/5/6/7, including the 512-pixel
  output area, paired bitmap bytes from `$4000` and `$6000`, HiRes ink/paper
  palette selection from Timex port `$FF`, X/Y scroll, clipping, fallback
  colour, and physical screen-memory bank 5 or shadow bank 7 reads.
- ULA clip window NextReg `$1A`, clip index reset via `$1C`, and scroll
  NextRegs `$26/$27` for the current instant-render path.
- ULA flash counter and flag progression.
- 50 Hz/60 Hz ULA interrupt pulse window.

## Open ULA/Screen Parity Gaps

- No WASM tact-by-tact composed screen renderer equivalent to
  `NextComposedScreenDevice.renderTact`.
- No render-before-mutation integration before visible screen RAM writes,
  display-source changes, ULA state changes, or register writes that affect the
  currently displayed pixel stream.
- Timex port `$FF` does not fully mirror TypeScript side effects: interrupt
  disable, composed-screen `timexPortValue`, standard/shadow source selection,
  and timed HiColor/HiRes rendering are still open.
- ULANext and ULA+ palette selection are stored only partially and are not used
  by the WASM ULA renderer. ULA+ ports `$BF3B/$FF3B` are not fully integrated
  with rendered pixels.
- ULA Control NextReg `$68` is not rendered: ULA disable output, SLU blending
  mode, ULA+ enable, half-pixel scroll, and stencil mode are still open.
- Full final screen composition is missing in WASM: ULA/LoRes, Layer 2,
  tilemap, sprites, global transparency, fallback colour, priority, clipping,
  and blending do not yet match the TypeScript composition pipeline.
- Active video line and line-interrupt behavior are not driven by the same
  per-tact renderer state as TypeScript.
- Floating bus updates caused by ULA display-memory reads are not equivalent.
- 50/60 Hz display geometry and centering are handled by fixed WASM instant
  coordinates rather than the TypeScript timing tables.

## Diagnostic State

`ZxNextWasmV2Machine` must report:

- `defaultReady: false`
- `migratedSurfaces` excludes `ULA` and `screen`
- `defaultBlockers` contains:
  - `ula-screen-tact-pipeline-parity`
  - `ula-timex-mode-rendering-parity`
  - `ula-next-plus-rendering-parity`
  - `screen-layer-composition-parity`

This is true even though the normal factory default still selects WASM. The
diagnostics now reflect the incomplete ULA/screen migration honestly.

## Recommended Implementation Order

1. Add a WASM render-to-current-tact pipeline and call it before every
   ULA-visible mutation.
2. Port standard ULA tact rendering first, including display-memory read timing
   and floating-bus updates.
3. Port Timex `$FF` state and standard/shadow, Hi-Res, and Hi-Color rendering.
4. Port ULANext and ULA+ palette index selection and ULA+ ports.
5. Port ULA Control `$68` rendering semantics.
6. Port LoRes and final ULA/tilemap/Layer 2/sprite composition.
7. Drive active-line and line-interrupt state from the same tact renderer.
8. Add frame-diff diagnostics for screen/ULA state once each slice has stable
   binary diagnostics.

## Validation Commands

- `npm run build:zxnext-wasm`
- `npm test -- --project node test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-ports.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts test/wasm/zxNext/wasm-next-ide-scaffold.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-scaffold-diagnostics.test.ts test/wasm/zxNext/wasm-next-public-adapter.test.ts test/wasm/zxNext/wasm-next-shared-source-contract.test.ts`
- `npm run build:check`
- `npm run check:zxnext-wasm-size`
- `npm run diff:zxnext-machine -- --model zxnext`
