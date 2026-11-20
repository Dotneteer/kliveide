#include "zxnext-palette.h"

#define ZXNEXT_PALETTE_COUNT 8u
#define ZXNEXT_PALETTE_SIZE 256u

static const uint16_t zxnextDefaultUlaColors[16] = {
  0x000u, 0x005u, 0x140u, 0x145u, 0x028u, 0x02du, 0x168u, 0x16du,
  0x000u, 0x007u, 0x1c0u, 0x1c7u, 0x038u, 0x03fu, 0x1f8u, 0x1ffu
};

static uint16_t zxnextPalettes[ZXNEXT_PALETTE_COUNT][ZXNEXT_PALETTE_SIZE];
static uint8_t zxnextPaletteIndex;
static uint8_t zxnextPaletteDisableAutoInc;
static uint8_t zxnextPaletteSelected;
static uint8_t zxnextPaletteSecondSprite;
static uint8_t zxnextPaletteSecondLayer2;
static uint8_t zxnextPaletteSecondUla;
static uint8_t zxnextPaletteSecondTilemap;
static uint8_t zxnextPaletteEnableUlaNext;
static uint8_t zxnextPaletteSecondWrite;
static uint8_t zxnextPaletteStoredValue;

/*
 * The palette's change tracking (`dev/plans/NEXT_PALETTE_DEBUGGING_PLAN.md` §5, Phase 1).
 *
 * `zxnextPaletteGeneration` counts every stored entry write, every change of a live-bank or ULANext bit
 * ($43 bits 0-3, $6B bit 4) and every hard reset, whoever caused it. The IDE compares it with the last
 * value it read, so a panel re-reads 2048 entries only when something changed. It is machine state:
 * a fast frame and a debug run count the same writes, and a restore brings back the count of the
 * restored state, so it differs from what the IDE last saw.
 *
 * `zxnextPaletteDirty` has one bit per entry (slot * 32 + index / 8, bit index % 8): written since the
 * host last cleared it, which it does when a run starts, so it reads "written since the last stop". The
 * host decides when it is cleared, so it is volatile (`build-zxnext-wasm.cjs`).
 */
static uint32_t zxnextPaletteGeneration;
static uint8_t zxnextPaletteDirty[ZXNEXT_PALETTE_COUNT * ZXNEXT_PALETTE_SIZE / 8u];

/*
 * The palette-breakpoint watch and its hit latch (`dev/plans/NEXT_PALETTE_DEBUGGING_PLAN.md` §3),
 * pushed whole by the host like the sprite watch, all volatile:
 *
 * - `zxnextPaletteWatch`: one bit per entry, as the dirty bitmap (slot * 32 + index / 8);
 * - `zxnextPaletteWatchFlags`: bit 0 armed (the write paths check at all), bit 1 report Copper
 *   writes, bit 2 report writes that store the value already there, bits 4-7 the devices (ULA,
 *   Layer 2, sprites, tilemap) whose live-bank flips are watched;
 * - the latch keeps the *first* hit since the host last took one, like the NextReg and sprite
 *   latches: `zxnextPaletteHit` bit 31 present, 30 a flip, 27-29 origin (1 CPU through a NextReg,
 *   2 Copper, 3 DMA, 4 CPU through port $FF3B), 24-26 path (0 $41, 1 $44, 2 $FF3B, 3 $43, 4 $6B),
 *   8-10 slot, 0-7 entry; `zxnextPaletteHitValues` the old value in bits 0-10, the new in 16-26 (for
 *   a flip, the banks).
 *
 * Writes with no origin - reset branches and the IDE's own NextReg writes - are never reported. A
 * DMA write is told by `zxnextSpriteWriteFromDma`, which the DMA raises around every port write
 * (`$253B` included, where the NextReg origin then reads CPU).
 */
#define ZXNEXT_PALETTE_WATCH_ARMED 0x01u
#define ZXNEXT_PALETTE_WATCH_COPPER 0x02u
#define ZXNEXT_PALETTE_WATCH_ANY_WRITE 0x04u
#define ZXNEXT_PALETTE_PATH_41 0u
#define ZXNEXT_PALETTE_PATH_44 1u
#define ZXNEXT_PALETTE_PATH_FF3B 2u
#define ZXNEXT_PALETTE_PATH_43 3u
#define ZXNEXT_PALETTE_PATH_6B 4u
static uint8_t zxnextPaletteWatch[ZXNEXT_PALETTE_COUNT * ZXNEXT_PALETTE_SIZE / 8u];
static uint8_t zxnextPaletteWatchFlags;
static uint32_t zxnextPaletteHit;
static uint32_t zxnextPaletteHitValues;

