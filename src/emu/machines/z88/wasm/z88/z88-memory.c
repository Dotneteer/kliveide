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
 * RAM is read/write and ROM read-only here. UV EPROMs and flash cards read like ROM while their chip
 * is in read-array mode; their writes, and their reads in a command state, go to z88-cards.c.
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

/*
 * The CPU's bus accesses, recorded exactly as `Z80Cpu` records them - the CPU panel shows them, and the
 * debugger's memory and I/O breakpoints test them:
 * - the addresses read and written by the current instruction, in two 8-entry lists whose counts (not
 *   contents) restart at the M1 of each unprefixed opcode fetch (`Z80_BEFORE_OPCODE_FETCH`), so an
 *   entry past the count is left from an earlier instruction, and an access past the eighth is
 *   counted but not stored; an interrupt's pushes add to the previous instruction's list;
 * - the last value read and written, and the last I/O port read and written with their values; the
 *   ports are forgotten at the same M1, the values never (until then they are unknown).
 * A reset restarts the counts and forgets the ports, as `Z80Cpu.reset` does.
 */
#define Z88_BUS_LIST_SIZE 8u
#define Z88_BUS_READ_VALUE 0x01u
#define Z88_BUS_WRITE_VALUE 0x02u
#define Z88_BUS_IO_READ_PORT 0x04u
#define Z88_BUS_IO_READ_VALUE 0x08u
#define Z88_BUS_IO_WRITE_PORT 0x10u
#define Z88_BUS_IO_WRITE_VALUE 0x20u

static uint16_t z88BusReads[Z88_BUS_LIST_SIZE];
static uint16_t z88BusWrites[Z88_BUS_LIST_SIZE];
static uint32_t z88BusReadCount;
static uint32_t z88BusWriteCount;
static uint8_t z88BusReadValue;
static uint8_t z88BusWriteValue;
static uint16_t z88BusIoReadPort;
static uint8_t z88BusIoReadValue;
static uint16_t z88BusIoWritePort;
static uint8_t z88BusIoWriteValue;
static uint8_t z88BusFlags;

/* The address of the last unprefixed opcode fetched (`Z80Cpu.opStartAddress`) */
static uint16_t z88OpStartAddress;

/* A new instruction's M1: the lists restart, the ports are forgotten, the instruction starts here */
static inline void z88BusNewInstruction(void) {
  z88BusReadCount = 0u;
  z88BusWriteCount = 0u;
  z88BusFlags &= (uint8_t)~(Z88_BUS_IO_READ_PORT | Z88_BUS_IO_WRITE_PORT);
  z88OpStartAddress = cpu.pc;
}

/* `Z80Cpu.reset` and `hardReset`: the counts restart, the ports are forgotten, opStartAddress is 0 */
static void z88BusReset(void) {
  z88BusReadCount = 0u;
  z88BusWriteCount = 0u;
  z88BusFlags &= (uint8_t)~(Z88_BUS_IO_READ_PORT | Z88_BUS_IO_WRITE_PORT);
  z88OpStartAddress = 0u;
}

/* The programmable cards (z88-cards.c) */
static uint8_t z88CardCommandMode[5];
static uint8_t z88CardCommandRead(uint32_t slot, uint8_t bank, uint32_t address);
static void z88CardWrite(uint32_t slot, uint8_t bank, uint32_t address, uint8_t value);
static void z88CardInserted(uint32_t slot);

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
  const uint8_t card = z88PageCard[page];
  if (card == Z88_PAGE_NO_CARD) {
    return z88RandomRead();
  }
  const uint32_t physical = z88PageOffset[page] + (address & 0x1fffu);
  if (z88CardCommandMode[card]) {
    return z88CardCommandRead(card, z88PageBank[page], physical);
  }
  return z88Memory[physical];
}

