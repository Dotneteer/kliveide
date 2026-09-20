/*
 * Cambridge Z88 - the programmable cards: UV EPROMs, Intel 28F00xS5 and AMD 29F0x0B flash chips.
 *
 * A port of `Z88UvEpromMemoryCard`, `Z88IntelFlashMemoryCard` and `Z88AmdFlashMemoryCard` (Step 10 of
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`), themselves based on OZvm's EpromBank, IntelFlashBank
 * and AmdFlashBank. Each slot holds one card, so the chip state is per slot (index 0-3).
 *
 * The fast path stays in z88-memory.c: a read goes straight to physical memory unless the slot's chip
 * is out of read-array mode (`z88CardCommandMode`); only writes to these cards and reads in command
 * mode come here. Addresses are physical (22-bit): the 8K page's offset plus the low 13 bits of the
 * CPU address, as the TypeScript cards receive them; `bank` is the page's (absolute) bank.
 *
 * Kept for parity, as the TypeScript cards do them:
 * - A sector erase clears the 64K at the slot base plus `(bank & $3C) * 16K`, whatever the card's
 *   size: on a card smaller than its slot, a mirrored bank erases physical memory past the card.
 * - The AMD command cycle (the third) is not checked against its address, only the two unlock cycles.
 * - Any write while an AMD chip is executing a command is ignored, except the reset ($F0).
 */

#define Z88_COM_VPPON 0x02u
#define Z88_COM_PROGRAM 0x08u
#define Z88_COM_OVERP 0x20u

/* The command cycle marker of the AMD unlock template ('?') */
#define Z88_AMD_ANY 0x3fu

/* The state of a flash chip */
typedef struct Z88FlashChip {
  uint8_t readArrayMode;
  /* The executing command; 0 when none */
  uint8_t command;
  /* Intel: the status register */
  uint8_t statusRegister;
  /* AMD: accumulating a command's cycles / executing a command / the command failed */
  uint8_t accumulating;
  uint8_t executing;
  uint8_t failure;
  /* AMD: the expected unlock cycles (address, data pairs), as a stack; the top is the last entry */
  uint16_t unlock[8];
  uint8_t unlockDepth;
  /* AMD: the read status cycles still to deliver, as a stack */
  uint8_t status[4];
  uint8_t statusDepth;
} Z88FlashChip;

static Z88FlashChip z88Flash[4];

static const uint16_t z88AmdUnlockCycles[6] = { 0x555u, 0xaau, 0x2aau, 0x55u, 0x555u, Z88_AMD_ANY };
static const uint8_t z88AmdStatusSuccess[2] = { 0x40u, 0x40u };
static const uint8_t z88AmdStatusFailure[4] = { 0x60u, 0x20u, 0x60u, 0x20u };

/* A slot's chip is in a command state: its reads come here (`readArrayMode` false) */
static uint8_t z88CardCommandMode[5];

static void z88FlashSetReadArrayMode(uint32_t slot, uint8_t readArrayMode) {
  z88Flash[slot].readArrayMode = readArrayMode;
  z88CardCommandMode[slot] = readArrayMode ? 0u : 1u;
}

/* `presetSequence`: the stack pops the sequence in its order */
static void z88AmdPresetUnlock(Z88FlashChip *chip) {
  for (uint32_t i = 0u; i < 6u; i++) chip->unlock[i] = z88AmdUnlockCycles[5u - i];
  chip->unlockDepth = 6u;
}

static void z88AmdPresetStatus(Z88FlashChip *chip, const uint8_t *sequence, uint8_t length) {
  for (uint8_t i = 0u; i < length; i++) chip->status[i] = sequence[length - 1u - i];
  chip->statusDepth = length;
}

/* The TypeScript stack's `pop` on an empty stack answers undefined; no command sequence gets there */
static uint16_t z88AmdPopUnlock(Z88FlashChip *chip) {
  return chip->unlockDepth ? chip->unlock[--chip->unlockDepth] : 0xffffu;
}

static uint8_t z88AmdPopStatus(Z88FlashChip *chip) {
  return chip->statusDepth ? chip->status[--chip->statusDepth] : 0xffu;
}

/* An erased card is all $FF (`setPristineState`) */
static void z88CardSetPristine(uint32_t slot) {
  const uint32_t base = slot * Z88_SLOT_SIZE;
  const uint32_t size = z88Cards[slot].size;
  for (uint32_t i = 0u; i < size && base + i < Z88_MEMORY_SIZE; i++) z88Memory[base + i] = 0xffu;
}

/* The 64K sector a bank belongs to, erased (`eraseSector` / `eraseSectorCommand`) */
static void z88CardEraseSector(uint32_t slot, uint8_t bank) {
  const uint32_t start = slot * Z88_SLOT_SIZE + (uint32_t)(bank & 0x3cu) * 0x4000u;
  for (uint32_t i = 0u; i <= 0xffffu; i++) {
    if (start + i < Z88_MEMORY_SIZE) z88Memory[start + i] = 0xffu;
  }
}

