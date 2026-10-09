/*
 * The debugger's in-core loop, shared by every core that has one (`.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md`
 * Phase 2, D7; Phase 4a brings it to every core and widens what it decides, D13).
 *
 * A core defines `Z80_DEBUG_LOOP_PREFIX` (its export prefix) and includes this file after its
 * `<prefix>ExecuteInstruction` and `<prefix>FrameCompleted` exist. It provides:
 *   - `<prefix>BreakpointFlags`, a 64K table of per-address flags (`DebugSupport.breakpointFlags`), copied
 *     in by the host when a debug run starts; the core does not interpret them beyond the mask it is
 *     given;
 *   - `<prefix>BreakpointFlagsPtr`, where the host writes it;
 *   - `<prefix>ExecuteUntilStop(extraStop, mask)`.
 */

#ifndef Z80_DEBUG_LOOP_PREFIX
#error "Define Z80_DEBUG_LOOP_PREFIX before including z80-debug-loop.c"
#endif

#define Z80D_PASTE2(a, b) a##b
#define Z80D_PASTE(a, b) Z80D_PASTE2(a, b)
#define Z80D(name) Z80D_PASTE(Z80_DEBUG_LOOP_PREFIX, name)

static uint16_t Z80D(BreakpointFlags)[0x10000];

uint32_t Z80D(BreakpointFlagsPtr)(void) { return (uint32_t)(uintptr_t)Z80D(BreakpointFlags); }

/*
 * The debugger's fast path: runs instructions until the frame completes or the PC reaches a place the
 * stop policy may stop at - an address whose flags meet `mask`, or `extraStop` (a run-to point, a
 * step-over or step-out target; any value above $FFFF means none). Returns how many instructions ran.
 * The host then applies the whole stop policy at that PC, exactly as after a single instruction, so a
 * candidate that is not a stop (a disabled breakpoint, another partition) only costs a boundary call.
 */
uint32_t Z80D(ExecuteUntilStop)(uint32_t extraStop, uint32_t mask) {
  uint32_t executed = 0u;
  do {
    Z80D(ExecuteInstruction)();
    executed++;
    /* A reverse-debugging stop target (REVERSE_DEBUGGING_PLAN D4): the host asks the recorder after the call */
    if (z80HistoryStopNow() != 0u) break;
    const uint16_t pc = cpu.pc;
    if ((Z80D(BreakpointFlags)[pc] & mask) || pc == extraStop) break;
  } while (!Z80D(FrameCompleted));
  return executed;
}

#undef Z80D
#undef Z80D_PASTE
#undef Z80D_PASTE2
#undef Z80_DEBUG_LOOP_PREFIX
