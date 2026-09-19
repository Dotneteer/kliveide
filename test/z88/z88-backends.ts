import type { IZ88MemoryCard } from "@emu/machines/z88/memory/IZ88MemoryCard";
import type { IZ88BankedMemoryTestSupport } from "@emu/machines/z88/memory/Z88BankedMemory";
import type { IZ88BlinkTestDevice } from "@emu/machines/z88/IZ88BlinkTestDevice";
import type { IZ88BlinkDevice } from "@emu/machines/z88/IZ88BlinkDevice";
import type { Z88WasmV2Exports, Z88WasmV2Views } from "@emu/machines/z88/wasm/Z88WasmV2Loader";
import type {
  Z88TestBackend,
  Z88TestFlashCard,
  Z88TestBlink,
  Z88TestCard,
  Z88TestCards,
  Z88TestMemory,
  Z88TestSurface
} from "./z88-test-surface";

import { CardType, z88ChipMaskForSize } from "@emu/machines/z88/z88CardCatalog";
import { createZ88WasmV2Views, validateZ88WasmV2Exports } from "@emu/machines/z88/wasm/Z88WasmV2Loader";
import { z88HarnessBackends, z88WasmArtifactBytes, type Z88Feature } from "../harness/z88";
import { Z88RomMemoryCard } from "@emu/machines/z88/memory/Z88RomMemoryCard";
import { Z88RamMemoryCard } from "@emu/machines/z88/memory/Z88RamMemoryCard";
import { Z88UvEpromMemoryCard } from "@emu/machines/z88/memory/Z88UvEpromMemoryCard";
import { Z88IntelFlashMemoryCard } from "@emu/machines/z88/memory/Z88IntelFlashMemoryCard";
import { Z88AmdFlash29F040B } from "@emu/machines/z88/memory/Z88AmdFlash29F040B";
import { Z88AmdFlash29F080B } from "@emu/machines/z88/memory/Z88AmdFlash29F080B";
import { Z88TestMachine } from "./Z88TestMachine";

/*
 * The backends the Z88 core suites run on. Each suite's top-level block is
 * `describe.each(z88Backends(...features))("... ($name)", ({ create }) => ...)`: the TypeScript
 * machine always, the WASM core once it emulates every feature the suite needs - with identical
 * assertions (`.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`).
 */

/**
 * The TypeScript Z88 behind the test surface. It hands out the real TypeScript card classes and
 * Blink device, so the suites exercise exactly the objects they did before they were parameterized.
 */
export class TypeScriptZ88Surface implements Z88TestSurface {
  readonly backend = "typescript" as const;
  readonly machine = new Z88TestMachine();
  readonly memory: Z88TestMemory;
  readonly blink: Z88TestBlink;
  readonly cards: Z88TestCards;

  constructor() {
    const m = this.machine;
    const mem = m.memory;
    const memTest = mem as unknown as IZ88BankedMemoryTestSupport;
    this.memory = {
      readMemory: (address) => mem.readMemory(address),
      writeMemory: (address, value) => mem.writeMemory(address, value),
      insertCard: (slot, card, content) => mem.insertCard(slot, asCard(card), content),
      removeCard: (slot) => mem.removeCard(slot),
      setRamCard: (card) => memTest.setRamCard(asCard(card))
    };
    this.blink = m.blinkDevice as IZ88BlinkDevice & IZ88BlinkTestDevice;
    this.cards = {
      rom: (size) => new Z88RomMemoryCard(m, size),
      ram: (size) => new Z88RamMemoryCard(m, size),
      uvEprom: (size) => new Z88UvEpromMemoryCard(m, size),
      intelFlash: (size) => new Z88IntelFlashMemoryCard(m, size),
      amdFlash29F040B: () => new Z88AmdFlash29F040B(m),
      amdFlash29F080B: () => new Z88AmdFlash29F080B(m)
    };
  }

  private get memTest(): IZ88BankedMemoryTestSupport {
    return this.machine.memory as unknown as IZ88BankedMemoryTestSupport;
  }

  get chipMask0(): number {
    return this.memTest.cards[0]?.chipMask ?? 0x00;
  }

  get chipMask1(): number {
    return this.memTest.cards[1]?.chipMask ?? 0x00;
  }