/* Who is writing now: 1 CPU through a NextReg, 2 Copper, 3 DMA, 4 CPU through a port, 0 nobody. */
static uint32_t zxnextPaletteWriteOrigin(uint32_t viaPort) {
  if (zxnextSpriteWriteFromDma) return 3u;
  if (viaPort) return 4u;
  if (zxnextNextRegWriteOrigin == ZXNEXT_NEXTREG_ORIGIN_CPU) return 1u;
  if (zxnextNextRegWriteOrigin == ZXNEXT_NEXTREG_ORIGIN_COPPER) return 2u;
  return 0u;
}

/* Does this write or flip trip a palette breakpoint? If so, latch it for the host. */
static void zxnextPaletteCheckWatch(uint32_t flip, uint32_t path, uint32_t slot, uint32_t index,
                                    uint32_t oldValue, uint32_t newValue, uint32_t origin) {
  if (zxnextPaletteHit || origin == 0u) return;
  if (origin == 2u && (zxnextPaletteWatchFlags & ZXNEXT_PALETTE_WATCH_COPPER) == 0u) return;
  if (flip) {
    if ((zxnextPaletteWatchFlags & (0x10u << (slot & 0x03u))) == 0u) return;
  } else {
    if ((zxnextPaletteWatch[((slot & 0x07u) << 5u) | ((index & 0xffu) >> 3u)] & (1u << (index & 0x07u))) == 0u) return;
    if (oldValue == newValue && (zxnextPaletteWatchFlags & ZXNEXT_PALETTE_WATCH_ANY_WRITE) == 0u) return;
  }
  zxnextPaletteHit = 0x80000000u | ((flip & 1u) << 30u) | ((origin & 0x07u) << 27u) | ((path & 0x07u) << 24u) |
    ((slot & 0x07u) << 8u) | (index & 0xffu);
  zxnextPaletteHitValues = (oldValue & 0x7ffu) | ((newValue & 0x7ffu) << 16u);
}

/* Stores one entry: the only way an entry is written outside a hard reset. */
static void zxnextPaletteStore(uint32_t slot, uint32_t index, uint16_t value, uint32_t path, uint32_t viaPort) {
#ifndef Z80_BENCH_STRIP_DEBUG
  if (zxnextPaletteWatchFlags & ZXNEXT_PALETTE_WATCH_ARMED) {
    zxnextPaletteCheckWatch(0u, path, slot, index, zxnextPalettes[slot & 0x07u][index & 0xffu], value,
      zxnextPaletteWriteOrigin(viaPort));
  }
#endif
  zxnextPalettes[slot & 0x07u][index & 0xffu] = value;
  zxnextPaletteGeneration++;
  zxnextPaletteDirty[((slot & 0x07u) << 5u) | ((index & 0xffu) >> 3u)] |= (uint8_t)(1u << (index & 0x07u));
}

static uint32_t zxnextPaletteCurrentSlot(void) {
  switch (zxnextPaletteSelected & 0x07u) {
    case 0u: return 0u;
    case 1u: return 1u;
    case 2u: return 2u;
    case 3u: return 3u;
    case 4u: return 4u;
    case 5u: return 5u;
    case 6u: return 6u;
    default: return 7u;
  }
}

/*
 * Soft reset: the palette registers only. zxnext.vhd ~4977-4989 clears the index, the $44 byte pending
 * flag, $43 and the stored first byte; the palette RAMs (dpram2, no reset port) keep their contents.
 */
static void zxnextPaletteReset(void) {
  /* --- The live banks go back to the first ones: the picture's colours may change */
  zxnextPaletteGeneration++;
  zxnextPaletteIndex = 0u;
  zxnextPaletteDisableAutoInc = 0u;
  zxnextPaletteSelected = 0u;
  zxnextPaletteSecondSprite = 0u;
  zxnextPaletteSecondLayer2 = 0u;
  zxnextPaletteSecondUla = 0u;
  zxnextPaletteSecondTilemap = 0u;
  zxnextPaletteEnableUlaNext = 0u;
  zxnextPaletteSecondWrite = 0u;
  zxnextPaletteStoredValue = 0u;
}

/* Hard reset: the palette contents the firmware leaves after power-on (FPGA palette RAM has none). */
static void zxnextPaletteHardReset(void) {
  zxnextPaletteReset();
  for (uint32_t i = 0u; i < ZXNEXT_PALETTE_SIZE; i++) {
    uint16_t color = (uint16_t)((i << 1u) | ((i & 0x02u) ? 1u : 0u));
    zxnextPalettes[1][i] = color;
    zxnextPalettes[2][i] = color;
    zxnextPalettes[3][i] = color;
    zxnextPalettes[5][i] = color;
    zxnextPalettes[6][i] = color;
    zxnextPalettes[7][i] = color;
  }

  for (uint32_t block = 0u; block < 16u; block++) {
    for (uint32_t i = 0u; i < 16u; i++) {
      uint32_t index = (block << 4u) | i;
      uint16_t color = i != 11u ? zxnextDefaultUlaColors[i] : 0x1cfu;
      zxnextPalettes[0][index] = color;
      zxnextPalettes[4][index] = color;
    }
  }
}

