import type { MachineConfigSet } from "@common/machines/info-types";
import type { RunnableCompilation } from "@common/unit-tests/runnableCompilation";
import type { UnitTestRunOptions } from "@common/unit-tests/unitTestTypes";

/** What the main process hands the unit-test worker (`.plans/Z80_UNIT_TESTS_PLAN.md` D6, T11) */
export type UnitTestWorkerData = {
  compilation: RunnableCompilation;
  machineId: string;
  modelId?: string;
  config?: MachineConfigSet;
  options: UnitTestRunOptions;
  /** The WASM core's bytes, resolved by the main process */
  artifact: Uint8Array;
  /** The app's public folder, where the ROMs are */
  publicFolder: string;
};
