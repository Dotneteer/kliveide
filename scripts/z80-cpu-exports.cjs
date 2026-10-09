/*
 * The exports of `src/emu/z80/wasm/z80-cpu-exports.c` - the shared Z80's registers and debugger state
 * under a core's prefix - and the CPU statics a Klive state file leaves out
 * (`.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md` Phase 2, D8). The C file defines every forwarder for every
 * core; this list decides which a core exports, so the options describe what the core's host reads.
 */

/** Registers the debugger reads and a snapshot load writes: `<prefix>GetCpu<Name>` and `SetCpu<Name>` */
const CPU_REGISTERS = [
  "Af",
  "Bc",
  "De",
  "Hl",
  "AfAlt",
  "BcAlt",
  "DeAlt",
  "HlAlt",
  "Ix",
  "Iy",
  "Ir",
  "Wz",
  "Pc",
  "Sp",
  "Iff1",
  "Iff2",
  "InterruptMode"
];

/**
 * The CPU exports of one core.
 * @param {string} prefix The core's export prefix (`sp48`, `zxnext`, ...)
 * @param {object} [options]
 * @param {boolean} [options.snapshotState] The HALT setter, the EI delay and the RET/RETN flags (the
 *   Spectrum cores' snapshot loading and debugger)
 * @param {boolean} [options.accessLog] The per-instruction data-access log
 * @param {boolean} [options.accessLogOverflows] Its overflow counter (with `accessLog`)
 * @param {boolean} [options.lastPort] The last port access
 */
function cpuExports(prefix, { snapshotState = false, accessLog = false, accessLogOverflows = false, lastPort = false } = {}) {
  const names = [];
  for (const register of CPU_REGISTERS) names.push(`GetCpu${register}`, `SetCpu${register}`);
  names.push("GetCpuHalted", "GetCpuPrefix", "GetStepOutAddress", "GetInterruptDepth");
  if (snapshotState) {
    names.push("SetCpuHalted", "GetCpuEiBacklog", "SetCpuEiBacklog", "GetCpuRetExecuted", "GetCpuRetnExecuted");
  }
  if (accessLog) {
    names.push("GetAccessLogPtr", "GetAccessLogCount");
    if (accessLogOverflows) names.push("GetAccessLogOverflows");
  }
  if (lastPort) names.push("GetLastPortAddress", "GetLastPortValue", "GetLastPortIsWrite");
  return names.map((name) => `${prefix}${name}`);
}

/**
 * The per-instruction access log: debugging state, not machine state, so a restore keeps the live
 * core's bytes
 */
const Z80_ACCESS_LOG_VOLATILE_SYMBOLS = ["z80AccessLog", "z80AccessLogCount", "z80AccessLogOverflows"];

/**
 * The debugger's in-core loop (`src/emu/z80/wasm/z80-debug-loop.c`): where the host writes the breakpoint
 * flags, the loop itself, where the last instruction it ran started (the stop policy's last decision
 * point, and the instruction an access-breakpoint hit is reported against), and its condition plan
 * @param {string} prefix The core's export prefix
 */
function debugLoopExports(prefix) {
  return [`${prefix}BreakpointFlagsPtr`, `${prefix}ExecuteUntilStop`, `${prefix}GetDebugOpStart`, `${prefix}CondPlanPtr`];
}

/**
 * The loop's breakpoint flags and the start of the last instruction it ran: debugging state, written by
 * debug runs only, so a restore keeps the live core's bytes and a replay (fast frames) records the same
 * image as the debug run it replays (WASM_CORE_LEAN_AND_DEBUG_PLAN T9)
 * @param {string} prefix The core's export prefix
 */
function debugLoopVolatileSymbols(prefix) {
  return [`${prefix}BreakpointFlags`, `${prefix}DebugOpStart`, `${prefix}CondPlan`];
}

module.exports = { CPU_REGISTERS, cpuExports, debugLoopExports, debugLoopVolatileSymbols, Z80_ACCESS_LOG_VOLATILE_SYMBOLS };