static void zxnextPaletteSetNextReg(uint32_t reg, uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  uint32_t slot = zxnextPaletteCurrentSlot();
  switch (reg & 0xffu) {
    case 0x40u:
      zxnextPaletteIndex = byteValue;
      zxnextPaletteSecondWrite = 0u;
      break;
    case 0x41u:
      zxnextPaletteStore(slot, zxnextPaletteIndex,
        (uint16_t)(((byteValue << 1u) | ((byteValue & 0x03u) ? 1u : 0u)) & 0x1ffu), ZXNEXT_PALETTE_PATH_41, 0u);
      if (!zxnextPaletteDisableAutoInc) zxnextPaletteIndex = (uint8_t)(zxnextPaletteIndex + 1u);
      zxnextPaletteSecondWrite = 0u;
      break;
    case 0x43u:
      /* --- A live-bank or ULANext switch changes the picture's colours without an entry write */
      if ((byteValue & 0x0fu) != (zxnextPaletteGetNextReg(0x43u) & 0x0fu)) zxnextPaletteGeneration++;
#ifndef Z80_BENCH_STRIP_DEBUG
      if (zxnextPaletteWatchFlags & ZXNEXT_PALETTE_WATCH_ARMED) {
        /* --- Bits 1-3 pick the ULA's, Layer 2's and the sprites' live bank (slots 0-2) */
        uint32_t before = zxnextPaletteGetNextReg(0x43u);
        for (uint32_t device = 0u; device < 3u; device++) {
          uint32_t was = (before >> (device + 1u)) & 1u;
          uint32_t now = (byteValue >> (device + 1u)) & 1u;
          if (was != now) {
            zxnextPaletteCheckWatch(1u, ZXNEXT_PALETTE_PATH_43, device + 4u * now, 0u, was, now,
              zxnextPaletteWriteOrigin(0u));
          }
        }
      }
#endif
      zxnextPaletteDisableAutoInc = (byteValue & 0x80u) != 0u;
      zxnextPaletteSelected = (byteValue >> 4u) & 0x07u;
      zxnextPaletteSecondSprite = (byteValue & 0x08u) != 0u;
      zxnextPaletteSecondLayer2 = (byteValue & 0x04u) != 0u;
      zxnextPaletteSecondUla = (byteValue & 0x02u) != 0u;
      zxnextPaletteEnableUlaNext = (byteValue & 0x01u) != 0u;
      zxnextPaletteSecondWrite = 0u;
      break;
    case 0x44u:
      /*
       * zxnext.vhd ~4896-4898, ~5374-5380: the first byte is only stored ($28); the second writes the
       * entry - stored byte & bit 0, bits 7-6 into the word's priority bits (0x200 / 0x400; only Layer 2
       * displays bit 7, $44 reads both back) - then moves the index on.
       */
      if (!zxnextPaletteSecondWrite) {
        zxnextPaletteStoredValue = byteValue;
      } else {
        zxnextPaletteStore(slot, zxnextPaletteIndex,
          (uint16_t)(((uint32_t)zxnextPaletteStoredValue << 1u) |
            (byteValue & 0x01u) |
            ((byteValue & 0x80u) ? 0x200u : 0u) |
            ((byteValue & 0x40u) ? 0x400u : 0u)), ZXNEXT_PALETTE_PATH_44, 0u);
        if (!zxnextPaletteDisableAutoInc) zxnextPaletteIndex = (uint8_t)(zxnextPaletteIndex + 1u);
      }
      zxnextPaletteSecondWrite = !zxnextPaletteSecondWrite;
      break;
    default:
      break;
  }
}

static uint32_t zxnextPaletteGetNextReg(uint32_t reg) {
  uint16_t entry = zxnextPalettes[zxnextPaletteCurrentSlot()][zxnextPaletteIndex];
  switch (reg & 0xffu) {
    case 0x40u:
      return zxnextPaletteIndex;
    case 0x41u:
      return (entry >> 1u) & 0xffu;
    case 0x43u:
      return (zxnextPaletteDisableAutoInc ? 0x80u : 0u) |
        ((uint32_t)zxnextPaletteSelected << 4u) |
        (zxnextPaletteSecondSprite ? 0x08u : 0u) |
        (zxnextPaletteSecondLayer2 ? 0x04u : 0u) |
        (zxnextPaletteSecondUla ? 0x02u : 0u) |
        (zxnextPaletteEnableUlaNext ? 0x01u : 0u);
    case 0x44u:
      return ((entry & 0x200u) ? 0x80u : 0u) | ((entry & 0x400u) ? 0x40u : 0u) | (entry & 0x01u);
    default:
      return 0u;
  }
}

