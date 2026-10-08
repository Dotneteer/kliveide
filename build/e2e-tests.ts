/*
 * The end-to-end test tiers: tests that run the real WASM machine cores.
 *
 * They are most of the suite's time (≈1350 of ≈1590 test-seconds when this was written), and a
 * change that touches none of their inputs cannot change their outcome. `npm test`
 * (`scripts/run-tests.cjs`) therefore always runs the unit tier and runs each tier below only when
 * its inputs changed since it last passed; `npm run test:e2e` and `npm run test:all` run them
 * regardless, and CI runs everything.
 *
 * **Keep this list complete.** A unit-tier test that instantiates a machine core fails with a
 * message pointing here (`test/vitest.setup.ts`), so a new core test cannot quietly slow the unit
 * tier down. Membership was measured, not guessed: every file listed instantiated a core (a
 * WebAssembly instance exporting `sp48*`, `sp128*`, `spp3e*`, `timex*`, `zxnext*`, `z88*`, `zx8081*` or `z80*`) in a full
 * run, plus the core build/source-contract tests under `test/wasm/`.
 */

/** Tests whose subject is a machine core: its CPU, devices, loaders, debug loop and flows. */
export const E2E_CORE_TESTS: string[] = [
  // --- Whole folders: every test in them runs a core or checks a core's sources/build
  "test/wasm/**/*.test.ts",
  "test/zxnext-hw/**/*.test.ts",
  "test/zx8081-hw/**/*.test.ts",
  "test/sp128-hw/**/*.test.ts",
  "test/timex-hw/**/*.test.ts",
  "test/spectrum-hw/**/*.test.ts",
  "test/harness/**/self-tests/**/*.test.ts",

  // --- Mixed folders: the files that run a core
  "test/audio/AudioIntegration.test.ts",
  "test/controls/EmulatorAudioRendering.test.ts",
  "test/emu/access-breakpoints-real-machine.test.ts",
  "test/emu/conditional-breakpoints-injection-flow.test.ts",
  "test/emu/conditional-breakpoints-real-machine.test.ts",
  "test/emu/execution-history-controller.test.ts",
  "test/emu/history-export-controller.test.ts",
  "test/emu/debug-recording-*.test.ts",
  "test/emu/reverse-timeline-controller.test.ts",
  "test/emu/reverse-step-back-controller.test.ts",
  "test/emu/reverse-continue-controller.test.ts",
  "test/emu/reverse-hit-counts-controller.test.ts",
  "test/emu/reverse-sd-fork-controller.test.ts",
  "test/emu/reverse-cores-controller.test.ts",
  "test/emu/reverse-next-breakpoints-controller.test.ts",
  "test/emu/profile-controller.test.ts",
  "test/emu/history-step-back-real-machine.test.ts",
  "test/emu/logpoints-real-machine.test.ts",
  "test/emu/one-shot-real-machine.test.ts",
  "test/emu/assertion-wpmem-real-machine.test.ts",
  "test/reverse/**/*.test.ts",
  "test/machines/hardware-specs-cores.test.ts",
  "test/tape/tape-load-flow.test.ts",
  "test/tape/turbo-block-playback.test.ts",
  "test/z88/memory-*.test.ts",
  "test/z88/rtc.test.ts",
  "test/z88/z88-ozvm-parity.test.ts",
  "test/z88/snapshot/z88-snapshot-flow.test.ts",
  "test/z88/snapshot/z88-snapshot-load.test.ts",
  "test/spectrum/snapshot/spectrum-snapshot-load.test.ts",
  "test/spectrum/snapshot/spectrum-snapshot-flow.test.ts",
  "test/spectrum/snapshot/spectrum-snapshot-save.test.ts",
  "test/spectrum/rzx/rzx-sp*.test.ts",
  "test/z88/z88-beeper.test.ts",
  "test/z88/z88-code-injection.test.ts",
  "test/z88/z88-host.test.ts",
  "test/z88/z88-interrupts.test.ts",
  "test/z88/z88-keyboard.test.ts",
  "test/z88/z88-lcd.test.ts",
  "test/z88/z88-oz47-keyclick.test.ts",
  "test/z88/z88-sleep-and-boot.test.ts",
  "test/z88/z88-timeout-coma.test.ts",
  "test/z88/z88-wasm-build.test.ts",
  "test/zx8081/zx8081-wasm-build.test.ts",
  "test/z88/z88-wasm-v2-loader.test.ts",
  "test/zxSpectrum/*WasmV2Machine.test.ts",
  "test/zxSpectrum/p3-*.test.ts",
  "test/zxSpectrum/*-wasm-build.test.ts",
  "test/zxSpectrum/*-wasm-v2-loader.test.ts"
];

/**
 * Klive BASIC programs compiled and run on the cores. Their subject is the compiler and its runtime,
 * so their tier also runs when those change (`scripts/run-tests.cjs`).
 */
export const E2E_KBASIC_TESTS: string[] = [
  "test/kbasic/corpus/**/*.test.ts",
  "test/kbasic/compat/compat.test.ts",
  "test/kbasic/opt/opt-report.test.ts",
  "test/kbasic/oracle/oracle-script.test.ts",
  "test/kbasic/float40/float40-rom.test.ts",
  "test/kbasic/runtime/arith16.test.ts",
  "test/kbasic/runtime/arith32.test.ts",
  "test/kbasic/runtime/arrays.test.ts",
  "test/kbasic/runtime/float.test.ts",
  "test/kbasic/runtime/heap.test.ts",
  "test/kbasic/runtime/keyboard.test.ts",
  "test/kbasic/runtime/print.test.ts",
  "test/kbasic/runtime/program.test.ts",
  "test/kbasic/runtime/strings.test.ts",
  "test/kbasic/codegen/arrays.test.ts",
  "test/kbasic/codegen/asm.test.ts",
  "test/kbasic/codegen/codebank-step.test.ts",
  "test/kbasic/codegen/codebank.test.ts",
  "test/kbasic/codegen/core.test.ts",
  "test/kbasic/codegen/data.test.ts",
  "test/kbasic/codegen/debugger.test.ts",
  "test/kbasic/codegen/fixed.test.ts",
  "test/kbasic/codegen/float.test.ts",
  "test/kbasic/codegen/graphics.test.ts",
  "test/kbasic/codegen/long.test.ts",
  "test/kbasic/codegen/next-target.test.ts",
  "test/kbasic/codegen/routines.test.ts",
  "test/kbasic/codegen/screen-io.test.ts",
  "test/kbasic/codegen/source-errors.test.ts",
  "test/kbasic/codegen/source-jmc.test.ts",
  "test/kbasic/codegen/source-level.test.ts",
  "test/kbasic/codegen/source-step.test.ts",
  "test/kbasic/codegen/source-variables.test.ts",
  "test/kbasic/codegen/stdlib.test.ts",
  "test/kbasic/codegen/strings.test.ts",
  "test/kbasic/codegen/tape.test.ts",
  "test/kbasic/codegen/targets.test.ts"
];
