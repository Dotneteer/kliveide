/*
 * Cambridge Z88 - the memory map: the 4 MB physical memory, the cards in slots 0-3 and the internal
 * RAM, and the Blink's paging of the 64K logical space.
 *
 * A port of `Z88BankedMemory.ts` (Step 4 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`): eight 8K
 * logical pages, each mapped to a physical offset and the card behind it. Page 0 is bank $00 (the
 * slot-0 card) or, with COM.RAMS, bank $20 (internal RAM); page 1 is the upper or lower half of
 * SR0's bank; pages 2-7 are SR1-SR3's 16K banks. A card smaller than its slot is mirrored through
 * its chip mask; a page with no card reads the Blink's pseudo-random values and ignores writes.
 *
 * The card behaviour here is RAM (read/write) and ROM (read-only). UV EPROMs and flash cards read like
 * ROM and are erased ($FF) when inserted; their programming and command states arrive in Step 10.
 */

/* Card kinds; the host maps `Z88CardKind` onto them */
#define Z88_CARD_NONE 0u
#define Z88_CARD_RAM 1u
#define Z88_CARD_ROM 2u
#define Z88_CARD_UV_EPROM 3u
#define Z88_CARD_INTEL_FLASH 4u
#define Z88_CARD_AMD_29F040B 5u
#define Z88_CARD_AMD_29F080B 6u

/* Card index 4 is the internal RAM (banks $20-$3F); 0-3 are the slots */
#define Z88_INTERNAL_RAM_CARD 4u
#define Z88_PAGE_NO_CARD 0xffu

#define Z88_SLOT_SIZE 0x100000u

typedef struct Z88Card {
  uint8_t kind;
  uint8_t chipMask;
  uint32_t size;
} Z88Card;

static Z88Card z88Cards[5];

/* The eight 8K logical pages: physical offset, bank, and the card behind them */
static uint32_t z88PageOffset[8];
static uint8_t z88PageBank[8];
static uint8_t z88PageCard[8] = {
  Z88_PAGE_NO_CARD, Z88_PAGE_NO_CARD, Z88_PAGE_NO_CARD, Z88_PAGE_NO_CARD,
  Z88_PAGE_NO_CARD, Z88_PAGE_NO_CARD, Z88_PAGE_NO_CARD, Z88_PAGE_NO_CARD
};

/* The empty-slot random generator; its seed is never reset (`new Z88BankedMemory(this, 0xAC23)`) */
static uint32_t z88RndSeed = 0xac23u;

/* The last memory access of the CPU, for the debugger's memory breakpoints */
static uint8_t z88CaptureBusEvents = 1u;
static uint8_t z88HasMemoryEvent;
static uint16_t z88LastMemoryAddress;
static uint8_t z88LastMemoryValue;
static uint8_t z88LastMemoryIsWrite;

/* The Blink's COM register (defined in z88-blink.c's state, read here for COM.RAMS) */
static uint8_t z88Com;
#define Z88_COM_RAMS 0x04u

// -----------------------------------------------------------------------------
// Cards and chip masks
// -----------------------------------------------------------------------------

/* The chip (address line) mask of a card size; the host validates sizes (`z88ChipMaskForSize`) */
static uint8_t z88ChipMaskForSize(uint32_t size) {
  switch (size) {
    case 0x008000u: return 0x01u;
    case 0x010000u: return 0x03u;
    case 0x020000u: return 0x07u;
    case 0x040000u: return 0x0fu;
    case 0x080000u: return 0x1fu;
    case 0x100000u: return 0x3fu;
    default: return 0x00u;
  }
}

/* The TypeScript `CardType` code of a card: what the IDE and the tests compare */
static uint32_t z88CardTypeCode(const Z88Card *card) {
  switch (card->kind) {
    case Z88_CARD_RAM: return 0x02u;
    case Z88_CARD_ROM: return 0x01u;
    case Z88_CARD_UV_EPROM: return card->size == 0x8000u ? 0x7eu : 0x7cu;
    case Z88_CARD_INTEL_FLASH: return card->size == 0x80000u ? 0x89a7u : 0x89a6u;
    case Z88_CARD_AMD_29F040B: return 0x01a4u;
    case Z88_CARD_AMD_29F080B: return 0x01d5u;
    default: return 0x00u;
  }
}