/* NextReg $43 bit 0: ULANext attribute decoding. */
static uint32_t zxnextPaletteGetUlaNextEnabled(void) { return zxnextPaletteEnableUlaNext; }

/*
 * ULA+ palette access through port $FF3B (zxnext.vhd ~4717-4720, 6903-6904): entry "11" & index of the
 * ULA palette chosen by the $43 write select bit 6 (`nr_43_palette_write_select(2)`). The port byte is
 * GGGRRRBB; the palette stores RRRGGGBB with the 9th bit B1 or B0, as a $41 write does.
 */
static void zxnextPaletteWriteUlaPlus(uint32_t index, uint32_t grb) {
  uint32_t slot = (zxnextPaletteSelected & 0x04u) ? 4u : 0u;
  uint32_t rgb = (((grb >> 2u) & 0x07u) << 5u) | (((grb >> 5u) & 0x07u) << 2u) | (grb & 0x03u);
  zxnextPaletteStore(slot, 0xc0u | (index & 0x3fu), (uint16_t)(((rgb << 1u) | ((rgb & 0x03u) ? 1u : 0u)) & 0x1ffu),
    ZXNEXT_PALETTE_PATH_FF3B, 1u);
}

static uint32_t zxnextPaletteReadUlaPlus(uint32_t index) {
  uint32_t slot = (zxnextPaletteSelected & 0x04u) ? 4u : 0u;
  uint32_t entry = zxnextPalettes[slot][0xc0u | (index & 0x3fu)];
  return (((entry >> 3u) & 0x07u) << 5u) | (((entry >> 6u) & 0x07u) << 2u) | ((entry >> 1u) & 0x03u);
}

static uint32_t zxnextPaletteGetEntry(uint32_t palette, uint32_t index) {
  return zxnextPalettes[palette & 0x07u][index & 0xffu];
}

static uint32_t zxnextPaletteGetLayer2Entry(uint32_t index) {
  return zxnextPalettes[zxnextPaletteSecondLayer2 ? 5u : 1u][index & 0xffu];
}

static uint32_t zxnextPaletteGetSpriteEntry(uint32_t index) {
  return zxnextPalettes[zxnextPaletteSecondSprite ? 6u : 2u][index & 0xffu];
}

static uint32_t zxnextPaletteGetTilemapEntry(uint32_t index) {
  return zxnextPalettes[zxnextPaletteSecondTilemap ? 7u : 3u][index & 0xffu];
}

static uint32_t zxnextPaletteGetCurrentEntry(uint32_t index) {
  return zxnextPalettes[zxnextPaletteCurrentSlot()][index & 0xffu];
}

static uint32_t zxnextPaletteGetPaletteIndex(void) { return zxnextPaletteIndex; }
static uint32_t zxnextPaletteGetControl(void) { return zxnextPaletteGetNextReg(0x43u); }
static uint32_t zxnextPaletteGetSecondWrite(void) { return zxnextPaletteSecondWrite; }
static uint32_t zxnextPaletteGetStoredValue(void) { return zxnextPaletteStoredValue; }
static void zxnextPaletteSetSecondTilemap(uint32_t value) {
  uint8_t second = value != 0u;
  if (second != zxnextPaletteSecondTilemap) {
    zxnextPaletteGeneration++;
#ifndef Z80_BENCH_STRIP_DEBUG
    if (zxnextPaletteWatchFlags & ZXNEXT_PALETTE_WATCH_ARMED) {
      zxnextPaletteCheckWatch(1u, ZXNEXT_PALETTE_PATH_6B, 3u + 4u * second, 0u, zxnextPaletteSecondTilemap, second,
        zxnextPaletteWriteOrigin(0u));
    }
#endif
  }
  zxnextPaletteSecondTilemap = second;
}
static uint32_t zxnextPaletteGetGeneration(void) { return zxnextPaletteGeneration; }
/* One byte of the dirty bitmap, `0..255` (slot * 32 + index / 8). */
static uint32_t zxnextPaletteGetDirtyByte(uint32_t offset) {
  return zxnextPaletteDirty[offset % (ZXNEXT_PALETTE_COUNT * ZXNEXT_PALETTE_SIZE / 8u)];
}
/* Clears the dirty bitmap; 1 when any bit was set, so the host knows its readers must re-read. */
static uint32_t zxnextPaletteClearDirty(void) {
  uint8_t any = 0u;
  for (uint32_t i = 0u; i < ZXNEXT_PALETTE_COUNT * ZXNEXT_PALETTE_SIZE / 8u; i++) {
    any |= zxnextPaletteDirty[i];
    zxnextPaletteDirty[i] = 0u;
  }
  return any != 0u;
}
static uint32_t zxnextPaletteGetSecondTilemap(void) { return zxnextPaletteSecondTilemap; }
