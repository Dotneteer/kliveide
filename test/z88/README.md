# Cambridge Z88 tests

Every Z88 hardware test runs on the TypeScript `Z88Machine` and - as soon as the WASM core emulates
what the test needs - on the WASM core too, with identical assertions
(`.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`).

## Features and backends

Each suite declares the features it needs:

```ts
describe.each(z88Backends("memory", "blink"))("Z88 - Banked Memory ($name)", ({ create }) => ...)   // core suites
describe.each(z88HarnessBackends("memory", "cpu", "blink"))("Z88 interrupts (%s)", (backend) => ...) // session suites
```

`Z88_WASM_FEATURES` (`test/harness/z88/core/machines.ts`) lists what the WASM core emulates; a suite
runs on WASM once every feature it needs is in that list. A migration step adds its feature there,
and the suites that were waiting for it start running on WASM with no other change.

| Feature | Migration step | Status |
|---|---|---|
| `memory` - memory map, RAM/ROM cards | 4 | on WASM |
| `cpu` - CPU and frame loop | 5 | on WASM |
| `blink` - ports, RTC, interrupts, flap, battery | 6 | on WASM |
| `keyboard` - key interrupt, sleep detection | 7 | TypeScript only |
| `lcd` - LCD renderer | 8 | TypeScript only |
| `beeper` - audio | 9 | TypeScript only |
| `flashCards` - UV EPROM and flash programming | 10 | TypeScript only |

## Two kinds of suites

- **Core suites** (`memory-*.test.ts`, `rtc.test.ts`) exercise memory paging, the cards and the RTC
  directly, through `Z88TestSurface` (`z88-test-surface.ts`). `create()` gives a fresh machine
  (512K internal RAM, a blank 512K ROM card in slot 0, no ROM loaded). The TypeScript backend
  (`z88-backends.ts`) hands out the real TypeScript card classes and Blink device; the WASM backend
  drives the core's exports.
- **Session suites** (`z88-*.test.ts`, `test/wasm/z88/*`) run programs on the whole machine through
  the harness in `test/harness/z88` (read its README).

`z88-host.test.ts` and `z88-neutral-modules.test.ts` cover the host plumbing and the neutral modules
both backends share; `z88-wasm-*.test.ts` and `Z88MachineFactory.test.ts` cover the WASM build, the
loader and the backend switch. None of these is per-backend.

## Baseline

The six original core suites ran 887 cases on 2026-09-19. They were parameterized in Step 0.3
without changing an assertion, except the paging suite's "constructor works" test, which inspected
TypeScript objects (`instanceof`, `bankData`) and now asks the same questions through the surface.

## Cases that do not run on a backend yet

Only those whose feature the WASM core does not emulate yet - see the table above:
`memory-eprom-io`, `memory-intflash-io`, `memory-amdflash-io` (`flashCards`); `z88-keyboard`,
`z88-sleep-and-boot` (`keyboard`, `lcd`); `z88-lcd` (`lcd`); `z88-beeper` (`beeper`); and the harness
self-tests for keys and audio. No case is excluded for any other reason.
