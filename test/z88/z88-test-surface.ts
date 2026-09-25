import type { Z88WasmV2Exports, Z88WasmV2Views } from "@emu/machines/z88/wasm/Z88WasmV2Loader";

import { CardType, z88ChipMaskForSize } from "@emu/machines/z88/z88CardCatalog";
import { createZ88WasmV2Views, validateZ88WasmV2Exports } from "@emu/machines/z88/wasm/Z88WasmV2Loader";
import { z88WasmArtifactBytes } from "../harness/z88";

/*
 * The surface the Z88 core test suites drive: the memory map and the cards, the Blink's registers
 * and its real-time clock, below the CPU and the frame loop.
 *
 * `createZ88TestSurface()` answers every member from the exports of a fresh instance of the WASM
 * core. The member names are those of the TypeScript memory, cards and Blink device the suites were
 * first written against (removed with the TypeScript Z88, `.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`),
 * so the assertions did not have to change.
 */

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
   * Replaces the internal RAM card. This does not recalculate the current paging: set a segment
   * register afterwards to see the new card.
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

/** A fresh Z88 test machine */
export interface Z88TestSurface {
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

/** Creates a fresh machine: 512K internal RAM, a blank 512K ROM card in slot 0, no ROM loaded */
export function createZ88TestSurface(): Z88TestSurface {
  return new WasmZ88Surface();
}

// ==========================================================================================
// The WASM core behind the surface

/** The core's card kind codes (`z88-memory.c`) */
const WASM_CARD_KIND = { RAM: 1, ROM: 2, UV_EPROM: 3, INTEL_FLASH: 4, AMD_040: 5, AMD_080: 6 } as const;

/** A card of the test surface: what it is, and (once inserted) where */
class WasmZ88TestCard implements Z88TestFlashCard {
  slot: number | undefined;
  exports: Z88WasmV2Exports | undefined;
  readonly chipMask: number;

  constructor(
    readonly kindCode: number,
    readonly type: CardType,
    readonly size: number
  ) {
    this.chipMask = z88ChipMaskForSize(size);
  }

  /** The chip state of the slot the card is in; a card never inserted reads its array */
  readArrayModeState(): boolean {
    if (this.slot === undefined || !this.exports) return true;
    return this.exports.z88GetCardReadArrayMode(this.slot) !== 0;
  }
}

let wasmModule: WebAssembly.Module | undefined;

/**
 * The WASM core behind the test surface: a fresh instance of the compiled artifact per machine,
 * driven through the core's exports - the memory map, the cards and the Blink. It starts with 512K
 * internal RAM, a blank 512K ROM card in slot 0, reset.
 */
class WasmZ88Surface implements Z88TestSurface {
  readonly exports: Z88WasmV2Exports;
  readonly views: Z88WasmV2Views;
  readonly memory: Z88TestMemory;
  readonly blink: Z88TestBlink;
  readonly cards: Z88TestCards;

