import { describe, it, expect } from "vitest";
import { createZ88TestSurface } from "./z88-test-surface";
import type { Z88TestSurface } from "./z88-test-surface";
import { COMFlags, INTFlags, TSTAFlags } from "./z88-blink-flags";

/*
 * The core changes of `.plans/Z88_OZVM_PARITY_PLAN.md` that the older suites do not reach: each case
 * names the OZvm behaviour it holds the core to. OZvm (https://gitlab.com/b4works/ozvm) was read for
 * behaviour only.
 */

const KEY_A = 0x2b; // address line A13 (line 5), bit 3: "A"
const KEY_Q = 0x2c; // address line A13 (line 5), bit 4: "Q"
const STA_KEY = 0x04;
const STA_BTL = 0x08;

// --- A flash card in slot 1, paged in at $C000 through SR3
const SLOT_BASE = 0x10_0000;

function amdUnlock(m: Z88TestSurface, command: number): void {
  m.memory.writeMemory(0xc555, 0xaa);
  m.memory.writeMemory(0xc2aa, 0x55);
  m.memory.writeMemory(0xc555, command);
}

describe("Z88 OZvm parity - the Blink", () => {
  it("power-on clears COM before paging, so $0000 is bank $00 even after COM.RAMS", () => {
    const m = createZ88TestSurface();
    m.blink.setCOM(COMFlags.RAMS);
    expect(m.pageBank(0)).toBe(0x20);
    m.exports.z88ResetBlink();
    expect(m.blink.COM).toBe(0);
    expect(m.pageBank(0)).toBe(0x00);
  });

  it("power-on drops the interrupt line along with STA", () => {
    const m = createZ88TestSurface();
    m.blink.setINT(INTFlags.TIME | INTFlags.GINT);
    m.blink.setSTA(0x01);
    expect(m.exports.z88GetInterruptSignal()).toBe(1);
    m.exports.z88ResetBlink();
    expect(m.blink.STA).toBe(0);
    expect(m.exports.z88GetInterruptSignal()).toBe(0);
  });

  it("the reset button resets the CPU only: COM, SR0-SR3, INT, the clock survive (pressResetButton)", () => {
    const m = createZ88TestSurface();
    m.blink.setCOM(COMFlags.RAMS);
    m.blink.setSR2(0x21);
    m.blink.setINT(0x0b);
    for (let i = 0; i < 300; i++) m.blink.incrementRtc();
    const tim = [m.blink.TIM0, m.blink.TIM1];
    m.exports.z88Reset();
    expect([m.blink.COM, m.blink.SR2, m.blink.INT]).toEqual([COMFlags.RAMS, 0x21, 0x0b]);
    expect([m.blink.TIM0, m.blink.TIM1]).toEqual(tim);
    expect(m.exports.z88GetCpuPc()).toBe(0);
  });

  it("battery low wakes a snoozing CPU (signalBattLow)", () => {
    const m = createZ88TestSurface();
    m.exports.z88SetCpuSnoozed(1);
    m.exports.z88RaiseBatteryLow();
    expect(m.blink.STA & STA_BTL).toBe(STA_BTL);
    expect(m.exports.z88GetCpuSnoozed()).toBe(0);
  });

  it("a key going down raises the key interrupt; a key released while another is held does not", () => {
    const m = createZ88TestSurface();
    m.blink.setINT(INTFlags.KEY | INTFlags.GINT);
    m.exports.z88SetKeyStatus(KEY_A, 1);
    expect(m.blink.STA & STA_KEY).toBe(STA_KEY);
    m.blink.setACK(STA_KEY);
    m.exports.z88SetKeyStatus(KEY_Q, 1);
    expect(m.blink.STA & STA_KEY).toBe(STA_KEY);
    m.blink.setACK(STA_KEY);
    // --- Q released, A still held: no new key event (OZvm's `signalKeyPressed` runs on a press)
    m.exports.z88SetKeyStatus(KEY_Q, 0);
    expect(m.blink.STA & STA_KEY).toBe(0);
  });

  it("COM.RESTIM resets TIM0-TIM4 and keeps the events TSTA latched (resetTimx)", () => {
    const m = createZ88TestSurface();
    for (let i = 0; i < 3; i++) m.blink.incrementRtc();
    expect(m.blink.TSTA & TSTAFlags.TICK).toBe(TSTAFlags.TICK);
    m.blink.setCOM(COMFlags.RESTIM);
    expect([m.blink.TIM0, m.blink.TIM1]).toEqual([0, 0]);
    expect(m.blink.TSTA & TSTAFlags.TICK).toBe(TSTAFlags.TICK);
  });

  it("TXD ($E3) bytes are collected for the host, which clears them", () => {
    const m = createZ88TestSurface();
    for (const byte of [0x48, 0x69, 0x0d]) m.exports.z88WritePort(0xe3, byte);
    expect(m.exports.z88GetUartTxCount()).toBe(3);
    const bytes = new Uint8Array(m.exports.memory.buffer, m.exports.z88UartTxPtr(), 3);
    expect([...bytes]).toEqual([0x48, 0x69, 0x0d]);
    m.exports.z88ClearUartTx();
    expect(m.exports.z88GetUartTxCount()).toBe(0);
  });
});