/* The card that holds a bank: the internal RAM for $20-$3F, else the slot's card (or none) */
static uint8_t z88CardOfBank(uint8_t bank) {
  if (bank >= 0x20u && bank <= 0x3fu) return Z88_INTERNAL_RAM_CARD;
  const uint8_t slot = bank >> 6;
  return z88Cards[slot].kind != Z88_CARD_NONE ? slot : Z88_PAGE_NO_CARD;
}

/*
 * The physical offset of a bank: its slot's base plus the bank number masked by the card's chip
 * mask, so a smaller card is mirrored across its slot (`calculatePageOffset`).
 */
static uint32_t z88BankOffset(uint8_t bank) {
  uint8_t sizeMask = z88Cards[bank >> 6].kind != Z88_CARD_NONE ? z88Cards[bank >> 6].chipMask : 0u;
  if (bank >= 0x20u && bank <= 0x3fu) {
    sizeMask = z88Cards[Z88_INTERNAL_RAM_CARD].chipMask;
  }
  return (uint32_t)(((bank < 0x40u ? bank & 0xe0u : bank & 0xc0u) | (bank & sizeMask & 0x3fu))) << 14;
}

static void z88SetPageInfo(uint32_t page, uint32_t offset, uint8_t bank, uint8_t card) {
  z88PageOffset[page] = offset;
  z88PageBank[page] = bank;
  z88PageCard[page] = card;
}

/*
 * Maps a bank into a segment (`setMemoryPageInfo`). Segment 0 has two 8K pages: the lower one is
 * bank $00 or, with COM.RAMS, bank $20; the upper one is the half of SR0's bank its bit 0 selects.
 * Segments 1-3 map a whole 16K bank into two pages.
 */
static void z88SetMemoryPageInfo(uint32_t segment, uint8_t bank, uint8_t upper) {
  if (segment == 0u) {
    if (!upper) {
      if (z88Com & Z88_COM_RAMS) {
        z88SetPageInfo(0u, 0x080000u, 0x20u, Z88_INTERNAL_RAM_CARD);
      } else {
        z88SetPageInfo(0u, 0x000000u, 0x00u, z88Cards[0].kind != Z88_CARD_NONE ? 0u : Z88_PAGE_NO_CARD);
      }
    } else {
      const uint32_t offset = z88BankOffset(bank & 0xfeu) + (uint32_t)(bank & 0x01u) * 0x2000u;
      z88SetPageInfo(1u, offset, bank, z88CardOfBank(bank));
    }
    return;
  }
  const uint32_t offset = z88BankOffset(bank);
  z88SetPageInfo(2u * segment, offset, bank, z88CardOfBank(bank));
  z88SetPageInfo(2u * segment + 1u, offset + 0x2000u, bank, z88CardOfBank(bank));
}

/* After a card change, every segment is mapped again (`recalculateMemoryPageInfo`) */
static void z88RecalculatePages(void) {
  z88SetMemoryPageInfo(0u, z88PageBank[0], 0u);
  z88SetMemoryPageInfo(0u, z88PageBank[1], 1u);
  z88SetMemoryPageInfo(1u, z88PageBank[2], 0u);
  z88SetMemoryPageInfo(2u, z88PageBank[4], 0u);
  z88SetMemoryPageInfo(3u, z88PageBank[6], 0u);
}

// -----------------------------------------------------------------------------
// The CPU's view
// -----------------------------------------------------------------------------

/* The Blink's pseudo-random value of a page with no card */
static uint8_t z88RandomRead(void) {
  const uint32_t carry = z88RndSeed & 0x0001u;
  z88RndSeed >>= 1;
  z88RndSeed ^= carry ? 0xb4b8u : 0x00b8u;
  return (uint8_t)(z88RndSeed >> 8);
}

static uint8_t z88MemoryRead(uint16_t address) {
  const uint32_t page = address >> 13;
  if (z88PageCard[page] == Z88_PAGE_NO_CARD) {
    return z88RandomRead();
  }
  return z88Memory[z88PageOffset[page] + (address & 0x1fffu)];
}

static void z88MemoryWrite(uint16_t address, uint8_t value) {
  const uint32_t page = address >> 13;
  const uint8_t card = z88PageCard[page];
  if (card == Z88_PAGE_NO_CARD) return;
  if (z88Cards[card].kind == Z88_CARD_RAM) {
    z88Memory[z88PageOffset[page] + (address & 0x1fffu)] = value;
  }
  /* ROM ignores writes; EPROM and flash programming arrive in Step 10 */
}

