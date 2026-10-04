import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { MC_Z88_INTRAM } from "@common/machines/constants";
import { CardIds } from "@emu/machines/z88/CardIds";
import { adjustZ88LostTime } from "@common/z88/z88Rtc";
import { parseZ88Snapshot, type Z88Snapshot } from "@common/z88/z88Snapshot";
import { mapZ88SnapshotToKlive } from "@common/z88/z88SnapshotMapping";
import { buildZ88AddressSpace, z88SnapshotBankReader } from "@common/z88/z88AddressSpace";
import { createZ88Session, z88Model, type Z88TestSession } from "../../harness/z88";
import { fitMachineConfig } from "@renderer/appEmu/machines/z88SnapshotLoad";

/*
 * Loading a `.z88` snapshot into the real Z88 core (`.plans/Z88_SNAPSHOT_PLAN.md` Phase 2). The
 * expected values come from the file itself: its `snapshot.settings` and its bank images.
 */

const SAMPLE = new Uint8Array(readFileSync(join(__dirname, "fixtures", "mm+jsw-oz5.z88")));
const SLOT = 0x10_0000;
const INTERNAL_RAM = 0x08_0000;
const FIVE_HOURS = 5 * 60 * 60 * 1000;

/** A session whose internal RAM fits the sample (128K) */
async function sampleSession(): Promise<Z88TestSession> {
  const model = z88Model();
  return createZ88Session({ config: { ...model.config, [MC_Z88_INTRAM]: 0x07 } });
}

/** The physical bytes from an absolute address */
function physBytes(s: Z88TestSession, start: number, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = s.physPeek(start + i);
  return bytes;
}

/** Lit LCD pixels: the picture is not blank */
function litPixels(s: Z88TestSession): number {
  const screen = s.screen();
  const first = screen[0];
  return screen.reduce((count, pixel) => count + (pixel !== first ? 1 : 0), 0);
}

