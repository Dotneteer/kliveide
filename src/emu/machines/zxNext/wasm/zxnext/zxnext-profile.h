#ifndef ZXNEXT_PROFILE_H
#define ZXNEXT_PROFILE_H

/*
 * Which ZX Spectrum Next this artifact emulates (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D3): one C
 * source tree, one WASM artifact per distinct hardware, chosen by these defines. The build passes
 * them per artifact (`scripts/zxnext-artifacts.cjs`); without them the artifact is KS2 with core
 * 3.02.01, the Next every Klive before Next models emulated.
 *
 * A behaviour that differs between core versions is guarded by the version it appeared in, citing
 * the VHDL of both versions (`zxnext.vhd@3.02.04 ~NNNN`):
 *
 *   #if ZXNEXT_CORE_VERSION >= 30204
 *     ... new behaviour ...
 *   #endif
 *
 * Every such guard leaves the 3.02.01 artifact byte-identical in what it does: its boot traces and
 * goldens are the proof.
 */

/* The core version as MMmmss: 30201 is 3.02.01 (zxnext_top_issue4.vhd g_version, g_sub_version) */
#ifndef ZXNEXT_CORE_VERSION
#define ZXNEXT_CORE_VERSION 30201
#endif

/* g_board_issue, as NextReg $0F reads it: 2 is an Issue 4 board (KS2) */
#ifndef ZXNEXT_BOARD_ISSUE
#define ZXNEXT_BOARD_ISSUE 2
#endif

/* NextReg $01 (major << 4 | minor) and $0E (sub-minor) */
#define ZXNEXT_CORE_VERSION_MAJOR (ZXNEXT_CORE_VERSION / 10000)
#define ZXNEXT_CORE_VERSION_MINOR ((ZXNEXT_CORE_VERSION / 100) % 100)
#define ZXNEXT_CORE_VERSION_SUB_MINOR (ZXNEXT_CORE_VERSION % 100)
#define ZXNEXT_NR_01_VALUE ((ZXNEXT_CORE_VERSION_MAJOR << 4) | ZXNEXT_CORE_VERSION_MINOR)

#endif
