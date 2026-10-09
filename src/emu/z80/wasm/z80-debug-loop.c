/*
 * The debugger's in-core loop, shared by every core that has one (`.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md`
 * Phase 2, D7; Phase 4a brings it to every core and widens what it decides, D13).
 *
 * A core defines `Z80_DEBUG_LOOP_PREFIX` (its export prefix) and includes this file after its
 * `<prefix>ExecuteInstruction` and `<prefix>FrameCompleted` exist. Optionally:
 *   - `Z80_DEBUG_LOOP_FRAME_COMPLETED`: the frame-completed expression, when it is not
 *     `<prefix>FrameCompleted` (the Next's is `frameCompleted`);
 *   - `Z80_DEBUG_LOOP_STOP()`: nonzero when the loop must return for the host after an instruction, as
 *     the core's own frame loop does (the Next's SD host command and reset request);
 *   - `Z80_DEBUG_LOOP_ACCESS_HIT(accessMask)`: the access-breakpoint test of the last instruction, when the
 *     core's bus record is not the shared Z80's (the Z88's own record, the Next's own port record).
 * It provides:
 *   - `<prefix>BreakpointFlags`, a 64K table of per-address flags (`DebugSupport.breakpointFlags`), copied
 *     in by the host when a debug run starts; the core does not interpret them beyond the mask it is
 *     given;
 *   - `<prefix>BreakpointFlagsPtr`, where the host writes it;
 *   - `<prefix>ExecuteUntilStop(extraStop, mask, accessMask)`;
 *   - `<prefix>GetDebugOpStart`, where the last instruction the loop ran started;
 *   - `<prefix>CondPlanPtr`, the conditions the loop may decide itself (Phase 4c, below).
 */

#ifndef Z80_DEBUG_LOOP_PREFIX
#error "Define Z80_DEBUG_LOOP_PREFIX before including z80-debug-loop.c"
#endif

#define Z80D_PASTE2(a, b) a##b
#define Z80D_PASTE(a, b) Z80D_PASTE2(a, b)
#define Z80D(name) Z80D_PASTE(Z80_DEBUG_LOOP_PREFIX, name)
#ifndef Z80_DEBUG_LOOP_FRAME_COMPLETED
#define Z80_DEBUG_LOOP_FRAME_COMPLETED Z80D(FrameCompleted)
#endif
#ifndef Z80_DEBUG_LOOP_STOP
#define Z80_DEBUG_LOOP_STOP() 0
#endif

static uint16_t Z80D(BreakpointFlags)[0x10000];

uint32_t Z80D(BreakpointFlagsPtr)(void) { return (uint32_t)(uintptr_t)Z80D(BreakpointFlags); }

/* Where the last instruction the loop ran started: the instruction a memory/I/O breakpoint hit is reported against */
static uint16_t Z80D(DebugOpStart);

uint32_t Z80D(GetDebugOpStart)(void) { return Z80D(DebugOpStart); }

/*
 * The host's access-breakpoint bits in the flags (`DebugSupport`: MEM_READ_BP, MEM_WRITE_BP, IO_READ_BP,
 * IO_WRITE_BP). A port breakpoint's flags are set at every port its mask matches, so a port is looked up
 * like an address.
 */
#define Z80_DEBUG_FLAG_MEM_READ 0x08u
#define Z80_DEBUG_FLAG_MEM_WRITE 0x10u
#define Z80_DEBUG_FLAG_IO_READ 0x20u
#define Z80_DEBUG_FLAG_IO_WRITE 0x40u

/*
 * Conditions decided in the core (Phase 4c). A false condition neither counts a hit nor stops nor logs,
 * so where every breakpoint at an address has a condition, the loop may run past the address when all
 * of them are false. The host marks such an address with `Z80_DEBUG_FLAG_CONDITION` instead of its
 * execution bits and lists its condition programs (slots of `z80-condition.c`) in the plan; anything
 * else - a true condition, an error, an address missing from the plan - stops, and the host decides and
 * counts as it does for every stop.
 *
 * The plan, in 32-bit words: [0] the entry count; then `Z80_DEBUG_COND_ENTRIES` entries of three words
 * (the address, the first slot index, the slot count); then `Z80_DEBUG_COND_SLOTS` slot numbers.
 */
#define Z80_DEBUG_FLAG_CONDITION 0x4000u
#define Z80_DEBUG_COND_ENTRIES 128u
#define Z80_DEBUG_COND_SLOTS 256u
#define Z80_DEBUG_COND_SLOT_BASE (1u + 3u * Z80_DEBUG_COND_ENTRIES)
/* `ConditionResult.FALSE`, `COND_RESULT_FALSE` in z80-condition.c (included after this file) */
#define Z80_DEBUG_COND_FALSE 0u

uint32_t condEvaluate(uint32_t slot, uint32_t accessValue, uint32_t accessAddress);

static uint32_t Z80D(CondPlan)[Z80_DEBUG_COND_SLOT_BASE + Z80_DEBUG_COND_SLOTS];

