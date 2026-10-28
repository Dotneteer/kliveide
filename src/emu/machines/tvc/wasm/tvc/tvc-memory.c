/*
 * The TVC memory map (plan §2; rtvc/info/tvc.md "Memory Map"; HW pp.81-95).
 *
 * The CPU's 64K is four 16K pages, chosen by port 02h (the main paging register, M):
 *
 *   page 0 (0000-3FFF)  M bits 4-3: 00 SYS, 01 CART, 10 U0, 11 U3 on the 64K+ (U0 on the 64K)
 *   page 1 (4000-7FFF)  U1; on the 64K+ with M bit 2 set, the video bank port 0Ch bits 1-0 choose
 *   page 2 (8000-BFFF)  M bit 5: 0 video RAM (on the 64K+ the bank port 0Ch bits 3-2 choose), 1 U2
 *   page 3 (C000-FFFF)  M bits 7-6: 00 CART, 01 SYS, 10 U3, 11 EXT: the selected card's 8K window at
 *                       C000-DFFF (port 03h bits 7-6) and the EXTH ROM at E000-FFFF. Slot 0's HBF card
 *                       shows a 4K page of its ROM at C000 and its 4K RAM at D000 (tvc-hbf.c).
 *
 * On the 64K+, port 0Ch (mirrored at 0Dh-0Fh) bits 5-4 also choose the bank the video circuit shows,
 * independently of the CPU's (HW pp.94-95). The 64K has one video bank, VID0.
 *
 * The map is kept as sixteen 4K slots, each an offset into `tvcMemory` and a writable flag, so an
 * access is one table lookup. ROM writes and writes to an empty card window are ignored; an empty
 * card window and an empty cartridge read FFh.
 */

#define TVC_SLOT_SIZE 0x1000u

static uint32_t tvcSlotBase[16];
static uint8_t tvcSlotWritable[16];
/* Bit n set: slot n shows video RAM (the clock stretch's one test, tvc-timing.c) */
static uint16_t tvcVramSlots;
/* Bit n set: an M1 from slot n takes the WAIT circuit's wait state (64K only; tvc-timing.c) */
static uint16_t tvcSlowSlots;

static uint8_t tvcPort02;
static uint8_t tvcPort0c;
/* The expansion card selected for the EXT window (port 03h bits 7-6); no card is plugged in yet */
static uint8_t tvcExtCard;
/* The video bank the video circuit shows (0 on the 64K) */
static uint8_t tvcDisplayBank;

/* The video bank port 0Ch selects for a CPU page: `shift` 0 for page 1, 2 for page 2 */
static inline uint32_t tvcCpuVideoBank(uint32_t shift) {
  return tvcIsPlus ? (tvcPort0c >> shift) & 3u : 0u;
}

static void tvcSetPage(uint32_t page, uint32_t base, uint8_t writable) {
  for (uint32_t i = 0u; i < 4u; i++) {
    tvcSlotBase[page * 4u + i] = base + i * TVC_SLOT_SIZE;
    tvcSlotWritable[page * 4u + i] = writable;
  }
}