static uint32_t z88CpuReadMemory(uint32_t address) {
  const uint16_t masked = (uint16_t)(address & 0xffffu);
  const uint8_t value = z88MemoryRead(masked);
  if (z88CaptureBusEvents) {
    z88LastMemoryAddress = masked;
    z88LastMemoryValue = value;
    z88LastMemoryIsWrite = 0u;
    z88HasMemoryEvent = 1u;
  }
  return value;
}

static void z88CpuWriteMemory(uint32_t address, uint32_t value) {
  const uint16_t masked = (uint16_t)(address & 0xffffu);
  if (z88CaptureBusEvents) {
    z88LastMemoryAddress = masked;
    z88LastMemoryValue = (uint8_t)value;
    z88LastMemoryIsWrite = 1u;
    z88HasMemoryEvent = 1u;
  }
  z88MemoryWrite(masked, (uint8_t)value);
}

// -----------------------------------------------------------------------------
// Exports: the host's and the IDE's access
// -----------------------------------------------------------------------------

/* Reads through the current paging, as `Z88BankedMemory.readMemory` (no timing, no bus event) */
uint32_t z88ReadMemory(uint32_t address) {
  return z88MemoryRead((uint16_t)(address & 0xffffu));
}

/* Writes through the current paging, as `Z88BankedMemory.writeMemory` */
void z88WriteMemory(uint32_t address, uint32_t value) {
  z88MemoryWrite((uint16_t)(address & 0xffffu), (uint8_t)value);
}

/*
 * Inserts a card: the paging is recalculated, EPROM and flash cards are erased, as their
 * `onInserted` does. The host copies the card image into the slot afterwards.
 */
void z88InsertCard(uint32_t slot, uint32_t kind, uint32_t size) {
  if (slot > 3u) return;
  z88Cards[slot].kind = (uint8_t)kind;
  z88Cards[slot].size = size;
  z88Cards[slot].chipMask = z88ChipMaskForSize(size);
  z88RecalculatePages();
  if (kind == Z88_CARD_UV_EPROM || kind == Z88_CARD_INTEL_FLASH || kind == Z88_CARD_AMD_29F040B ||
      kind == Z88_CARD_AMD_29F080B) {
    const uint32_t base = slot * Z88_SLOT_SIZE;
    for (uint32_t i = 0u; i < size && base + i < Z88_MEMORY_SIZE; i++) z88Memory[base + i] = 0xffu;
  }
}

/* Removes a card; its bytes stay in physical memory */
void z88RemoveCard(uint32_t slot) {
  if (slot > 3u) return;
  z88Cards[slot].kind = Z88_CARD_NONE;
  z88Cards[slot].size = 0u;
  z88Cards[slot].chipMask = 0u;
  z88RecalculatePages();
}

/*
 * Sets the internal RAM size (`MC_Z88_INTRAM`). Like the TypeScript memory's test support
 * (`setRamCard`), it does not recalculate the paging.
 */
void z88SetInternalRamSize(uint32_t size) {
  z88Cards[Z88_INTERNAL_RAM_CARD].kind = Z88_CARD_RAM;
  z88Cards[Z88_INTERNAL_RAM_CARD].size = size;
  z88Cards[Z88_INTERNAL_RAM_CARD].chipMask = z88ChipMaskForSize(size);
}

uint32_t z88GetSlotCardType(uint32_t slot) { return slot < 5u ? z88CardTypeCode(&z88Cards[slot]) : 0u; }
uint32_t z88GetSlotChipMask(uint32_t slot) {
  return slot < 5u && z88Cards[slot].kind != Z88_CARD_NONE ? z88Cards[slot].chipMask : 0u;
}
uint32_t z88GetPageBank(uint32_t page) { return z88PageBank[page & 7u]; }
uint32_t z88GetPageOffset(uint32_t page) { return z88PageOffset[page & 7u]; }
uint32_t z88GetPageCardType(uint32_t page) {
  const uint8_t card = z88PageCard[page & 7u];
  return card == Z88_PAGE_NO_CARD ? 0u : z88CardTypeCode(&z88Cards[card]);
}

uint32_t z88GetLastMemoryAddress(void) { return z88HasMemoryEvent ? z88LastMemoryAddress : 0u; }
uint32_t z88GetLastMemoryValue(void) { return z88HasMemoryEvent ? z88LastMemoryValue : 0u; }
uint32_t z88GetLastMemoryIsWrite(void) { return z88HasMemoryEvent ? z88LastMemoryIsWrite : 0u; }
