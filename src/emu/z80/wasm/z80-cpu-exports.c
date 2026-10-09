/*
 * The shared Z80's registers and debugger state, exported under a core's prefix
 * (`.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md` Phase 2, D8).
 *
 * Every core used to repeat these forwarders by hand. A core now defines `Z80_EXPORT_PREFIX` (its
 * export prefix: `sp48`, `zxnext`, ...) and includes this file after `z80.c`, the way the RZX module
 * takes `RZX_CORE_PREFIX`. Each function only forwards to `z80.c`.
 *
 * Every forwarder is defined for every core; the core's build script decides which are exported
 * (`scripts/z80-cpu-exports.cjs`), and the linker drops the rest. A core that needs its own version
 * of one turns the group off:
 *   - `Z80_EXPORT_NO_LAST_PORT`: the core keeps its own last-port record (the Next).
 * `<prefix>GetCpuTacts` and `<prefix>GetCpuSigInt` are not here: cores differ in what they report
 * (the 48K adds its tact epoch, the ZX80/ZX81 reports the INT line its ULA saw).
 */

#ifndef Z80_EXPORT_PREFIX
#error "Define Z80_EXPORT_PREFIX before including z80-cpu-exports.c"
#endif

#define Z80X_PASTE2(a, b) a##b
#define Z80X_PASTE(a, b) Z80X_PASTE2(a, b)
#define Z80X(name) Z80X_PASTE(Z80_EXPORT_PREFIX, name)

/* A register pair or flag the debugger reads and a snapshot load writes */
#define Z80X_REGISTER(Name)                                    \
  uint32_t Z80X(GetCpu##Name)(void) { return z80Get##Name(); } \
  void Z80X(SetCpu##Name)(uint32_t value) { z80Set##Name(value); }

Z80X_REGISTER(Af)
Z80X_REGISTER(Bc)
Z80X_REGISTER(De)
Z80X_REGISTER(Hl)
Z80X_REGISTER(AfAlt)
Z80X_REGISTER(BcAlt)
Z80X_REGISTER(DeAlt)
Z80X_REGISTER(HlAlt)
Z80X_REGISTER(Ix)
Z80X_REGISTER(Iy)
Z80X_REGISTER(Ir)
Z80X_REGISTER(Wz)
Z80X_REGISTER(Pc)
Z80X_REGISTER(Sp)
Z80X_REGISTER(Iff1)
Z80X_REGISTER(Iff2)
Z80X_REGISTER(InterruptMode)
/* The HALT state and the EI delay: snapshot loading (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.4) */
Z80X_REGISTER(Halted)
Z80X_REGISTER(EiBacklog)

uint32_t Z80X(GetCpuPrefix)(void) { return z80GetPrefix(); }
uint32_t Z80X(GetCpuRetExecuted)(void) { return z80GetRetExecuted(); }
uint32_t Z80X(GetCpuRetnExecuted)(void) { return z80GetRetnExecuted(); }

/*
 * Where a step-out lands: the top of the CPU's shadow stack (`z80GetStepOutAddress`), 0xFFFFFFFF
 * when nothing has been called. The hosts map that to -1.
 */
uint32_t Z80X(GetStepOutAddress)(void) { return z80GetStepOutAddress(); }
/* Interrupt handlers running now, from the shadow stack (source stepping) */
uint32_t Z80X(GetInterruptDepth)(void) { return z80GetInterruptDepth(); }

/* The per-instruction data-access log (`z80.c`) */
uint32_t Z80X(GetAccessLogPtr)(void) { return z80AccessLogPtr(); }
uint32_t Z80X(GetAccessLogCount)(void) { return z80GetAccessLogCount(); }
uint32_t Z80X(GetAccessLogOverflows)(void) { return z80GetAccessLogOverflows(); }

#ifndef Z80_EXPORT_NO_LAST_PORT
/* The last port access, while the core captures bus events */
uint32_t Z80X(GetLastPortAddress)(void) { return z80GetLastPortAddress(); }
uint32_t Z80X(GetLastPortValue)(void) { return z80GetLastPortValue(); }
uint32_t Z80X(GetLastPortIsWrite)(void) { return z80GetLastPortIsWrite(); }
#endif

#undef Z80X_REGISTER
#undef Z80X
#undef Z80X_PASTE
#undef Z80X_PASTE2
#undef Z80_EXPORT_PREFIX
#undef Z80_EXPORT_NO_LAST_PORT
