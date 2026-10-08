import { MI_C64, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48, MI_ZXNEXT } from "@common/machines/constants";

/*
 * Which machines the unit-test runner drives, and which core each loads
 * (`.plans/Z80_UNIT_TESTS_PLAN.md` D18). Kept apart from `HeadlessMachineFactory`, which imports the
 * machine classes: the main process needs only these facts, and only the worker loads the cores.
 */

/** The core's artifact names, as the loaders name them */
const SP48_WASM_V2_ARTIFACT_NAME = "zx-spectrum48.wasm";
const SP128_WASM_V2_ARTIFACT_NAME = "zx-spectrum128.wasm";
const SPP3E_WASM_V2_ARTIFACT_NAME = "zx-spectrum-p3e.wasm";
const ZXNEXT_WASM_V2_ARTIFACT_NAME = "zx-spectrum-next.wasm";

/** The display names of the machines, for the refusal message */
const MACHINE_NAMES: Record<string, string> = {
  sp48: "the ZX Spectrum 48K",
  sp128: "the ZX Spectrum 128K",
  spp3e: "the ZX Spectrum +2A/+3/+2E/+3E",
  zxnext: "the ZX Spectrum Next",
  timex: "the Timex TC2048/TC2068/TS2068",
  scorpion: "the Scorpion ZS-256",
  z88: "the Cambridge Z88",
  zx80: "the Sinclair ZX80",
  zx81: "the Sinclair ZX81"
};

/** The machines with a runner (D18); the others get `unsupportedMachineMessage` */
export const UNIT_TEST_MACHINES = [MI_SPECTRUM_48, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_ZXNEXT];

/** Why the runner cannot run on a machine, or `undefined` when it can */
export function unsupportedMachineMessage(machineId: string | undefined): string | undefined {
  if (machineId && UNIT_TEST_MACHINES.includes(machineId)) return undefined;
  if (machineId === MI_C64) return "Unit tests need a machine with a Z80 core; the Commodore 64 has none.";
  const name = (machineId && MACHINE_NAMES[machineId]) ?? machineId ?? "this machine";
  return (
    `Unit tests do not run on ${name} yet: they run on the ZX Spectrum 48K, 128K, +2A/+3/+2E/+3E ` +
    "and the ZX Spectrum Next."
  );
}

/** The WASM artifact a machine loads */
export function artifactNameOf(machineId: string): string {
  switch (machineId) {
    case MI_SPECTRUM_48:
      return SP48_WASM_V2_ARTIFACT_NAME;
    case MI_SPECTRUM_128:
      return SP128_WASM_V2_ARTIFACT_NAME;
    case MI_SPECTRUM_3E:
      return SPP3E_WASM_V2_ARTIFACT_NAME;
    case MI_ZXNEXT:
      return ZXNEXT_WASM_V2_ARTIFACT_NAME;
    default:
      throw new Error(unsupportedMachineMessage(machineId));
  }
}
