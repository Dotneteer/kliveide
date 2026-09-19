import type { IZ88MemoryCard } from "@emu/machines/z88/memory/IZ88MemoryCard";
import type { IZ88BankedMemoryTestSupport } from "@emu/machines/z88/memory/Z88BankedMemory";
import type { IZ88BlinkTestDevice } from "@emu/machines/z88/IZ88BlinkTestDevice";
import type { IZ88BlinkDevice } from "@emu/machines/z88/IZ88BlinkDevice";
import type {
  Z88TestBackend,
  Z88TestBlink,
  Z88TestCard,
  Z88TestCards,
  Z88TestMemory,
  Z88TestSurface
} from "./z88-test-surface";

import { CardType } from "@emu/machines/z88/z88CardCatalog";
import { Z88RomMemoryCard } from "@emu/machines/z88/memory/Z88RomMemoryCard";
import { Z88RamMemoryCard } from "@emu/machines/z88/memory/Z88RamMemoryCard";
import { Z88UvEpromMemoryCard } from "@emu/machines/z88/memory/Z88UvEpromMemoryCard";
import { Z88IntelFlashMemoryCard } from "@emu/machines/z88/memory/Z88IntelFlashMemoryCard";
import { Z88AmdFlash29F040B } from "@emu/machines/z88/memory/Z88AmdFlash29F040B";
import { Z88AmdFlash29F080B } from "@emu/machines/z88/memory/Z88AmdFlash29F080B";
import { Z88TestMachine } from "./Z88TestMachine";

/*
 * The backends the Z88 core suites run on. Each suite's top-level block is
 * `describe.each(Z88_BACKENDS)("... ($name)", ({ create }) => ...)`.
 *
 * Only the TypeScript backend exists until Step 4 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`
 * adds the WASM one; from then on every suite runs on both, with identical assertions.
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

/** Every backend the Z88 core suites run on */
export const Z88_BACKENDS: readonly Z88TestBackend[] = [TYPESCRIPT_Z88_BACKEND];
