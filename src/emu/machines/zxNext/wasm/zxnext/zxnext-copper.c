#include "zxnext-copper.h"
#include "zxnext-nextreg.h"

static uint8_t zxnextCopperMemory[0x800];
static uint8_t zxnextCopperStartMode;
static uint16_t zxnextCopperInstructionAddress;
static uint8_t zxnextCopperStoredByte;
static uint16_t zxnextCopperListAddress;
static uint16_t zxnextCopperListData;
static uint8_t zxnextCopperDout;
static uint8_t zxnextCopperVerticalLineOffset;

// ---------------------------------------------------------------------------
// Beam tracking
//
// The WASM core has no per-tact raster of its own: `zxnextFrameExecute` only runs CPU
// instructions, and the picture is drawn lazily by the beam-racing raster in zxnext-ula.c
// (a copper MOVE catches the raster up to zxnextCopperFrameTact before it writes).
// A copper is a beam-position device, so it needs its own beam counters. These counters mirror
// `_copperCurrentLine` / `_copperCurrentColumn` in `ZxNextMachine.onTactIncremented`
// exactly — same ULA tact domain (`currentFrameTact`), same per-frame reset — so the two
// cores stay comparable.
//
// See .plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md 15.5c / 15.10.
// ---------------------------------------------------------------------------

// 311 lines at 50Hz, which is the geometry this core is fixed to
// (ZXNEXT_RENDERING_TACTS_IN_FRAME is 456 * 311). Derived rather than restated so the two
// cannot disagree.
#define ZXNEXT_COPPER_TOTAL_VC (ZXNEXT_RENDERING_TACTS_IN_FRAME / ZXNEXT_SCREEN_TOTAL_HC)
// First active display line — the hardware's `ula_min_vactive`, where `cvc` is loaded.
#define ZXNEXT_COPPER_DISPLAY_Y_START zxnextTimingDisplayYStart
// Raw HC at which `hc_ula` wraps to 0: `c_min_hactive - 12`, twelve pixels before paper x 0 (raw 144).
#define ZXNEXT_COPPER_HC_ULA_ORIGIN (zxnextTimingDisplayXStart - 12u)
// The copper runs on the 28 MHz clock: four ticks per horizontal position.
#define ZXNEXT_COPPER_TICKS_PER_HC 4u

// ULA tact this core has already advanced the copper through, within the current frame.
static uint32_t zxnextCopperFrameTact;
static uint32_t zxnextCopperCurrentLine;
static uint32_t zxnextCopperCurrentColumn;

static void zxnextCopperReset(void) {
  zxnextCopperStartMode = 0u;
  zxnextCopperInstructionAddress = 0u;
  zxnextCopperStoredByte = 0u;
  zxnextCopperListAddress = 0u;
  zxnextCopperListData = 0u;
  zxnextCopperDout = 0u;
  zxnextCopperVerticalLineOffset = 0u;
  zxnextCopperFrameTact = 0u;
  zxnextCopperCurrentLine = 0u;
  zxnextCopperCurrentColumn = 0u;
  // --- Copper list RAM (dpram2) is not cleared by a reset (copper.vhd / zxnext.vhd reset branches
  // --- clear only the pointer, mode, write address, stored byte and $64); see zxnextCopperHardReset.
}

// Power-on: the list RAM starts empty.
static void zxnextCopperHardReset(void) {
  zxnextCopperReset();
  for (uint32_t i = 0u; i < 0x800u; i++) zxnextCopperMemory[i] = 0u;
}

static void zxnextCopperSetNextReg(uint32_t reg, uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  switch (reg & 0xffu) {
    case 0x60u:
      // --- zxnext.vhd: a $60 write at an even address also stores the byte a $63 write commits as MSB
      if ((zxnextCopperInstructionAddress & 0x0001u) == 0u) zxnextCopperStoredByte = byteValue;
      zxnextCopperMemory[zxnextCopperInstructionAddress] = byteValue;
      zxnextCopperInstructionAddress = (zxnextCopperInstructionAddress + 1u) & 0x7ffu;
      break;
    case 0x61u:
      zxnextCopperInstructionAddress = (zxnextCopperInstructionAddress & 0x700u) | byteValue;
      break;
    case 0x62u: {
      uint8_t newMode = (byteValue >> 6u) & 0x03u;
      zxnextCopperInstructionAddress = ((uint16_t)(byteValue & 0x07u) << 8u) |
        (zxnextCopperInstructionAddress & 0x0ffu);
      if (newMode != zxnextCopperStartMode) {
        zxnextCopperStartMode = newMode;
        if (newMode == 1u || newMode == 3u) zxnextCopperListAddress = 0u;
        zxnextCopperDout = 0u;
        // While stopped the beam counters are left to go stale (see zxnextCopperAdvanceTo),
        // so they must be brought back to the present the moment the copper is started.
        if (newMode != 0u) zxnextCopperResyncBeam();
      }
      break;
    }
    case 0x63u:
      if (zxnextCopperInstructionAddress & 0x0001u) {
        zxnextCopperMemory[zxnextCopperInstructionAddress & 0x7feu] = zxnextCopperStoredByte;
        zxnextCopperMemory[zxnextCopperInstructionAddress] = byteValue;
      } else {
        // --- zxnext.vhd: the byte is stored only at an even address
        zxnextCopperStoredByte = byteValue;
      }
      zxnextCopperInstructionAddress = (zxnextCopperInstructionAddress + 1u) & 0x7ffu;
      break;
    case 0x64u:
      zxnextCopperVerticalLineOffset = byteValue;
      break;
    default:
      break;
  }
}

