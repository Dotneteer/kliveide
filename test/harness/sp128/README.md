# ZX Spectrum 128K / +2E / +3E test harness

Scripts one real ZX Spectrum 128K or +2E/+3E — the WASM core the app runs, with the real ROMs
(`src/public/roms/sp128-*.rom`, `spp3e-*.rom`) — from a vitest test. Built for the snapshot loader
(`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` Phase 3), which needs paging, the AY and the frame position
of these machines. Its 48K sibling is `../sp48/`; the conventions are the same.

```ts
import { expect, it } from "vitest";
import { createSp128Session } from "../harness/sp128";

it("pages bank 3 in from a snapshot", async () => {
  const s = await createSp128Session("sp128");
  s.loadSnapshot("game.z80", bytes);
  expect(s.paging().bank).toBe(3);
});
```

## API

| Group | Method | What it does |
| --- | --- | --- |
| Create | `createSp128Session(model)` | `model` is `"sp128"` (the 128K) or a +2E/+3E model: `"nofdd"`, `"fdd1"`, `"fdd2"`. Builds the WASM core once per test process and sets the machine up with the real ROMs. |
| | `createHarnessSpectrumMachine(machineId, modelId, config)` | A set-up machine of any Spectrum type (48K included) with the real ROMs, for tests that drive a `MachineController` as `MachineService` does. |
| Snapshot | `loadSnapshot(name, bytes)` | Parses a `.sna`/`.z80`/`.szx` file (its extension picks the format) and loads it with `loadSnapshotState`, as the emulator does; returns the frame tact. |
| | `captureSnapshot()` | Reads the machine's state as a snapshot model with `captureSnapshotState`, without changing it. |
| | `saveSnapshot(format)` | Captures and writes a `.sna`/`.z80`/`.szx` file, as the emulator saves one; returns `{ bytes, losses }` and throws when the format refuses the state. |
| Run | `runFrames(n)`, `step(n)` | Whole frames; single instructions. |
| Memory | `peek(address)`, `bank(n)` | A byte of the 64K the CPU sees; a RAM bank as stored. |
| Paging | `paging()` | `{ bank, rom, shadowScreen, locked }`, plus `specialPaging` and `diskMotor` on the +2E/+3E. |
| AY | `psgRegister(n)`, `psgSelected()` | A register's value (the selection is restored after reading); the selected register. |
| ULA | `frameTact()`, `border()` | T-states since the frame started; the border colour. |
| CPU | `cpu()` | Every register read from the core, with IFF1/IFF2, IM, HALT and the EI backlog. |

## Notes

- Runs through the machine's public API (`executeMachineFrame`, `executionContext`,
  `doReadMemory`) and the core's own getters; nothing is mocked.
- Self-tests: `self-tests/session.test.ts`. Both are in the e2e-cores tier (`build/e2e-tests.ts`).
