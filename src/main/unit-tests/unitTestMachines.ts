import { MI_C64, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48, MI_ZXNEXT } from "@common/machines/constants";
import { HEADLESS_MACHINE_NAMES } from "@common/headless/headlessMachines";

/*
 * Which machines the unit-test runner drives (`.plans/Z80_UNIT_TESTS_PLAN.md` D18). The cores and
 * their artifact names are the headless machines' (`@common/headless/headlessMachines`); the runner
 * needs a machine whose code can be injected, which the ZX80/ZX81 do not have yet.
 */

/** The machines with a runner (D18); the others get `unsupportedMachineMessage` */
export const UNIT_TEST_MACHINES = [MI_SPECTRUM_48, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_ZXNEXT];

/** Why the runner cannot run on a machine, or `undefined` when it can */
export function unsupportedMachineMessage(machineId: string | undefined): string | undefined {
  if (machineId && UNIT_TEST_MACHINES.includes(machineId)) return undefined;
  if (machineId === MI_C64) return "Unit tests need a machine with a Z80 core; the Commodore 64 has none.";
  const name = (machineId && HEADLESS_MACHINE_NAMES[machineId]) ?? machineId ?? "this machine";
  return (
    `Unit tests do not run on ${name} yet: they run on the ZX Spectrum 48K, 128K, +2A/+3/+2E/+3E ` +
    "and the ZX Spectrum Next."
  );
}