describe("Z88 snapshot - loading into the machine", () => {
  it("restores every Z80 register", async () => {
    const s = await sampleSession();
    const { snapshot } = s.loadSnapshot(SAMPLE);
    const cpu = s.cpuState();
    const expected = snapshot.cpu;
    expect({
      af: cpu.af,
      bc: cpu.bc,
      de: cpu.de,
      hl: cpu.hl,
      af_: cpu.af_,
      bc_: cpu.bc_,
      de_: cpu.de_,
      hl_: cpu.hl_,
      ix: cpu.ix,
      iy: cpu.iy,
      pc: cpu.pc,
      sp: cpu.sp,
      i: cpu.ir >> 8,
      r: cpu.ir & 0xff,
      im: cpu.interruptMode,
      iff1: cpu.iff1,
      iff2: cpu.iff2
    }).toEqual(expected);
    expect(cpu.pc).toBe(0xf523);
    expect(cpu.halted).toBe(false);
  });

  it("restores the Blink, with EPR and the keyboard idle", async () => {
    const s = await sampleSession();
    s.keyDown("A");
    s.loadSnapshot(SAMPLE);
    const b = s.blinkState();
    expect([b.SR0, b.SR1, b.SR2, b.SR3]).toEqual([0x21, 0x22, 0xbe, 0xbf]);
    expect([b.TIM0, b.TIM1, b.TIM2, b.TIM3, b.TIM4]).toEqual([0x51, 0x29, 0x0c, 0x00, 0x00]);
    expect({ COM: b.COM, INT: b.INT, STA: b.STA, TMK: b.TMK, TSTA: b.TSTA, EPR: b.EPR }).toEqual({
      COM: 0x05,
      INT: 0x3b,
      STA: 0x05,
      TMK: 0x07,
      TSTA: 0x01,
      EPR: 0x00
    });
    expect([b.PB0, b.PB1, b.PB2, b.PB3, b.SBF]).toEqual([0x0434, 0x000d, 0x0043, 0x0019, 0x010f]);
    expect(b.keyLines.every((line) => line === 0)).toBe(true);
  });

  it("puts every image where its banks live", async () => {
    const s = await sampleSession();
    const { snapshot } = s.loadSnapshot(SAMPLE);
    expect(physBytes(s, 0, snapshot.rom.bytes.length)).toEqual(snapshot.rom.bytes);
    expect(physBytes(s, INTERNAL_RAM, snapshot.ram.length)).toEqual(snapshot.ram);
    expect(physBytes(s, 2 * SLOT, 0x8000)).toEqual(snapshot.slots[2]!.bytes);
    expect(physBytes(s, 3 * SLOT, 0x8000)).toEqual(snapshot.slots[3]!.bytes);
  });

  it("inserts the mapped cards: AMD Flash in slot 0, 32K EPROMs in slots 2 and 3", async () => {
    const s = await sampleSession();
    await s.plugCard(1, { cardType: CardIds.RAM128, size: 128 });
    s.loadSnapshot(SAMPLE);
    expect(s.insertedCards()).toEqual([
      { kind: "AMD_FLASH_29F040B", sizeInBytes: 0x08_0000 },
      undefined,
      { kind: "UV_EPROM", sizeInBytes: 0x8000 },
      { kind: "UV_EPROM", sizeInBytes: 0x8000 }
    ]);
  });

  it("a card plugged in later leaves the snapshot's cards, and what they hold, alone", async () => {
    // --- As the app loads one: the configuration records the snapshot's cards (no image file)
    const s = await sampleSession();
    const snapshot = parseZ88Snapshot(SAMPLE);
    const fit = fitMachineConfig({ machineId: "z88", config: s.machine.config }, mapZ88SnapshotToKlive(snapshot));
    s.machine.dynamicConfig = fit.config;
    s.loadSnapshot(SAMPLE);
    // --- Every card change once inserted all three slots again: the EPROMs came back blank ($FF)
    await s.plugCard(1, { cardType: CardIds.RAM128, size: 128 });
    expect(physBytes(s, 2 * SLOT, 0x8000)).toEqual(snapshot.slots[2]!.bytes);
    expect(physBytes(s, 3 * SLOT, 0x8000)).toEqual(snapshot.slots[3]!.bytes);
  });

  it("pages the 64K as the snapshot's SR0-SR3 and COM say (the viewer's builder agrees)", async () => {
    const s = await sampleSession();
    const { snapshot } = s.loadSnapshot(SAMPLE);
    const expected = buildZ88AddressSpace(
      z88SnapshotBankReader(snapshot),
      snapshot.blink.sr,
      snapshot.blink.com
    );
    expect(s.peekBytes(0x0000, 0x1_0000)).toEqual(expected);
  });

  it("advances the RTC by the time the file spent on disk", async () => {
    const s = await sampleSession();
    const snapshot = parseZ88Snapshot(SAMPLE);
    const { tim } = s.loadSnapshot(SAMPLE, snapshot.stoppedAt! + FIVE_HOURS);
    expect(tim).toEqual(adjustZ88LostTime(snapshot.blink.tim, snapshot.stoppedAt, snapshot.stoppedAt! + FIVE_HOURS));
    // --- 0C minutes + 5 h = 312 minutes: TIM3 = 1, TIM2 = 312 - 256 = 56 ($38)
    const b = s.blinkState();
    expect([b.TIM0, b.TIM1, b.TIM2, b.TIM3, b.TIM4]).toEqual([0x51, 0x29, 0x38, 0x01, 0x00]);
  });

  it("clears a HALT the machine was in", async () => {
    const s = await sampleSession();
    await s.loadCode(" halt");
    s.step(1);
    expect(s.registers().halted).toBe(true);
    s.loadSnapshot(SAMPLE);
    expect(s.registers().halted).toBe(false);
  });

  it("shows the snapshot's LCD before the first frame", async () => {
    // --- A debug session stops on PC before any instruction runs: the picture must be there already
    const s = await sampleSession();
    s.loadSnapshot(SAMPLE);
    expect(s.frames).toBe(0);
    expect(litPixels(s)).toBeGreaterThan(1000);
  });

  it("runs from the restored state and draws the LCD", async () => {
    const s = await sampleSession();
    s.loadSnapshot(SAMPLE);
    s.runFrames(50);
    expect(s.frames).toBe(50);
    expect(litPixels(s)).toBeGreaterThan(0);
  });

  it("is deterministic: two loads run to the same state", async () => {
    const run = async () => {
      const s = await sampleSession();
      s.loadSnapshot(SAMPLE);
      s.runFrames(40);
      return { cpu: s.cpuState(), screen: Array.from(s.screen()) };
    };
    const first = await run();
    const second = await run();
    expect(second.cpu.pc).toBe(first.cpu.pc);
    expect(second.cpu.tacts).toBe(first.cpu.tacts);
    expect(second.screen).toEqual(first.screen);
  });

  it("loads over a machine that already ran another snapshot", async () => {
    const s = await sampleSession();
    s.loadSnapshot(SAMPLE);
    s.runFrames(30);
    s.loadSnapshot(SAMPLE);
    expect(s.cpuState().pc).toBe(0xf523);
    expect(s.blinkState().SR2).toBe(0xbe);
  });

  it("refuses a mapping with errors", async () => {
    const s = await sampleSession();
    const snapshot = parseZ88Snapshot(SAMPLE);
    const mapping = mapZ88SnapshotToKlive(snapshot);
    mapping.errors.push("Slot 3 holds a hybrid card");
    // --- The machine's own guard: the session's loadSnapshot cannot produce an erroneous mapping
    expect(() => s.machine.loadSnapshotState(snapshot, mapping, Date.now())).toThrow(
      /cannot be loaded: Slot 3 holds a hybrid card/
    );
  });

  it("refuses a snapshot whose internal RAM differs from the machine's", async () => {
    const s = await createZ88Session(); // --- 512K internal RAM
    expect(() => s.loadSnapshot(SAMPLE)).toThrow(/128K internal RAM, the machine 512K/);
  });
});

describe("Z88 snapshot - mapping the LCD size", () => {
  const sample: Z88Snapshot = parseZ88Snapshot(SAMPLE);
  const withLcd = (scw: number, sch: number): Z88Snapshot => ({
    ...sample,
    blink: { ...sample.blink, scw, sch }
  });

  it.each([
    [0x50, 8, "640x64"],
    [0x50, 32, "640x256"],
    [0x50, 40, "640x320"],
    [0x50, 60, "640x480"]
  ])("maps SCW=%i SCH=%i to %s", (scw, sch, screenSize) => {
    const mapping = mapZ88SnapshotToKlive(withLcd(scw, sch));
    expect(mapping.screenSize).toBe(screenSize);
    expect(mapping.warnings).toEqual([]);
  });

  it("keeps the current LCD for a size Klive has not, with a warning", () => {
    const mapping = mapZ88SnapshotToKlive(withLcd(0xa0, 16));
    expect(mapping.screenSize).toBeUndefined();
    expect(mapping.errors).toEqual([]);
    expect(mapping.warnings).toEqual(["The 1280x128 LCD is not supported; the current LCD size is kept"]);
  });
});