static void z88MemoryWrite(uint16_t address, uint8_t value) {
  const uint32_t page = address >> 13;
  const uint8_t card = z88PageCard[page];
  if (card == Z88_PAGE_NO_CARD) return;
  const uint32_t physical = z88PageOffset[page] + (address & 0x1fffu);
  switch (z88Cards[card].kind) {
    case Z88_CARD_RAM:
      z88Memory[physical] = value;
      break;
    case Z88_CARD_ROM:
      break;
    default:
      z88CardWrite(card, z88PageBank[page], physical, value);
      break;
  }
}

static uint32_t z88CpuReadMemory(uint32_t address) {
  const uint16_t masked = (uint16_t)(address & 0xffffu);
  if (z88BusReadCount < Z88_BUS_LIST_SIZE) z88BusReads[z88BusReadCount] = masked;
  z88BusReadCount++;
  const uint8_t value = z88MemoryRead(masked);
  z88BusReadValue = value;
  z88BusFlags |= Z88_BUS_READ_VALUE;
  return value;
}

static void z88CpuWriteMemory(uint32_t address, uint32_t value) {
  const uint16_t masked = (uint16_t)(address & 0xffffu);
  if (z88BusWriteCount < Z88_BUS_LIST_SIZE) z88BusWrites[z88BusWriteCount] = masked;
  z88BusWriteCount++;
  z88BusWriteValue = (uint8_t)value;
  z88BusFlags |= Z88_BUS_WRITE_VALUE;
  z88MemoryWrite(masked, (uint8_t)value);
}

/* An operand byte: the memory read's timing, but no record (`Z80Cpu.fetchCodeByte`) */
static uint8_t z88FetchCodeByte(uint16_t address) {
  delayMemoryRead(address);
  return z88MemoryRead(address);
}

/* A write that is not a CPU bus cycle (`z80PokeMemory`): not recorded */
static void z88PokeMemory(uint32_t address, uint32_t value) {
  z88MemoryWrite((uint16_t)(address & 0xffffu), (uint8_t)value);
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
 * Inserts a card: the paging is recalculated, then the card's `onInserted` - EPROM and flash cards are
 * erased ($FF) and a flash chip starts in read-array mode. The host copies the card image afterwards.
 */
void z88InsertCard(uint32_t slot, uint32_t kind, uint32_t size) {
  if (slot > 3u) return;
  z88Cards[slot].kind = (uint8_t)kind;
  z88Cards[slot].size = size;
  z88Cards[slot].chipMask = z88ChipMaskForSize(size);
  z88RecalculatePages();
  z88CardInserted(slot);
}

/* Removes a card; its bytes stay in physical memory */
void z88RemoveCard(uint32_t slot) {
  if (slot > 3u) return;
  z88Cards[slot].kind = Z88_CARD_NONE;
  z88Cards[slot].size = 0u;
  z88Cards[slot].chipMask = 0u;
  z88CardCommandMode[slot] = 0u;
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

/* The bus record (see above); `z88GetBusFlags` says which values and ports are known */
uint32_t z88GetBusReadAddress(uint32_t index) { return z88BusReads[index & 7u]; }
uint32_t z88GetBusWriteAddress(uint32_t index) { return z88BusWrites[index & 7u]; }
uint32_t z88GetBusReadCount(void) { return z88BusReadCount; }
uint32_t z88GetBusWriteCount(void) { return z88BusWriteCount; }
uint32_t z88GetBusReadValue(void) { return z88BusReadValue; }
uint32_t z88GetBusWriteValue(void) { return z88BusWriteValue; }
uint32_t z88GetBusIoReadPort(void) { return z88BusIoReadPort; }
uint32_t z88GetBusIoReadValue(void) { return z88BusIoReadValue; }
uint32_t z88GetBusIoWritePort(void) { return z88BusIoWritePort; }
uint32_t z88GetBusIoWriteValue(void) { return z88BusIoWriteValue; }
uint32_t z88GetBusFlags(void) { return z88BusFlags; }
uint32_t z88GetOpStartAddress(void) { return z88OpStartAddress; }