/* `onInserted`: the card is erased and its chip is in read-array mode */
static void z88CardInserted(uint32_t slot) {
  const uint8_t kind = z88Cards[slot].kind;
  Z88FlashChip *chip = &z88Flash[slot];
  z88FlashSetReadArrayMode(slot, 1u);
  chip->accumulating = 0u;
  chip->executing = 0u;
  chip->failure = 0u;
  chip->unlockDepth = 0u;
  chip->statusDepth = 0u;
  chip->command = kind == Z88_CARD_INTEL_FLASH ? 0x80u : 0u;
  chip->statusRegister = kind == Z88_CARD_INTEL_FLASH ? 0x80u : 0u;
  if (kind == Z88_CARD_UV_EPROM || kind == Z88_CARD_INTEL_FLASH || kind == Z88_CARD_AMD_29F040B ||
      kind == Z88_CARD_AMD_29F080B) {
    z88CardSetPristine(slot);
  }
}

// -----------------------------------------------------------------------------
// UV EPROM
// -----------------------------------------------------------------------------

/*
 * Blows a byte: only in slot 3, with VPP on and PROGRAM or OVERP set, and EPR matching the chip
 * ($48 for 32K, $69 for 128K/256K). Bits only go from 1 to 0.
 */
static void z88EpromWrite(uint32_t slot, uint8_t bank, uint32_t address, uint8_t value) {
  if (bank < 0xc0u) return;
  if (!(z88Com & Z88_COM_VPPON) || !(z88Com & (Z88_COM_PROGRAM | Z88_COM_OVERP))) return;
  if (z88Epr != (z88Cards[slot].size == 0x8000u ? 0x48u : 0x69u)) return;
  z88Memory[address] = value & z88Memory[address];
}

// -----------------------------------------------------------------------------
// Intel 28F004S5 / 28F008S5
// -----------------------------------------------------------------------------

static uint8_t z88IntelCommandStatus(uint32_t slot, uint8_t bank, uint32_t address) {
  const Z88FlashChip *chip = &z88Flash[slot];
  switch (chip->command) {
    case 0x10u:
    case 0x40u:
    case 0x70u:
    case 0xd0u:
      return chip->statusRegister;
    case 0x90u: {
      /* The manufacturer and device codes are in the card's bottom bank only */
      if ((bank & 0x3fu) != 0u) return 0xffu;
      const uint32_t type = z88CardTypeCode(&z88Cards[slot]);
      switch (address & 0x1fffu) {
        case 0u: return (uint8_t)(type >> 8);
        case 1u: return (uint8_t)type;
        default: return 0xffu;
      }
    }
    default:
      return 0xffu;
  }
}

static void z88IntelWrite(uint32_t slot, uint8_t bank, uint32_t address, uint8_t value) {
  Z88FlashChip *chip = &z88Flash[slot];
  if (chip->readArrayMode) {
    z88FlashSetReadArrayMode(slot, 0u);
    chip->command = 0u;
  }

  if (chip->command == 0x10u || chip->command == 0x40u) {
    /* Byte program, part 2: the address and the byte */
    const uint8_t old = z88Memory[address];
    if ((value & old) == value) {
      z88Memory[address] = value;
      chip->statusRegister = 0x80u;
    } else {
      chip->statusRegister = 0x90u;
    }
    chip->command = 0x70u;
    return;
  }

  switch (value) {
    case 0x20u:
      chip->command = 0x20u;
      break;
    case 0x50u:
      chip->command = 0u;
      chip->statusRegister = 0x80u;
      break;
    case 0x70u:
      chip->command = 0x70u;
      break;
    case 0x90u:
      chip->command = 0x90u;
      break;
    case 0x10u:
    case 0x40u:
      chip->command = 0x40u;
      break;
    case 0xd0u:
      if (chip->command == 0x20u) {
        chip->command = 0xd0u;
        z88CardEraseSector(slot, bank);
        chip->statusRegister = 0x80u;
      }
      break;
    default:
      /* $FF, or a cycle that is not part of a command: back to read-array mode */
      z88FlashSetReadArrayMode(slot, 1u);
      chip->command = 0u;
      break;
  }
}

// -----------------------------------------------------------------------------
// AMD 29F040B / 29F080B
// -----------------------------------------------------------------------------

static void z88AmdAbort(uint32_t slot) {
  z88FlashSetReadArrayMode(slot, 1u);
  z88Flash[slot].accumulating = 0u;
  z88Flash[slot].executing = 0u;
}

static void z88AmdSucceeded(Z88FlashChip *chip) {
  z88AmdPresetStatus(chip, z88AmdStatusSuccess, 2u);
  chip->failure = 0u;
}