uint32_t Z80D(CondPlanPtr)(void) { return (uint32_t)(uintptr_t)Z80D(CondPlan); }

/* Whether every condition the plan lists for `pc` is false now: then the loop runs on */
static uint32_t Z80D(ConditionsAllFalse)(uint16_t pc) {
  const uint32_t *plan = Z80D(CondPlan);
  const uint32_t entries = plan[0] < Z80_DEBUG_COND_ENTRIES ? plan[0] : Z80_DEBUG_COND_ENTRIES;
  for (uint32_t i = 0u; i < entries; i++) {
    const uint32_t *entry = &plan[1u + 3u * i];
    if (entry[0] != pc) continue;
    if (entry[2] == 0u || entry[1] + entry[2] > Z80_DEBUG_COND_SLOTS) return 0u;
    for (uint32_t k = 0u; k < entry[2]; k++) {
      if (condEvaluate(plan[Z80_DEBUG_COND_SLOT_BASE + entry[1] + k], 0u, 0u) != Z80_DEBUG_COND_FALSE) return 0u;
    }
    return 1u;
  }
  return 0u;
}

#ifndef Z80_DEBUG_LOOP_ACCESS_HIT
/*
 * Whether the last instruction read or wrote a flagged address or accessed a flagged port, from the shared
 * Z80's bus record (`z80AccessLog`, the port event) - which a debug run captures. A candidate only: the
 * host decides (disabled breakpoints, partitions, conditions, hit counts) as it does after every
 * instruction.
 */
static inline uint32_t Z80D(AccessHit)(uint32_t accessMask) {
  const uint16_t *flags = Z80D(BreakpointFlags);
  const uint32_t count = z80AccessLogCount < Z80_ACCESS_LOG_CAPACITY ? z80AccessLogCount : Z80_ACCESS_LOG_CAPACITY;
  for (uint32_t i = 0u; i < count; i++) {
    const uint32_t entry = z80AccessLog[i];
    const uint32_t bit = (entry & Z80_ACCESS_LOG_WRITE) != 0u ? Z80_DEBUG_FLAG_MEM_WRITE : Z80_DEBUG_FLAG_MEM_READ;
    if ((flags[entry & 0xffffu] & bit & accessMask) != 0u) return 1u;
  }
  if (cpu.hasPortEvent) {
    const uint32_t bit = cpu.lastPortIsWrite ? Z80_DEBUG_FLAG_IO_WRITE : Z80_DEBUG_FLAG_IO_READ;
    if ((flags[cpu.lastPortAddress] & bit & accessMask) != 0u) return 1u;
  }
  return 0u;
}
#define Z80_DEBUG_LOOP_ACCESS_HIT(accessMask) Z80D(AccessHit)(accessMask)
#endif

/*
 * The debugger's fast path: runs instructions until the frame completes or the PC reaches a place the
 * stop policy may stop at - an address whose flags meet `mask`, or `extraStop` (a run-to point, a
 * step-over or step-out target; any value above $FFFF means none). Returns how many instructions ran.
 * The host then applies the whole stop policy at that PC, exactly as after a single instruction, so a
 * candidate that is not a stop (a disabled breakpoint, another partition) only costs a boundary call.
 * `accessMask` (0: none) also stops after an instruction that touched an address or port whose flags meet
 * it (`Z80_DEBUG_LOOP_ACCESS_HIT`).
 */
uint32_t Z80D(ExecuteUntilStop)(uint32_t extraStop, uint32_t mask, uint32_t accessMask) {
  uint32_t executed = 0u;
  do {
    Z80D(DebugOpStart) = cpu.pc;
    Z80D(ExecuteInstruction)();
    executed++;
    /* A reverse-debugging stop target (REVERSE_DEBUGGING_PLAN D4): the host asks the recorder after the call */
    if (z80HistoryStopNow() != 0u) break;
    const uint16_t pc = cpu.pc;
    const uint32_t flags = Z80D(BreakpointFlags)[pc] & mask;
    if ((flags & ~Z80_DEBUG_FLAG_CONDITION) != 0u || pc == extraStop) break;
    if ((flags & Z80_DEBUG_FLAG_CONDITION) != 0u && !Z80D(ConditionsAllFalse)(pc)) break;
    if (accessMask != 0u && Z80_DEBUG_LOOP_ACCESS_HIT(accessMask)) break;
    if (Z80_DEBUG_LOOP_STOP()) break;
  } while (!Z80_DEBUG_LOOP_FRAME_COMPLETED);
  return executed;
}

#undef Z80D
#undef Z80D_PASTE
#undef Z80D_PASTE2
#undef Z80_DEBUG_LOOP_PREFIX
#undef Z80_DEBUG_LOOP_FRAME_COMPLETED
#undef Z80_DEBUG_LOOP_STOP
#undef Z80_DEBUG_LOOP_ACCESS_HIT
