import type { SysVar } from "@abstractions/SysVar";
import type { DisassemblyOperandLabelResolver } from "../disassemblers/common-types";

import { useEffect, useMemo, useState } from "react";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useSelector } from "@renderer/core/RendererProvider";

import { createSysVarOperandLabelResolver } from "../disassemblers/sys-var-operand-labels";

/** One shared empty table, so "this machine has none" never invents a new array identity. */
const EMPTY_SYS_VARS: SysVar[] = [];

/**
 * Whether two fetched tables describe the same variables.
 *
 * Only the address and the name matter here — those are all a name lookup reads — so a table that
 * differs elsewhere still counts as the same one, and the descriptions (which is most of the bytes
 * in a `SysVar`) are never walked.
 */
function sameSysVars(a: SysVar[], b: SysVar[]): boolean {
  return (
    a.length === b.length &&
    a.every((item, index) => item.address === b[index].address && item.name === b[index].name)
  );
}

/**
 * The current machine's system variable table.
 *
 * The table is **static per machine** — only the values it describes move — so it is fetched once
 * per `machineId` rather than on every disassembly refresh. That matters here more than it does in
 * the System Variables panel: a disassembly refresh already costs a 64K memory read, and a second
 * round trip returning the same 69 (or 244) descriptors every tick would be pure overhead.
 *
 * The array identity is held stable across a fetch that returns the same table, which is load
 * bearing rather than an optimization. Consumers feed this into a disassembler through a `useMemo`,
 * so a fresh array is a fresh resolver is a re-decode of 64K. Worse, `useEmuApi`'s result is only
 * stable because it is held in a ref: anything handing back a new API object per render — a test
 * double, most obviously — would re-run this effect on every render, and a `setState` that always
 * stored a new array would turn that into an unbounded render loop. Storing the previous array
 * when nothing changed makes the loop impossible to start.
 */
export function useMachineSysVars(): SysVar[] {
  const emuApi = useEmuApi();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const [sysVars, setSysVars] = useState<SysVar[]>(EMPTY_SYS_VARS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let vars: SysVar[];
      try {
        vars = (await emuApi.getSysVars()) ?? EMPTY_SYS_VARS;
      } catch {
        // --- A machine that cannot answer simply contributes no names; the listing is unchanged.
        vars = EMPTY_SYS_VARS;
      }
      if (!cancelled) {
        setSysVars((previous) => (sameSysVars(previous, vars) ? previous : vars));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [emuApi, machineId]);

  return sysVars;
}


/**
 * A resolver that names the current machine's system variables in a disassembly.
 *
 * Memoized on the table, because every consumer feeds it to a disassembler that re-runs when the
 * resolver's identity changes — a fresh function per render would re-disassemble 64K per render.
 */
export function useSysVarOperandLabelResolver(): DisassemblyOperandLabelResolver | undefined {
  const sysVars = useMachineSysVars();
  return useMemo(() => createSysVarOperandLabelResolver(sysVars), [sysVars]);
}
