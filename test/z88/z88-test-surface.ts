import type { CardType } from "@emu/machines/z88/z88CardCatalog";

/*
 * The backend-neutral surface the Z88 core test suites drive.
 *
 * Every suite in `test/z88/` runs once per entry of `Z88_BACKENDS` (see `z88-backends.ts`). A
 * backend creates a fresh machine behind this surface: the TypeScript backend passes its real memory
 * cards and Blink device straight through; the WASM backend (Step 4 of
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`) answers the same members from core exports.
 *
 * The member names deliberately match the TypeScript objects the suites used before they were
 * parameterized, so the assertions did not have to change.
 */

/** The name of a Z88 emulation backend */
export type Z88BackendName = "typescript" | "wasm";

/**
 * A memory card the test created. It is inserted with `memory.insertCard` (or installed as the
 * internal RAM with `memory.setRamCard`).
 */
export interface Z88TestCard {
  /** The card's hardware type */
  readonly type: CardType;
  /** The card size in bytes */
  readonly size: number;
  /** The chip (address line) mask the size implies */
  readonly chipMask: number;
}

/** A flash card: it can tell whether its chip is in read-array mode or in a command state */
export interface Z88TestFlashCard extends Z88TestCard {
  readArrayModeState(): boolean;
}

/** Creates the memory cards of a test machine */
export interface Z88TestCards {
  rom(size: number): Z88TestCard;
  ram(size: number): Z88TestCard;
  uvEprom(size: number): Z88TestCard;
  intelFlash(size: number): Z88TestFlashCard;
  amdFlash29F040B(): Z88TestFlashCard;
  amdFlash29F080B(): Z88TestFlashCard;
}

/** The banked memory, as the CPU's memory bus and the slot hardware see it */
export interface Z88TestMemory {
  /** Reads a byte through the current paging (the CPU's view; no timing) */
  readMemory(address: number): number;
  /** Writes a byte through the current paging (the CPU's view; no timing) */
  writeMemory(address: number, value: number): void;
  /** Inserts a card into slot 0-3, optionally with its initial content (length = card size) */
  insertCard(slot: number, card: Z88TestCard, content?: Uint8Array): void;
  /** Removes the card from slot 0-3 */
  removeCard(slot: number): void;
  /**
   * Replaces the internal RAM card. Like the TypeScript memory's test support, this does not
   * recalculate the current paging: set a segment register afterwards to see the new card.
   */
  setRamCard(card: Z88TestCard): void;
}

/** The Blink's registers and its real-time clock */
export interface Z88TestBlink {
  readonly SR0: number;
  readonly SR1: number;
  readonly SR2: number;
  readonly SR3: number;
  readonly TIM0: number;
  readonly TIM1: number;
  readonly TIM2: number;
  readonly TIM3: number;
  readonly TIM4: number;
  readonly TSTA: number;
  TMK: number;
  readonly INT: number;
  readonly STA: number;
  readonly COM: number;
  EPR: number;
  setSR0(bank: number): void;
  setSR1(bank: number): void;
  setSR2(bank: number): void;
  setSR3(bank: number): void;
  setCOM(value: number): void;
  setINT(value: number): void;
  setSTA(value: number): void;
  setTACK(value: number): void;
  setACK(value: number): void;
  /** Resets the RTC counters */
  resetRtc(): void;
  /** Advances the RTC by one 5 ms tick, as the machine does at every frame start */
  incrementRtc(): void;
}

/** A fresh Z88 test machine, whichever backend emulates it */
export interface Z88TestSurface {
  readonly backend: Z88BackendName;
  readonly memory: Z88TestMemory;
  readonly blink: Z88TestBlink;
  readonly cards: Z88TestCards;

  /** Chip masks of the cards in slots 0-3 and of the internal RAM (0 when empty) */
  readonly chipMask0: number;
  readonly chipMask1: number;
  readonly chipMask2: number;
  readonly chipMask3: number;
  readonly chipMaskIntRam: number;

  /** Physical offsets and card types of the eight 8K logical pages (s<segment><Low|High>) */
  readonly s0OffsetL: number;
  readonly s0TypeL: CardType;
  readonly s0OffsetH: number;
  readonly s0TypeH: CardType;
  readonly s1OffsetL: number;
  readonly s1TypeL: CardType;
  readonly s1OffsetH: number;
  readonly s1TypeH: CardType;
  readonly s2OffsetL: number;
  readonly s2TypeL: CardType;
  readonly s2OffsetH: number;
  readonly s2TypeH: CardType;
  readonly s3OffsetL: number;
  readonly s3TypeL: CardType;
  readonly s3OffsetH: number;
  readonly s3TypeH: CardType;

  /** The bank mapped into 8K logical page 0-7 */
  pageBank(page: number): number;
  /** The physical offset of 8K logical page 0-7 */
  pageOffset(page: number): number;
  /** The type of the card behind 8K logical page 0-7 (`CardType.None` when nothing is there) */
  pageCardType(page: number): CardType;
  /** The type of the card in slot 0-3 (`CardType.None` when empty) */
  slotCardType(slot: number): CardType;

  setSR0(bank: number): void;
  setSR1(bank: number): void;
  setSR2(bank: number): void;
  setSR3(bank: number): void;

  /** Reads a byte of the 4 MB physical memory */
  directMemoryRead(absAddress: number): number;
  /** Writes a byte of the 4 MB physical memory */
  directMemoryWrite(absAddress: number, value: number): void;
}

/** A backend the suites run on */
export interface Z88TestBackend {
  readonly name: Z88BackendName;
  /** Creates a fresh machine: 512K internal RAM, a blank 512K ROM card in slot 0, no ROM loaded */
  create(): Z88TestSurface;
}
