import {
  MI_C64,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_ZX80,
  MI_ZX81,
  MI_ZXNEXT
} from "@common/machines/constants";

/*
 * Which machines run headless and which core each loads (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md`
 * D15, D16; `.plans/Z80_UNIT_TESTS_PLAN.md` D18). Kept apart from `HeadlessMachineFactory`, which
 * imports the machine classes: the main process needs only these facts, and only a worker or the
 * command line loads the cores.
 */

/** The cores' artifact names, as the loaders name them */
const SP48_WASM_V2_ARTIFACT_NAME = "zx-spectrum48.wasm";
const SP128_WASM_V2_ARTIFACT_NAME = "zx-spectrum128.wasm";
const SPP3E_WASM_V2_ARTIFACT_NAME = "zx-spectrum-p3e.wasm";
const ZXNEXT_WASM_V2_ARTIFACT_NAME = "zx-spectrum-next.wasm";
const ZX8081_WASM_V2_ARTIFACT_NAME = "zx8081.wasm";

/** The display names of the machines, for refusal messages */
export const HEADLESS_MACHINE_NAMES: Record<string, string> = {
  sp48: "the ZX Spectrum 48K",
  sp128: "the ZX Spectrum 128K",
  spp3e: "the ZX Spectrum +2A/+3/+2E/+3E",
  zxnext: "the ZX Spectrum Next",
  timex: "the Timex TC2048/TC2068/TS2068",
  scorpion: "the Scorpion ZS-256",
  z88: "the Cambridge Z88",
  zx80: "the Sinclair ZX80",
  zx81: "the Sinclair ZX81",
  c64: "the Commodore 64"
};

/** The machines `HeadlessMachineFactory` creates (protocol 1's list: the Spectrums, ZX80/81, Next) */
export const HEADLESS_MACHINES = [MI_SPECTRUM_48, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_ZXNEXT, MI_ZX80, MI_ZX81];

/** Why a machine cannot run headless, or `undefined` when it can */
export function headlessUnsupportedMessage(machineId: string | undefined): string | undefined {
  if (machineId && HEADLESS_MACHINES.includes(machineId)) return undefined;
  const name = (machineId && HEADLESS_MACHINE_NAMES[machineId]) ?? machineId ?? "this machine";
  return (
    `The command line does not run ${name} yet: it runs the ZX Spectrum 48K, 128K, +2A/+3/+2E/+3E, ` +
    "the ZX Spectrum Next, the ZX80 and the ZX81."
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
    case MI_ZX80:
    case MI_ZX81:
      return ZX8081_WASM_V2_ARTIFACT_NAME;
    default:
      throw new Error(
        machineId === MI_C64 ? "The Commodore 64 has no headless core." : headlessUnsupportedMessage(machineId)
      );
  }
}
