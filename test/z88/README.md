# Cambridge Z88 tests

Every Z88 hardware test runs on **every emulation backend** - today the TypeScript `Z88Machine`, and
from Step 4 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md` the WASM core as well, with identical
assertions.

## Two kinds of suites

- **Core suites** (`memory-*.test.ts`, `rtc.test.ts`) exercise memory paging, the cards and the RTC
  directly, through `Z88TestSurface` (`z88-test-surface.ts`). Their top-level block is
  `describe.each(Z88_BACKENDS)("... ($name)", ({ create }) => ...)`; `create()` gives a fresh
  machine (512K internal RAM, a blank 512K ROM card in slot 0, no ROM loaded). The TypeScript
  backend (`z88-backends.ts`) hands out the real TypeScript card classes and Blink device.
- **Session suites** (`z88-*.test.ts`) run programs on the whole machine through the harness in
  `test/harness/z88` (read its README), looping over `Z88_HARNESS_BACKENDS`.

`z88-host.test.ts` and `z88-neutral-modules.test.ts` cover the host plumbing and the neutral modules
both backends share; they are not per-backend.

## Baseline

The six original core suites ran 887 cases on 2026-09-19. They were parameterized in Step 0.3
without changing an assertion, except the paging suite's "constructor works" test, which inspected
TypeScript objects (`instanceof`, `bankData`) and now asks the same questions through the surface.

## Cases that do not run on a backend

None. A case that cannot run on a backend must be listed here with its reason.
