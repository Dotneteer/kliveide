/*
 * The end-to-end test tiers: tests that run the real WASM machine cores.
 *
 * They are most of the suite's time (≈1350 of ≈1590 test-seconds when this was written), and a
 * change that touches none of their inputs cannot change their outcome. `npm test`
 * (`scripts/run-tests.cjs`) therefore always runs the unit tier and runs each tier below only when
 * its inputs changed since it last passed; `npm run test:e2e` and `npm run test:fast` run them
 * regardless (CI and `release:prepare` run `test:fast`). The slowest of them are carved out into a
 * slow tier, `E2E_SLOW_TESTS` at the end of this file, which only `test:slow` and `test:all` run.
 *
 * **Keep this list complete.** A unit-tier test that instantiates a machine core fails with a
 * message pointing here (`test/vitest.setup.ts`), so a new core test cannot quietly slow the unit
 * tier down. Membership was measured, not guessed: every file listed instantiated a core (a
 * WebAssembly instance exporting `sp48*`, `sp128*`, `spp3e*`, `timex*`, `zxnext*`, `z88*`, `zx8081*`, `ht1080z*`, `tvc*`, `ep*` or `z80*`) in a full
 * run, plus the core build/source-contract tests under `test/wasm/`.
 */

/** Tests whose subject is a machine core: its CPU, devices, loaders, debug loop and flows. */
export const E2E_CORE_TESTS: string[] = [
  // --- A tape the File Manager writes, loaded by the 48K ROM (`.plans/FILE_MANAGER_PLAN.md`, Phase 6)
  "test/file-manager/fm-tape-load.test.ts",
  // --- Whole folders: every test in them runs a core or checks a core's sources/build
  "test/wasm/**/*.test.ts",
  "test/zxnext-hw/**/*.test.ts",
  "test/zx8081-hw/**/*.test.ts",
  "test/ht1080z-hw/**/*.test.ts",
  "test/tvc-hw/**/*.test.ts",
  "test/ep-hw/**/*.test.ts",
  "test/sp128-hw/**/*.test.ts",
  "test/timex-hw/**/*.test.ts",
  "test/spectrum-hw/**/*.test.ts",
  // --- The ZX Spectrum timing test kit (`.plans/SPECTRUM_ULA_ACCURACY_PLAN.md` Phase 0); all slow
  "test/spectrum-kit/**/*.test.ts",
  // --- The ROM annotation tools' coverage run (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §6)
  "test/rom-annotations/**/*.test.ts",
  "test/harness/**/self-tests/**/*.test.ts",
  "test/unit-tests/runner-*.test.ts",
  // --- `klive test` on the fixture projects (`.plans/UNIT_TESTS_CLI_PLAN.md` §6)
  "test/cli/klive-test-e2e.test.ts",
  // --- `klive run` on the fixtures, every machine and stop condition (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` §6)
  "test/cli/klive-run-e2e.test.ts",
  // --- z88dk programs (committed zcc output) on the cores (`.plans/Z88DK_INTEGRATION_PLAN.md` §3)
  "test/z88dk/**/*.core.test.ts",

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
  // --- Code/data detection on the real cores (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §8)
  "test/reverse-eng/**/*.core.test.ts",
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
  // --- The test-only "mini" language on the shared Z80 back end (`.plans/SHARED_Z80_BACKEND_PLAN.md` Phase 6)
  "test/z80-backend/minilang/mini-run.test.ts",
  // --- The debugger on zxbc-built Boriel BASIC programs (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §5)
  "test/boriel/boriel-debugger.test.ts",
  "test/boriel/boriel-next.test.ts",
  "test/boriel/boriel-banked.test.ts",
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
  "test/kbasic/codegen/source-step-in-core.test.ts",
  "test/kbasic/codegen/source-step.test.ts",
  "test/kbasic/codegen/source-variables.test.ts",
  "test/kbasic/codegen/stdlib.test.ts",
  "test/kbasic/codegen/strings.test.ts",
  "test/kbasic/codegen/tape.test.ts",
  "test/kbasic/codegen/targets.test.ts"
];

/**
 * The slow end-to-end tier: files taken out of the two lists above because they cost far more than
 * they add to an everyday run - exhaustive sweeps (every ROM, every machine, the whole corpus under
 * the debugger), determinism and contract checks that build the cores twice, and the zxbc
 * compatibility and optimiser reports. They are measured, not guessed: each took 17-143 s of a full
 * local run, ~1090 of its ~2400 test-seconds (`.plans/FAST_SLOW_TEST_TIERS_PLAN.md`).
 *
 * Every entry must also match one of the lists above (that decides the unit-tier guard and the
 * inputs); being here moves it from its fast tier into `e2e-slow`. `npm test`, CI and
 * `release:prepare` never run this tier: `npm run test:slow` and `npm run test:all` do, when a plan
 * is about to complete and before a release is prepared, and so does the manual "Slow tests"
 * workflow. A fast-tier file that grows past the budget (`npm run test:timings`) moves here, or gets
 * cheaper. Exact paths, no globs, so a new test never lands here by accident.
 */
export const E2E_SLOW_TESTS: string[] = [
  // --- The ZX Spectrum timing test kit: the community's test programs on the cores
  // --- (`.plans/SPECTRUM_ULA_ACCURACY_PLAN.md` Phase 0)
  "test/spectrum-kit/timing-tests-48k.test.ts",
  "test/spectrum-kit/timing-tests-128k.test.ts",
  "test/spectrum-kit/halt2int.test.ts",
  "test/spectrum-kit/floating-bus.test.ts",
  "test/spectrum-kit/bobrowski.test.ts",
  "test/spectrum-kit/timing-test.test.ts",
  "test/spectrum-kit/visual.test.ts",
  "test/spectrum-kit/ula-pictures.test.ts",
  // --- The z88dk templates on every Spectrum family model (`.plans/ZX_SPECTRUM_C_TEMPLATES_PLAN.md` T3;
  // --- one per route stays fast in `z88dk-templates-run.core.test.ts`)
  "test/z88dk/z88dk-templates-run-models.core.test.ts",
  // --- Klive BASIC: the zxbc compatibility suites, the optimiser report, the corpus beyond levels 0 and 3 on the 48K
  "test/kbasic/compat/compat.test.ts",
  "test/kbasic/opt/opt-report.test.ts",
  "test/kbasic/corpus/corpus-levels.test.ts",
  "test/kbasic/corpus/corpus-debugger.test.ts",
  "test/kbasic/corpus/corpus-next.test.ts",
  // --- Loaders and machines over every ROM and bank layout
  "test/zxSpectrum/sp128-wasm-v2-loader.test.ts",
  "test/zxSpectrum/spp3e-wasm-v2-loader.test.ts",
  "test/zxSpectrum/ZxSpectrum48WasmV2Machine.test.ts",
  "test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts",
  "test/zxSpectrum/ZxSpectrumP3eWasmV2Machine.test.ts",
  "test/machines/hardware-specs-cores.test.ts",
  // --- Reverse debugging and debug recordings across every machine
  "test/emu/debug-recording-sp48.test.ts",
  "test/emu/debug-recording-cores.test.ts",
  "test/emu/reverse-cores-controller.test.ts",
  "test/emu/reverse-step-back-controller.test.ts",
  "test/emu/reverse-continue-controller.test.ts",
  "test/wasm/reverse/journal-replay-determinism.test.ts",
  // --- Core contracts that build the cores (twice) or replay every export
  "test/wasm/reverse/export-contract.test.ts",
  "test/wasm/state/wasm-layout.test.ts",
  "test/wasm/state/machine-state-determinism.test.ts"
];
