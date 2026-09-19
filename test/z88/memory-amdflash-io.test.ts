import { describe, it, expect } from "vitest";
import { Z88_BACKENDS } from "./z88-backends";
import type { Z88TestFlashCard, Z88TestSurface } from "./z88-test-surface";

/*
 * AMD 29F040B / 29F080B flash cards (and the compatible chips OZ drives the same way).
 *
 * The command protocol is the AMD datasheet's: every command starts with the unlock cycles
 * $555/$AA, $2AA/$55 (only A0-A10 of the address are decoded), then $555/<command>. Byte program is
 * $A0 followed by the address/data cycle; erase is $80, a second unlock, then $10 (chip) or $30
 * (64K sector). $90 is autoselect (manufacturer code at XX00, device code at XX01) and $F0 returns
 * to read-array mode. A 0 bit cannot be programmed back to 1.
 *
 * The status reads (DQ6 toggle sequences) are the TypeScript oracle's model: two $40 reads on
 * success, then read-array mode again; $60/$20 repeating on failure until $F0 is written.
 *
 * Added in Step 0.3 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`; there was no AMD flash test.
 */

// --- The card sits in slot 1; SR3 maps one of its banks at $C000-$FFFF
const SLOT = 1;
const SLOT_BASE = SLOT * 0x10_0000;
const BANK_BASE = SLOT * 0x40;

function unlock(m: Z88TestSurface, command: number): void {
  m.memory.writeMemory(0xc555, 0xaa);
  m.memory.writeMemory(0xc2aa, 0x55);
  m.memory.writeMemory(0xc555, command);
}

function program(m: Z88TestSurface, address: number, value: number): void {
  unlock(m, 0xa0);
  m.memory.writeMemory(address, value);
}

