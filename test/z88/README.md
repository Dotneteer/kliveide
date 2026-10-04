# Cambridge Z88 tests

The Z88 tests run on the one Z88 emulation, the WASM core (`src/emu/machines/z88/wasm/`, adapter
`Z88WasmV2Machine`). Until 2026-09-25 every hardware test ran on the TypeScript `Z88Machine` too,
with identical assertions (`.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`); that machine was removed
once the core matched it (`.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`, tag
`z88-typescript-last`), and each suite kept exactly its WASM cases.

## Two kinds of suites

- **Core suites** (`memory-*.test.ts`, `rtc.test.ts`) exercise memory paging, the cards and the RTC
  directly, through `Z88TestSurface` (`z88-test-surface.ts`). `createZ88TestSurface()` gives a fresh
  core (512K internal RAM, a blank 512K ROM card in slot 0, no ROM loaded) driven through its
  exports. The surface's member names are those of the TypeScript memory, cards and Blink device the
  suites were first written against, so the assertions never changed. The Blink register bits the
  suites use are in `z88-blink-flags.ts`.
- **Session suites** (`z88-*.test.ts`, `test/wasm/z88/*`) run programs on the whole machine through
  the harness in `test/harness/z88` (read its README).

`z88-host.test.ts` and `z88-neutral-modules.test.ts` cover the host plumbing and the machine info and
card catalog the renderer shares; `z88-wasm-*.test.ts` and `Z88MachineFactory.test.ts` cover the WASM
build, the loader, the factory and the model-id aliases of the comparison period (`<id>-ts`,
`<id>-wasm`). `z88-typescript-removed.test.ts` keeps the deleted modules deleted and unimported.

## Goldens: what the TypeScript machine did

The suites that compared the core with the TypeScript machine in lockstep
(`test/wasm/z88/wasm-z88-parity.test.ts`, `wasm-z88-ide-parity.test.ts`, the recorded stops of
`wasm-z88-debug-step.test.ts`, the setup of `wasm-z88-machine.test.ts`) and the card-spec test of
`z88-neutral-modules.test.ts` now assert the values the TypeScript machine produced, recorded in
`test/wasm/z88/goldens/` before it was removed (`test/wasm/z88/z88-goldens.ts`): registers, tacts,
frames, the Blink state, and hashes of the 4 MB, the picture and the samples. A golden the core
stops matching is a finding: settle it against the hardware documentation (the Blink documentation,
OZvm), never by editing the golden to fit.

Once a finding *is* settled as a behaviour change, re-record with `Z88_GOLDENS_RECORD=1` and review
the JSON diff key by key before committing. The first time was the RTC fixes of issue #1374
(TSTA latching, TMK kept across RESTIM). Those changed Blink TSTA/TMK values, the OZ execution that
follows from them, and every running digest over them. They changed no LCD picture. The evidence is
in `.plans/CAMBRIDGE_Z88_ISSUE_1374_PLAN.md`, Step 4.

The second time was the OZvm parity work (`.plans/Z88_OZVM_PARITY_PLAN.md`; the list of changes is in
the core's `README.md`). Before re-recording, the running digests were recorded once with the Blink
state's renamed `SBF` key hashed under its old name, `SBR`, so the diff showed only behaviour. Every
changed entry followed from a settled change:
- physical-memory digests: a blank ROM card is $FF, which also fills the part of slot 0 past a 128K
  ROM that the CPU never sees;
- the OZ 4.0 and 3.x boots and typing sessions: COM.RESTIM keeps TSTA, as OZvm's `resetTimx` does;
- one LCD picture per beeper session: the LCD is "off" until SBF and PB0-PB3 are set;
- SCW on the larger LCDs: 80.

OZ 5.0's boot and typing session did not change at all.

## Baseline

The six original core suites ran 887 cases on 2026-09-19. They were parameterized in Step 0.3 of the
migration without changing an assertion, except the paging suite's "constructor works" test, which
inspected TypeScript objects (`instanceof`, `bankData`) and asks the same questions through the
surface.
