import { describeHistoryCore } from "./historyCoreSuite";
import { sp48Driver } from "./drivers";

/* The ZX Spectrum 48K's execution history (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` Phase 1) */
describeHistoryCore("the ZX Spectrum 48K", { machineId: "sp48", create: sp48Driver, codeBase: 0x8000 });