static uint32_t zxnextCopperGetNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x61u: return zxnextCopperInstructionAddress & 0xffu;
    case 0x62u: return ((uint32_t)zxnextCopperStartMode << 6u) | ((zxnextCopperInstructionAddress & 0x700u) >> 8u);
    case 0x64u: return zxnextCopperVerticalLineOffset;
    default: return 0u;
  }
}

// Convert a raw ULA vertical counter into the copper line (hardware `cvc`). Mirrors
// NextComposedScreenDevice.vcToCopperLine in the TypeScript core.
static inline uint32_t zxnextCopperVcToCopperLine(uint32_t vc) {
  return (vc + ZXNEXT_COPPER_TOTAL_VC - ZXNEXT_COPPER_DISPLAY_Y_START +
          zxnextCopperVerticalLineOffset) % ZXNEXT_COPPER_TOTAL_VC;
}

// Bring the beam counters to `frameTact` without executing anything. Used when the copper
// starts, because a stopped copper does not advance them (see zxnextCopperAdvanceTo).
static void zxnextCopperResyncBeam(void) {
  zxnextCopperFrameTact = currentFrameTact;
  zxnextCopperCurrentLine = currentFrameTact / ZXNEXT_SCREEN_TOTAL_HC;
  zxnextCopperCurrentColumn = currentFrameTact % ZXNEXT_SCREEN_TOTAL_HC;
}

// Reset the beam for a new frame. Called when a frame completes, which is equivalent to
// ZxNextMachine.onInitNewFrame resetting the counters at frame start: nothing ticks in
// between.
static void zxnextCopperOnFrameCompleted(void) {
  zxnextCopperFrameTact = 0u;
  zxnextCopperCurrentLine = 0u;
  zxnextCopperCurrentColumn = 0u;
}

// Run the copper up to (but not including) ULA tact `frameTact`.
//
// A stopped copper returns immediately rather than maintaining counters, because this sits
// on the hot path — `zxnextCpuTactPlusN` runs for every memory and port access — and the
// overwhelmingly common case is software that never touches the copper at all. The counters
// are resynced by zxnextCopperResyncBeam when the copper is started.
// The copper beam, hardware (`cvc`, `hc_ula`), at a raw position. Mirrors
// NextComposedScreenDevice.copperLineAt / copperHcAt: `cvc` advances when `hc_ula` wraps.
static inline uint32_t zxnextCopperLineAt(uint32_t vc, uint32_t hc) {
  return zxnextCopperVcToCopperLine(hc >= ZXNEXT_COPPER_HC_ULA_ORIGIN ? vc : vc + ZXNEXT_COPPER_TOTAL_VC - 1u);
}

static inline uint32_t zxnextCopperHcAt(uint32_t hc) {
  return (hc + ZXNEXT_SCREEN_TOTAL_HC - ZXNEXT_COPPER_HC_ULA_ORIGIN) % ZXNEXT_SCREEN_TOTAL_HC;
}

