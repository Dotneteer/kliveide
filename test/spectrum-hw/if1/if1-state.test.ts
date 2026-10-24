import { describe, expect, it } from "vitest";

import { formattedMdr, installProgram, runBasic, screenLines, sp48WithInterface1 } from "./if1TestSupport";

/*
 * The Interface 1 across the core's own bookkeeping (`.plans/MICRODRIVE_PLAN.md` Phase 2.7-2.8):
 * the stubbed RS232, the tact counter's rebase with a drive running (every absolute tact the device
 * keeps moves with it), and a Klive state taken mid-transfer.
 */

describe("Interface 1 stubs", () => {
  it("RS232: a byte sent completes (the far end is always ready); a byte read finds none", async () => {
    const s = await sp48WithInterface1();
    runBasic(s, `10 OPEN #4;"b": PRINT #4;"x": LET a$=INKEY$#4: CLOSE #4: PRINT LEN a$`, 150);
    expect(screenLines(s)).toEqual(["0", "0 OK, 10:5"]);
  }, 60_000);
});

describe("Interface 1 and the machine's state", () => {
  it("the tact counter's rebase mid-CAT changes nothing", async () => {
    const run = async (rebase: boolean) => {
      const s = (await sp48WithInterface1()).insertCartridge(0, formattedMdr());
      runBasic(s, `10 CAT 1`, 40);
      expect(s.interface1().select).toBe(1);
      if (rebase) {
        for (let i = 0; i < 5; i++) s.testAdvanceTacts(0x30000000).runFrames(20);
      } else {
        s.runFrames(100);
      }
      s.runFrames(700);
      return screenLines(s);
    };
    const plain = await run(false);
    expect(plain).toEqual(["TEST", "127", "0 OK, 10:1"]);
    expect(await run(true)).toEqual(plain);
  }, 120_000);

  it("a state saved mid-SAVE * restores the transfer exactly", async () => {
    const s = (await sp48WithInterface1()).insertCartridge(0, formattedMdr());
    runBasic(s, `10 SAVE *"m";1;"screen" SCREEN$`, 120);
    expect(s.interface1().select).toBe(1);
    const state = s.saveState();
    s.runFrames(600);
    const first = { screen: screenLines(s), mdr: s.cartridge(0)!, tacts: s.tacts() };
    expect(first.screen.at(-1)).toBe("0 OK, 10:1");

    s.loadState(state);
    s.runFrames(600);
    expect(screenLines(s)).toEqual(first.screen);
    expect(s.cartridge(0)).toEqual(first.mdr);
    expect(s.tacts()).toBe(first.tacts);
  }, 120_000);
});

describe("Interface 1 in snapshots (`.plans/MICRODRIVE_PLAN.md` Phase 5)", () => {
  it.each(["szx", "z80"] as const)("a .%s taken with the ROM paged in comes back paged in", async (format) => {
    const s = (await sp48WithInterface1()).insertCartridge(0, formattedMdr());
    runBasic(s, `10 CAT 1`, 40);
    expect(s.interface1().paged).toBe(true);
    const captured = s.captureSnapshot();
    expect(captured.peripherals.if1).toMatchObject({ paged: true, drives: 2 });
    expect(captured.peripherals.if1?.microdrives).toEqual([
      expect.objectContaining({ drive: 0, running: true, fileName: undefined })
    ]);
    // --- The shipped ROM is the standard one: nothing to embed
    expect(captured.peripherals.if1?.customRom).toBeUndefined();
    const { bytes } = s.saveSnapshot(format);

    const target = await sp48WithInterface1();
    expect(target.interface1().paged).toBe(false);
    target.loadSnapshot(`x.${format}`, bytes);
    expect(target.interface1().paged).toBe(true);
    expect(target.machine.pc).toBe(captured.cpu.pc);
  }, 120_000);

  it("a capture with the ROM paged out says so, with no cartridge", async () => {
    const s = await sp48WithInterface1();
    s.runFrames(10);
    expect(s.captureSnapshot().peripherals.if1).toMatchObject({ paged: false, microdrives: [] });
  }, 60_000);
});

describe("Interface 1 in RZX recordings (`.plans/MICRODRIVE_PLAN.md` Phase 5)", () => {
  it("a CAT recorded with a cartridge plays back to the same screen without one", async () => {
    const s = (await sp48WithInterface1()).insertCartridge(0, formattedMdr());
    // --- The program goes into memory before the recording, which sees only what the CPU does
    installProgram(s, `10 CAT 1`);
    // --- A frame can end between a prefix and its opcode, where no snapshot can start: try the next
    for (let attempt = 0; ; attempt++) {
      s.runFrames(1);
      try {
        s.startRzxRecording({ autosaveFrames: 0 });
        break;
      } catch (err) {
        if (attempt > 20) throw err;
      }
    }
    s.typeKeys([["R"], ["Enter"]]);
    s.runFrames(800);
    const recorded = screenLines(s);
    expect(recorded).toEqual(["TEST", "127", "0 OK, 10:1"]);
    const rzxFile = s.stopRzxRecording();

    // --- Playback reads the ports from the recording: the drives rest, no cartridge is needed
    const p = await sp48WithInterface1();
    p.playRzx(rzxFile);
    const stop = p.runRzx({ maxFrames: 2000 });
    expect(stop, stop.message).toMatchObject({ kind: "ended" });
    expect(screenLines(p)).toEqual(recorded);
  }, 180_000);
});