static void z88AmdWrite(uint32_t slot, uint8_t bank, uint32_t address, uint8_t value) {
  Z88FlashChip *chip = &z88Flash[slot];
  if (chip->readArrayMode) {
    z88FlashSetReadArrayMode(slot, 0u);
    chip->accumulating = 1u;
    chip->command = 0u;
    z88AmdPresetUnlock(chip);
  }

  if (!chip->accumulating) {
    /* Executing: only the reset ($F0) is accepted */
    if (value == 0xf0u) z88AmdAbort(slot);
    return;
  }

  const uint16_t cycleAddress = z88AmdPopUnlock(chip);
  const uint16_t cycleData = z88AmdPopUnlock(chip);
  if (cycleData != Z88_AMD_ANY) {
    /* An unlock cycle: address bits 0-10 and the data must match */
    if ((address & 0x07ffu) != cycleAddress || value != cycleData) z88AmdAbort(slot);
    return;
  }

  if (chip->command == 0xa0u) {
    /* Byte program, part 2: the address and the byte */
    chip->accumulating = 0u;
    chip->executing = 1u;
    const uint8_t old = z88Memory[address];
    if ((value & old) == value) {
      z88Memory[address] = value;
      z88AmdSucceeded(chip);
    } else {
      z88AmdPresetStatus(chip, z88AmdStatusFailure, 4u);
      chip->failure = 1u;
    }
    return;
  }

  switch (value) {
    case 0x10u:
      /* Chip erase */
      chip->accumulating = 0u;
      chip->executing = 1u;
      chip->command = 0x10u;
      z88CardSetPristine(slot);
      z88AmdSucceeded(chip);
      break;
    case 0x30u:
      /* Sector erase */
      chip->accumulating = 0u;
      chip->executing = 1u;
      chip->command = 0x30u;
      z88CardEraseSector(slot, bank);
      z88AmdSucceeded(chip);
      break;
    case 0x80u:
      /* Erase, part 1: another unlock sequence follows */
      z88AmdPresetUnlock(chip);
      break;
    case 0x90u:
      /* Autoselect */
      chip->accumulating = 0u;
      chip->executing = 1u;
      chip->command = 0x90u;
      break;
    case 0xa0u:
      /* Byte program, part 1: one more cycle brings the address and the byte */
      chip->command = 0xa0u;
      chip->unlock[chip->unlockDepth++] = Z88_AMD_ANY;
      chip->unlock[chip->unlockDepth++] = Z88_AMD_ANY;
      break;
    default:
      z88AmdAbort(slot);
      break;
  }
}

static uint8_t z88AmdCommandStatus(uint32_t slot, uint32_t address) {
  Z88FlashChip *chip = &z88Flash[slot];
  if (chip->accumulating || !chip->executing) {
    /* A read aborts a command being accumulated; after a command, the chip reads its array again */
    z88AmdAbort(slot);
    return z88Memory[address];
  }

  switch (chip->command) {
    case 0x10u:
    case 0x30u:
    case 0xa0u: {
      if (chip->failure) {
        /* The error toggle keeps flowing until the reset command */
        if (!chip->statusDepth) z88AmdPresetStatus(chip, z88AmdStatusFailure, 4u);
        return z88AmdPopStatus(chip);
      }
      const uint8_t status = z88AmdPopStatus(chip);
      if (!chip->statusDepth) z88AmdAbort(slot);
      return status;
    }
    case 0x90u: {
      const uint32_t type = z88CardTypeCode(&z88Cards[slot]);
      switch (address & 0xffu) {
        case 0u: return (uint8_t)(type >> 8);
        case 1u: return (uint8_t)type;
        default: return 0xffu;
      }
    }
    default:
      z88AmdAbort(slot);
      return z88Memory[address];
  }
}

// -----------------------------------------------------------------------------
// The memory map's entry points
// -----------------------------------------------------------------------------

/* A read of a slot whose chip is in a command state */
static uint8_t z88CardCommandRead(uint32_t slot, uint8_t bank, uint32_t address) {
  switch (z88Cards[slot].kind) {
    case Z88_CARD_INTEL_FLASH: return z88IntelCommandStatus(slot, bank, address);
    case Z88_CARD_AMD_29F040B:
    case Z88_CARD_AMD_29F080B: return z88AmdCommandStatus(slot, address);
    default: return z88Memory[address];
  }
}

/* A write to a slot's EPROM or flash card */
static void z88CardWrite(uint32_t slot, uint8_t bank, uint32_t address, uint8_t value) {
  switch (z88Cards[slot].kind) {
    case Z88_CARD_UV_EPROM: z88EpromWrite(slot, bank, address, value); break;
    case Z88_CARD_INTEL_FLASH: z88IntelWrite(slot, bank, address, value); break;
    case Z88_CARD_AMD_29F040B:
    case Z88_CARD_AMD_29F080B: z88AmdWrite(slot, bank, address, value); break;
    default: break;
  }
}

/* Whether a slot's flash chip reads its array (1) or answers command status (0); 1 for other cards */
uint32_t z88GetCardReadArrayMode(uint32_t slot) {
  return slot < 4u ? (z88CardCommandMode[slot] ? 0u : 1u) : 1u;
}