describe.each(Z88_BACKENDS)("Z88 - AMD Flash Card Read / program / erase ($name)", function ({ create }) {
  function setup(chip: "040" | "080" = "040"): { m: Z88TestSurface; card: Z88TestFlashCard } {
    const m = create();
    const card = chip === "040" ? m.cards.amdFlash29F040B() : m.cards.amdFlash29F080B();
    m.memory.insertCard(SLOT, card);
    m.setSR3(BANK_BASE);
    return { m, card };
  }

  it.each([
    ["040", 0x08_0000, 0x1f],
    ["080", 0x10_0000, 0x3f]
  ] as const)("29F%s is %i bytes with chip mask %i, erased (all $FF) when inserted", (chip, size, mask) => {
    const { m, card } = setup(chip);
    expect(card.size).toBe(size);
    expect(card.chipMask).toBe(mask);
    expect(card.readArrayModeState()).toBe(true);
    for (const offset of [0, 0x1234, size - 1]) {
      expect(m.directMemoryRead(SLOT_BASE + offset)).toBe(0xff);
    }
    expect(m.memory.readMemory(0xc000)).toBe(0xff);
  });

  it("programs a byte (1 -> 0 bits) and reports success through two status reads", () => {
    const { m, card } = setup();
    program(m, 0xc123, 0x55);
    expect(card.readArrayModeState()).toBe(false);
    expect(m.memory.readMemory(0xc123)).toBe(0x40);
    expect(m.memory.readMemory(0xc123)).toBe(0x40);
    expect(card.readArrayModeState()).toBe(true);
    expect(m.memory.readMemory(0xc123)).toBe(0x55);
    expect(m.directMemoryRead(SLOT_BASE + 0x0123)).toBe(0x55);
  });

  it("refuses to program a 0 bit back to 1 and keeps signalling the error until reset ($F0)", () => {
    const { m, card } = setup();
    program(m, 0xc010, 0x0f);
    m.memory.readMemory(0xc010);
    m.memory.readMemory(0xc010);

    program(m, 0xc010, 0xf0);
    const statuses = [0, 1, 2, 3, 4, 5].map(() => m.memory.readMemory(0xc010));
    expect(statuses).toEqual([0x60, 0x20, 0x60, 0x20, 0x60, 0x20]);
    expect(card.readArrayModeState()).toBe(false);

    m.memory.writeMemory(0xc010, 0xf0);
    expect(card.readArrayModeState()).toBe(true);
    expect(m.memory.readMemory(0xc010)).toBe(0x0f);
  });

  it("decodes only A0-A10 of the unlock cycle addresses", () => {
    const { m } = setup();
    // --- $D555 and $CAAA have the same A0-A10 as $C555 and $C2AA
    m.memory.writeMemory(0xd555, 0xaa);
    m.memory.writeMemory(0xcaaa, 0x55);
    m.memory.writeMemory(0xd555, 0xa0);
    m.memory.writeMemory(0xc200, 0x12);
    m.memory.readMemory(0xc200);
    m.memory.readMemory(0xc200);
    expect(m.memory.readMemory(0xc200)).toBe(0x12);
  });

  it("a wrong unlock cycle returns to read-array mode without programming", () => {
    const { m, card } = setup();
    m.memory.writeMemory(0xc555, 0xaa);
    m.memory.writeMemory(0xc2aa, 0x56); // not $55
    expect(card.readArrayModeState()).toBe(true);
    m.memory.writeMemory(0xc300, 0x00);
    expect(m.memory.readMemory(0xc300)).toBe(0xff);
  });

  it("a read while a command is being accumulated aborts it", () => {
    const { m, card } = setup();
    m.memory.writeMemory(0xc555, 0xaa);
    expect(card.readArrayModeState()).toBe(false);
    expect(m.memory.readMemory(0xc400)).toBe(0xff);
    expect(card.readArrayModeState()).toBe(true);
  });

  it.each([
    ["040", 0x01, 0xa4],
    ["080", 0x01, 0xd5]
  ] as const)("29F%s autoselect reports manufacturer code %i and device code %i until $F0", (chip, manufacturer, device) => {
    const { m, card } = setup(chip);
    unlock(m, 0x90);
    expect(m.memory.readMemory(0xc000)).toBe(manufacturer);
    expect(m.memory.readMemory(0xc001)).toBe(device);
    expect(m.memory.readMemory(0xc002)).toBe(0xff);
    expect(m.memory.readMemory(0xc000)).toBe(manufacturer);
    m.memory.writeMemory(0xc000, 0xf0);
    expect(card.readArrayModeState()).toBe(true);
    expect(m.memory.readMemory(0xc000)).toBe(0xff);
  });

  it("sector erase ($80, unlock, $30) erases the 64K sector of the addressed bank only", () => {
    const { m } = setup();
    // --- Bank 5 of the card is in sector 1 (banks 4-7)
    m.setSR3(BANK_BASE + 5);
    program(m, 0xc000, 0x00);
    m.memory.readMemory(0xc000);
    m.memory.readMemory(0xc000);
    // --- Bank 8 is in sector 2
    m.setSR3(BANK_BASE + 8);
    program(m, 0xc000, 0x00);
    m.memory.readMemory(0xc000);
    m.memory.readMemory(0xc000);
    expect(m.directMemoryRead(SLOT_BASE + 5 * 0x4000)).toBe(0x00);
    expect(m.directMemoryRead(SLOT_BASE + 8 * 0x4000)).toBe(0x00);

    m.setSR3(BANK_BASE + 6);
    unlock(m, 0x80);
    unlock(m, 0x30);
    expect(m.memory.readMemory(0xc000)).toBe(0x40);
    expect(m.memory.readMemory(0xc000)).toBe(0x40);

    expect(m.directMemoryRead(SLOT_BASE + 5 * 0x4000)).toBe(0xff);
    expect(m.directMemoryRead(SLOT_BASE + 4 * 0x4000)).toBe(0xff);
    expect(m.directMemoryRead(SLOT_BASE + 8 * 0x4000)).toBe(0x00);
  });

  it("chip erase ($80, unlock, $10) erases the whole card", () => {
    const { m } = setup();
    for (const bank of [0, 9, 31]) {
      m.setSR3(BANK_BASE + bank);
      program(m, 0xc000, 0x3c);
      m.memory.readMemory(0xc000);
      m.memory.readMemory(0xc000);
      expect(m.directMemoryRead(SLOT_BASE + bank * 0x4000)).toBe(0x3c);
    }

    unlock(m, 0x80);
    unlock(m, 0x10);
    expect(m.memory.readMemory(0xc000)).toBe(0x40);
    expect(m.memory.readMemory(0xc000)).toBe(0x40);

    for (const bank of [0, 9, 31]) {
      expect(m.directMemoryRead(SLOT_BASE + bank * 0x4000)).toBe(0xff);
    }
  });

  it("an unknown command returns to read-array mode", () => {
    const { m, card } = setup();
    unlock(m, 0x77);
    expect(card.readArrayModeState()).toBe(true);
    expect(m.memory.readMemory(0xc000)).toBe(0xff);
  });

  it("is writable in slot 3 as well", () => {
    const m = create();
    const card = m.cards.amdFlash29F040B();
    m.memory.insertCard(3, card);
    m.setSR3(0xc0);
    program(m, 0xc100, 0xa5);
    m.memory.readMemory(0xc100);
    m.memory.readMemory(0xc100);
    expect(m.directMemoryRead(3 * 0x10_0000 + 0x100)).toBe(0xa5);
  });
});
