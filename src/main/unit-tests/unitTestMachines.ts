import { MI_C64, MI_ENTERPRISE, MI_HT1080Z, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48, MI_TVC, MI_ZXNEXT } from "@common/machines/constants";
import { HEADLESS_MACHINE_NAMES } from "@common/headless/headlessMachines";

/*
 * Which machines the unit-test runner drives (`.plans/Z80_UNIT_TESTS_PLAN.md` D18). The cores and
 * their artifact names are the headless machines' (`@common/headless/headlessMachines`); the runner
 * needs a machine whose code can be injected, which the ZX80/ZX81 do not have yet. The HT-1080Z joined
 * with its code injection (`.plans/HT1080Z_CODE_INJECTION_PLAN.md` D9, D-Q6), and the Videoton TVC with
 * its (`.plans/VIDEOTON_TVC_PLAN.md` Phase 7): the runner stops its flow at BASIC's prompt. So does the
 * Enterprise's (`.plans/ENTERPRISE_PLAN.md` Phase 8), at IS-BASIC's.
 */

/** The machines with a runner (D18); the others get `unsupportedMachineMessage` */
export const UNIT_TEST_MACHINES = [MI_SPECTRUM_48, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_ZXNEXT, MI_HT1080Z, MI_TVC, MI_ENTERPRISE];

/** Why the runner cannot run on a machine, or `undefined` when it can */
export function unsupportedMachineMessage(machineId: string | undefined): string | undefined {
  if (machineId && UNIT_TEST_MACHINES.includes(machineId)) return undefined;
  if (machineId === MI_C64) return "Unit tests need a machine with a Z80 core; the Commodore 64 has none.";
  const name = (machineId && HEADLESS_MACHINE_NAMES[machineId]) ?? machineId ?? "this machine";
  return (
    `Unit tests do not run on ${name} yet: they run on the ZX Spectrum 48K, 128K, +2A/+3/+2E/+3E, ` +
    "the ZX Spectrum Next, the HT-1080Z, the Videoton TVC and the Enterprise 64/128."
  );
}