// The line interrupt pulse ($22/$23). Mirrors NextComposedScreenDevice.lineInterruptStartTact: it
// starts at hc_ula 255 of copper line L-1 (the last line for L = 0), $64 offset included, and lasts as
// long as the ULA interrupt pulse. Kept here because it is expressed in the copper's beam coordinates.
static uint32_t zxnextVideoLineIntActive(uint32_t frameTact) {
  uint32_t line = lineInterrupt & 0x1ffu;
  uint32_t targetCvc = line == 0u ? ZXNEXT_COPPER_TOTAL_VC - 1u : line - 1u;
  uint32_t rawVc = (targetCvc + ZXNEXT_COPPER_DISPLAY_Y_START + ZXNEXT_COPPER_TOTAL_VC - zxnextCopperVerticalLineOffset) %
    ZXNEXT_COPPER_TOTAL_VC;
  uint32_t start = rawVc * ZXNEXT_SCREEN_TOTAL_HC + ZXNEXT_COPPER_HC_ULA_ORIGIN + 255u;
  uint32_t elapsed = (frameTact + ZXNEXT_RENDERING_TACTS_IN_FRAME - start) % ZXNEXT_RENDERING_TACTS_IN_FRAME;
  return elapsed < (zxnextTimingIntEnd - zxnextTimingIntStart);
}

static void zxnextCopperAdvanceTo(uint32_t frameTact) {
  if (zxnextCopperStartMode == 0u) return;
  while (zxnextCopperFrameTact < frameTact) {
    uint32_t cvc = zxnextCopperLineAt(zxnextCopperCurrentLine, zxnextCopperCurrentColumn);
    uint32_t hcUla = zxnextCopperHcAt(zxnextCopperCurrentColumn);
    for (uint32_t tick = 0u; tick < ZXNEXT_COPPER_TICKS_PER_HC; tick++) zxnextCopperExecuteTick(cvc, hcUla);
    zxnextCopperCurrentColumn++;
    if (zxnextCopperCurrentColumn >= ZXNEXT_SCREEN_TOTAL_HC) {
      zxnextCopperCurrentColumn = 0u;
      zxnextCopperCurrentLine++;
    }
    zxnextCopperFrameTact++;
  }
}

// The copper compares against `cvc`, the copper-offset vertical counter built in
// `zxula_timing.vhd`, not the raw ULA vertical counter: `zxnext.vhd` wires
// `vcount_i => cvc`, and `copper.vhd` has no offset input of its own. The caller supplies
// the already-rebased line (see NextComposedScreenDevice.vcToCopperLine).
// See .plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md 15.5.
static void zxnextCopperExecuteTick(uint32_t cvc, uint32_t hc) {
  if (zxnextCopperStartMode == 0u) return;
  if (zxnextCopperStartMode == 3u && cvc == 0u && hc == 0u) {
    zxnextCopperListAddress = 0u;
    zxnextCopperDout = 0u;
    return;
  }
  if (zxnextCopperDout) {
    uint32_t reg = (zxnextCopperListData >> 8u) & 0x7fu;
    uint32_t val = zxnextCopperListData & 0xffu;
    // --- The copper lags the CPU: the write happens at the copper's tact, not currentFrameTact.
    zxnextNextRegWriteTactOverride = zxnextCopperFrameTact;
    zxnextNextRegSetDirect(reg, val);
    zxnextNextRegWriteTactOverride = 0xffffffffu;
    zxnextCopperDout = 0u;
    return;
  }
  zxnextCopperListData =
    ((uint16_t)zxnextCopperMemory[zxnextCopperListAddress * 2u] << 8u) |
    zxnextCopperMemory[zxnextCopperListAddress * 2u + 1u];
  if (zxnextCopperListData & 0x8000u) {
    uint32_t waitLine = zxnextCopperListData & 0x1ffu;
    uint32_t waitHc = ((zxnextCopperListData >> 9u) & 0x3fu) * 8u + 12u;
    if (cvc == waitLine && hc >= waitHc) {
      zxnextCopperListAddress = (zxnextCopperListAddress + 1u) & 0x3ffu;
    }
    return;
  }
  uint32_t reg = (zxnextCopperListData >> 8u) & 0x7fu;
  zxnextCopperListAddress = (zxnextCopperListAddress + 1u) & 0x3ffu;
  if (reg != 0u) zxnextCopperDout = 1u;
}

static uint32_t zxnextCopperReadMemory(uint32_t address) { return zxnextCopperMemory[address & 0x7ffu]; }
static uint32_t zxnextCopperGetStartMode(void) { return zxnextCopperStartMode; }
static uint32_t zxnextCopperGetInstructionAddress(void) { return zxnextCopperInstructionAddress; }
static uint32_t zxnextCopperGetListAddress(void) { return zxnextCopperListAddress; }
static uint32_t zxnextCopperGetListData(void) { return zxnextCopperListData; }
static uint32_t zxnextCopperGetDout(void) { return zxnextCopperDout; }
static uint32_t zxnextCopperGetVerticalLineOffset(void) { return zxnextCopperVerticalLineOffset; }
static uint32_t zxnextCopperGetFrameTact(void) { return zxnextCopperFrameTact; }