describe("Z88 OZvm parity - memory and cards", () => {
  it("power-on clears the RAM cards and keeps flash (Memory.resetRam)", () => {
    const m = createZ88TestSurface();
    m.memory.insertCard(1, m.cards.ram(0x2_0000));
    m.memory.insertCard(3, m.cards.amdFlash29F040B());
    m.directMemoryWrite(SLOT_BASE + 0x100, 0x66);
    m.directMemoryWrite(3 * SLOT_BASE + 0x100, 0x77);
    m.exports.z88HardReset();
    expect(m.directMemoryRead(SLOT_BASE + 0x100)).toBe(0x00);
    expect(m.directMemoryRead(3 * SLOT_BASE + 0x100)).toBe(0x77);
  });

  it("a newly inserted card holds no bytes of the card before it: RAM 0, ROM $FF", () => {
    const m = createZ88TestSurface();
    m.memory.insertCard(1, m.cards.rom(0x8000), new Uint8Array(0x8000).fill(0x5a));
    m.memory.removeCard(1);
    m.memory.insertCard(1, m.cards.ram(0x8000));
    expect(m.directMemoryRead(SLOT_BASE)).toBe(0x00);
    m.memory.removeCard(1);
    m.memory.insertCard(1, m.cards.rom(0x8000));
    expect(m.directMemoryRead(SLOT_BASE + 0x7fff)).toBe(0xff);
  });

  it("a sector erase through a mirrored bank erases the card's own sector (Memory.getBank)", () => {
    // --- A 512K chip in a 1M slot: bank $7F mirrors bank $5F, in the sector of banks $5C-$5F
    const m = createZ88TestSurface();
    m.memory.insertCard(1, m.cards.amdFlash29F040B());
    const sector = SLOT_BASE + 0x1c * 0x4000;
    m.directMemoryWrite(sector + 0x10, 0x00);
    m.directMemoryWrite(SLOT_BASE + 0x3c * 0x4000 + 0x10, 0x00); // past the card: not the chip's
    m.setSR3(0x7f);
    amdUnlock(m, 0x80);
    amdUnlock(m, 0x30);
    m.memory.readMemory(0xc000);
    m.memory.readMemory(0xc000);
    expect(m.directMemoryRead(sector + 0x10)).toBe(0xff);
    expect(m.directMemoryRead(SLOT_BASE + 0x3c * 0x4000 + 0x10)).toBe(0x00);
  });

  it("an Intel chip's ID is read from its bottom bank, also through a mirror, at offsets 0 and 1 only", () => {
    const m = createZ88TestSurface();
    m.memory.insertCard(1, m.cards.intelFlash(0x8_0000));
    m.setSR3(0x60); // mirrors bank $40, the card's bottom bank
    m.memory.writeMemory(0xc000, 0x90);
    expect([m.memory.readMemory(0xc000), m.memory.readMemory(0xc001)]).toEqual([0x89, 0xa7]);
    expect([m.memory.readMemory(0xe000), m.memory.readMemory(0xe001)]).toEqual([0xff, 0xff]);
  });

  it("peeking memory has no side effect: no empty-slot value is consumed, no flash command aborted", () => {
    const m = createZ88TestSurface();
    m.memory.removeCard(1);
    m.setSR1(0x40);
    const peeked = m.exports.z88PeekMemory(0x4000);
    expect(m.exports.z88PeekMemory(0x4000)).toBe(peeked);
    expect(m.memory.readMemory(0x4000)).toBe(peeked);

    m.memory.insertCard(3, m.cards.amdFlash29F040B());
    m.setSR3(0xc0);
    amdUnlock(m, 0x90);
    m.exports.z88PeekMemory(0xc000);
    // --- Autoselect is still active: a CPU read answers the manufacturer code
    expect(m.memory.readMemory(0xc000)).toBe(0x01);
  });
});