  get chipMask2(): number {
    return this.memTest.cards[2]?.chipMask ?? 0x00;
  }

  get chipMask3(): number {
    return this.memTest.cards[3]?.chipMask ?? 0x00;
  }

  get chipMaskIntRam(): number {
    return this.memTest.intRamCard?.chipMask ?? 0x00;
  }

  pageBank(page: number): number {
    return this.memTest.bankData[page].bank;
  }

  pageOffset(page: number): number {
    return this.memTest.bankData[page].offset;
  }

  pageCardType(page: number): CardType {
    return this.memTest.bankData[page].handler?.type ?? CardType.None;
  }

  slotCardType(slot: number): CardType {
    return this.memTest.cards[slot]?.type ?? CardType.None;
  }

  get s0OffsetL(): number {
    return this.pageOffset(0);
  }

  get s0TypeL(): CardType {
    return this.pageCardType(0);
  }

  get s0OffsetH(): number {
    return this.pageOffset(1);
  }

  get s0TypeH(): CardType {
    return this.pageCardType(1);
  }

  get s1OffsetL(): number {
    return this.pageOffset(2);
  }

  get s1TypeL(): CardType {
    return this.pageCardType(2);
  }

  get s1OffsetH(): number {
    return this.pageOffset(3);
  }

  get s1TypeH(): CardType {
    return this.pageCardType(3);
  }

  get s2OffsetL(): number {
    return this.pageOffset(4);
  }

  get s2TypeL(): CardType {
    return this.pageCardType(4);
  }

  get s2OffsetH(): number {
    return this.pageOffset(5);
  }

  get s2TypeH(): CardType {
    return this.pageCardType(5);
  }

  get s3OffsetL(): number {
    return this.pageOffset(6);
  }

  get s3TypeL(): CardType {
    return this.pageCardType(6);
  }

  get s3OffsetH(): number {
    return this.pageOffset(7);
  }

  get s3TypeH(): CardType {
    return this.pageCardType(7);
  }

  setSR0(bank: number): void {
    this.blink.setSR0(bank);
  }

  setSR1(bank: number): void {
    this.blink.setSR1(bank);
  }

  setSR2(bank: number): void {
    this.blink.setSR2(bank);
  }

  setSR3(bank: number): void {
    this.blink.setSR3(bank);
  }

  directMemoryRead(absAddress: number): number {
    return this.machine.memory.directRead(absAddress);
  }

  directMemoryWrite(absAddress: number, value: number): void {
    this.machine.memory.directWrite(absAddress, value);
  }
}

/** The TypeScript backend's cards are the real card objects */
function asCard(card: Z88TestCard): IZ88MemoryCard {
  return card as unknown as IZ88MemoryCard;
}

export const TYPESCRIPT_Z88_BACKEND: Z88TestBackend = {
  name: "typescript",
  create: () => new TypeScriptZ88Surface()
};

// ==========================================================================================
// The WASM backend

/** The core's card kind codes (`z88-memory.c`) */
const WASM_CARD_KIND = { RAM: 1, ROM: 2, UV_EPROM: 3, INTEL_FLASH: 4, AMD_040: 5, AMD_080: 6 } as const;

/** A card of the WASM backend: what it is, and (once inserted) where */
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
 * driven through the core's exports - the memory map, the cards and the Blink as the TypeScript
 * surface drives the TypeScript memory and Blink device. It starts as the TypeScript test machine
 * does: 512K internal RAM, a blank 512K ROM card in slot 0, reset.
 */
export class WasmZ88Surface implements Z88TestSurface {
  readonly backend = "wasm" as const;
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

export const WASM_Z88_BACKEND: Z88TestBackend = {
  name: "wasm",
  create: () => new WasmZ88Surface()
};

/**
 * The backends a Z88 core suite runs on: the TypeScript machine always, the WASM core once it emulates
 * every feature the suite needs (`Z88_WASM_FEATURES`, shared with the session harness).
 * @param needs What the suite needs the machine to emulate
 */
export function z88Backends(...needs: Z88Feature[]): readonly Z88TestBackend[] {
  return z88HarnessBackends(...needs).map((name) => (name === "wasm" ? WASM_Z88_BACKEND : TYPESCRIPT_Z88_BACKEND));
}