static void tvcRemap(void) {
  const uint8_t m = tvcPort02;
  // --- Page 0
  switch ((m >> 3) & 3u) {
    case 0u: tvcSetPage(0u, TVC_SYS, 0u); break;
    case 1u: tvcSetPage(0u, TVC_CART, 0u); break;
    case 2u: tvcSetPage(0u, TVC_U0, 1u); break;
    default: tvcSetPage(0u, tvcIsPlus ? TVC_U0 + 3u * TVC_BANK_SIZE : TVC_U0, 1u); break;
  }
  // --- Page 1
  if (tvcIsPlus && (m & 0x04u)) {
    tvcSetPage(1u, TVC_VID0 + tvcCpuVideoBank(0u) * TVC_BANK_SIZE, 1u);
  } else {
    tvcSetPage(1u, TVC_U0 + TVC_BANK_SIZE, 1u);
  }
  // --- Page 2
  if (m & 0x20u) {
    tvcSetPage(2u, TVC_U0 + 2u * TVC_BANK_SIZE, 1u);
  } else {
    tvcSetPage(2u, TVC_VID0 + tvcCpuVideoBank(2u) * TVC_BANK_SIZE, 1u);
  }
  // --- Page 3
  switch ((m >> 6) & 3u) {
    case 0u: tvcSetPage(3u, TVC_CART, 0u); break;
    case 1u: tvcSetPage(3u, TVC_SYS, 0u); break;
    case 2u: tvcSetPage(3u, TVC_U0 + 3u * TVC_BANK_SIZE, 1u); break;
    default:
      // --- EXT: the selected card's window and EXTH. Slot 0's HBF card: a ROM page and its RAM;
      // --- any other slot is empty (FFh)
      tvcSetPage(3u, TVC_EXT_CARD, 0u);
      if (tvcExtCard == 0u && tvcHbfPresent) {
        tvcSlotBase[12] = TVC_HBF_ROM + (uint32_t)tvcHbfRomPage * TVC_HBF_ROM_PAGE_SIZE;
        tvcSlotBase[13] = TVC_HBF_RAM;
        tvcSlotWritable[13] = 1u;
      }
      tvcSlotBase[14] = TVC_EXTH;
      tvcSlotBase[15] = TVC_EXTH + TVC_SLOT_SIZE;
      break;
  }
  tvcVramSlots = 0u;
  tvcSlowSlots = 0u;
  for (uint32_t slot = 0u; slot < 16u; slot++) {
    const uint32_t base = tvcSlotBase[slot];
    if (base >= TVC_VID0 && base < TVC_SYS) tvcVramSlots |= (uint16_t)(1u << slot);
    if (!tvcIsPlus && base >= TVC_CART && base < TVC_EXT_CARD) tvcSlowSlots |= (uint16_t)(1u << slot);
  }
  tvcDisplayBank = tvcIsPlus ? (uint8_t)((tvcPort0c >> 4) & 3u) : 0u;
}

static void tvcResetMemoryMap(void) {
  tvcPort02 = 0u;
  tvcPort0c = 0u;
  tvcExtCard = 0u;
  tvcRemap();
}

static inline uint32_t tvcPhysicalAddress(uint16_t address) {
  return tvcSlotBase[address >> 12] + (address & 0x0fffu);
}

static inline uint8_t tvcPeekMemory(uint16_t address) { return tvcMemory[tvcPhysicalAddress(address)]; }

static uint8_t tvcCpuReadMemory(uint16_t address) { return tvcPeekMemory(address); }

static void tvcCpuWriteMemory(uint16_t address, uint8_t value) {
  if (tvcSlotWritable[address >> 12]) tvcMemory[tvcPhysicalAddress(address)] = value;
}

/* The IDE's writes: RAM as the CPU writes it, and the ROMs too (the memory editor may patch them) */
static void tvcPokeMemory(uint16_t address, uint8_t value) {
  const uint32_t phys = tvcPhysicalAddress(address);
  if (phys < TVC_EXT_CARD || phys >= TVC_EXTH) tvcMemory[phys] = value;
}

/* Side-effect-free reads and writes for the IDE */
uint32_t tvcReadMemory(uint32_t address) { return tvcPeekMemory((uint16_t)address); }
void tvcWriteMemory(uint32_t address, uint32_t value) { tvcPokeMemory((uint16_t)address, (uint8_t)value); }
/* The physical offset of a CPU address in the core's memory (the IDE's partitions) */
uint32_t tvcGetPhysicalAddress(uint32_t address) { return tvcPhysicalAddress((uint16_t)address); }
uint32_t tvcGetPort02(void) { return tvcPort02; }
uint32_t tvcGetPort0c(void) { return tvcPort0c; }
uint32_t tvcGetDisplayBank(void) { return tvcDisplayBank; }
uint32_t tvcGetIsPlus(void) { return tvcIsPlus; }