  constructor() {
    wasmModule ??= new WebAssembly.Module(z88WasmArtifactBytes());
    const e = new WebAssembly.Instance(wasmModule, {}).exports as Z88WasmV2Exports;
    validateZ88WasmV2Exports(e, "z88-test-surface.wasm");
    this.exports = e;
    this.views = createZ88WasmV2Views(e, "z88-test-surface.wasm");
    const views = this.views;

    e.z88SetInternalRamSize(0x08_0000);
    e.z88InsertCard(0, WASM_CARD_KIND.ROM, 0x08_0000);
    e.z88Reset();

    this.memory = {
      readMemory: (address) => e.z88ReadMemory(address),
      writeMemory: (address, value) => e.z88WriteMemory(address, value),
      insertCard: (slot, card, content) => {
        if (slot < 0 || slot > 3) throw new Error("Invalid slot index");
        const c = card as WasmZ88TestCard;
        c.slot = slot;
        c.exports = e;
        e.z88InsertCard(slot, c.kindCode, c.size);
        if (content) {
          if (content.length !== c.size) {
            throw new Error(`Invalid initial content size (${content.length}/${c.size})`);
          }
          views.memory.set(content, slot * 0x10_0000);
        }
      },
      removeCard: (slot) => e.z88RemoveCard(slot),
      setRamCard: (card) => e.z88SetInternalRamSize(card.size)
    };

    this.blink = {
      get SR0() { return e.z88GetSr(0); },
      get SR1() { return e.z88GetSr(1); },
      get SR2() { return e.z88GetSr(2); },
      get SR3() { return e.z88GetSr(3); },
      get TIM0() { return e.z88GetTim(0); },
      get TIM1() { return e.z88GetTim(1); },
      get TIM2() { return e.z88GetTim(2); },
      get TIM3() { return e.z88GetTim(3); },
      get TIM4() { return e.z88GetTim(4); },
      get TSTA() { return e.z88GetTsta(); },
      get TMK() { return e.z88GetTmk(); },
      set TMK(value: number) { e.z88SetTmk(value); },
      get INT() { return e.z88GetInt(); },
      get STA() { return e.z88GetSta(); },
      get COM() { return e.z88GetCom(); },
      get EPR() { return e.z88GetEpr(); },
      set EPR(value: number) { e.z88SetEpr(value); },
      setSR0: (bank) => e.z88SetSr(0, bank),
      setSR1: (bank) => e.z88SetSr(1, bank),
      setSR2: (bank) => e.z88SetSr(2, bank),
      setSR3: (bank) => e.z88SetSr(3, bank),
      setCOM: (value) => e.z88SetCom(value),
      setINT: (value) => e.z88SetInt(value),
      setSTA: (value) => e.z88SetSta(value),
      setTACK: (value) => e.z88SetTack(value),
      setACK: (value) => e.z88SetAck(value),
      resetRtc: () => e.z88TestResetRtc!(),
      incrementRtc: () => e.z88TestIncrementRtc!()
    };

    this.cards = {
      rom: (size) => new WasmZ88TestCard(WASM_CARD_KIND.ROM, CardType.Rom, size),
      ram: (size) => new WasmZ88TestCard(WASM_CARD_KIND.RAM, CardType.Ram, size),
      uvEprom: (size) =>
        new WasmZ88TestCard(
          WASM_CARD_KIND.UV_EPROM,
          size === 0x8000 ? CardType.EpromVpp32KB : CardType.EpromVpp128KB,
          size
        ),
      intelFlash: (size) =>
        new WasmZ88TestCard(
          WASM_CARD_KIND.INTEL_FLASH,
          size === 0x8_0000 ? CardType.FlashIntel28F004S5 : CardType.FlashIntel28F008S5,
          size
        ),
      amdFlash29F040B: () => new WasmZ88TestCard(WASM_CARD_KIND.AMD_040, CardType.FlashAmd29F040B, 0x8_0000),
      amdFlash29F080B: () => new WasmZ88TestCard(WASM_CARD_KIND.AMD_080, CardType.FlashAmd29F080B, 0x10_0000)
    };
  }

  get chipMask0(): number {
    return this.exports.z88GetSlotChipMask(0);
  }
  get chipMask1(): number {
    return this.exports.z88GetSlotChipMask(1);
  }
  get chipMask2(): number {
    return this.exports.z88GetSlotChipMask(2);
  }
  get chipMask3(): number {
    return this.exports.z88GetSlotChipMask(3);
  }
  get chipMaskIntRam(): number {
    return this.exports.z88GetSlotChipMask(4);
  }

  pageBank(page: number): number {
    return this.exports.z88GetPageBank(page);
  }
  pageOffset(page: number): number {
    return this.exports.z88GetPageOffset(page);
  }
  pageCardType(page: number): CardType {
    return this.exports.z88GetPageCardType(page);
  }
  slotCardType(slot: number): CardType {
    return this.exports.z88GetSlotCardType(slot);
  }

  get s0OffsetL(): number { return this.pageOffset(0); }
  get s0TypeL(): CardType { return this.pageCardType(0); }
  get s0OffsetH(): number { return this.pageOffset(1); }
  get s0TypeH(): CardType { return this.pageCardType(1); }
  get s1OffsetL(): number { return this.pageOffset(2); }
  get s1TypeL(): CardType { return this.pageCardType(2); }
  get s1OffsetH(): number { return this.pageOffset(3); }
  get s1TypeH(): CardType { return this.pageCardType(3); }
  get s2OffsetL(): number { return this.pageOffset(4); }
  get s2TypeL(): CardType { return this.pageCardType(4); }
  get s2OffsetH(): number { return this.pageOffset(5); }
  get s2TypeH(): CardType { return this.pageCardType(5); }
  get s3OffsetL(): number { return this.pageOffset(6); }
  get s3TypeL(): CardType { return this.pageCardType(6); }
  get s3OffsetH(): number { return this.pageOffset(7); }
  get s3TypeH(): CardType { return this.pageCardType(7); }

  setSR0(bank: number): void { this.blink.setSR0(bank); }
  setSR1(bank: number): void { this.blink.setSR1(bank); }
  setSR2(bank: number): void { this.blink.setSR2(bank); }
  setSR3(bank: number): void { this.blink.setSR3(bank); }

  directMemoryRead(absAddress: number): number {
    return this.views.memory[absAddress];
  }
  directMemoryWrite(absAddress: number, value: number): void {
    this.views.memory[absAddress] = value;
  }
}
