import { describe, expect, it } from "vitest";

import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import { mapSpectrumSnapshotToKlive } from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import { MI_TIMEX } from "@common/machines/constants";
import { createTimexSession, type TimexTestSession } from "../harness/timex";
import { displayFileAddress, ink, paper } from "./_timex-helpers";

/*
 * TC2048 snapshots and state files (`.plans/TIMEX_SCORPION_PLAN.md` G9.4a Phase 4): `.szx` machine 8
 * with its SCLD block, `.z80` hardware mode 14 with port $FF in byte 36, `.sna` as a 48K with the
 * loss named, and the Klive state file (the core's memory image, port $FF included).
 */

/** A booted TC2048 in the 64-column mode with something on screen and a known register set */
async function timexInHires(): Promise<TimexTestSession> {
  const s = await createTimexSession();
  s.bootToBasic();
  s.poke(displayFileAddress(0, 0), 0xff).poke(displayFileAddress(0, 0) + 0x2000, 0x0f);
  s.out(0x00ff, 6 | (3 << 3)).out(0x00fe, 2).renderNow();
  return s;
}

describe("TC2048 snapshots", () => {
  for (const format of ["szx", "z80"] as const) {
    it(`a .${format} keeps the machine, port $FF, RAM and the CPU`, async () => {
      const s = await timexInHires();
      const pc = s.machine.pc;
      const { bytes, losses } = s.saveSnapshot(format);
      expect(losses.filter((l) => /Timex|\$FF/.test(l))).toEqual([]);

      const parsed = parseSpectrumSnapshot(`t.${format}`, bytes);
      expect(parsed.machine).toBe("tc2048");
      expect(parsed.timex).toEqual({ portF4: 0, portFf: 6 | (3 << 3) });
      expect(mapSpectrumSnapshotToKlive(parsed)).toMatchObject({ machineId: MI_TIMEX, modelIds: ["tc2048"], errors: [] });

      const t = await createTimexSession();
      t.loadSnapshot(`t.${format}`, bytes);
      expect(t.portFf).toBe(6 | (3 << 3));
      expect(t.machine.pc).toBe(pc);
      expect(t.peek(displayFileAddress(0, 0) + 0x2000)).toBe(0x0f);
      // --- The picture is drawn in the restored mode: magenta ink on green paper and border, BRIGHT
      expect(t.paperPixel(0, 0)).toBe(ink(3, true));
      expect(t.paperPixel(16, 0)).toBe(paper(4, true));
      expect(t.borderPixel()).toBe(paper(4, true));
      // --- And it runs on
      t.runFrames(5);
      expect(t.machine.isOsInitialized).toBe(true);
    });
  }

  it("a .sna loads as a 48K and names the screen mode it loses", async () => {
    const s = await timexInHires();
    const { bytes, losses } = s.saveSnapshot("sna");
    expect(losses.join("\n")).toMatch(/no Timex layout.*port \$FF/);
    expect(parseSpectrumSnapshot("t.sna", bytes).machine).toBe("48k");
  });

  it("refuses to take a 48K snapshot directly (the emulator switches machines first)", async () => {
    const z = await createTimexSession();
    z.bootToBasic();
    const snapshot = z.captureSnapshot();
    expect(snapshot.machine).toBe("tc2048");
    expect(() => z.machine.loadSnapshotState({ ...snapshot, machine: "48k" })).toThrow(/ZX Spectrum 48K/);
  });
});

describe("TC2048 state files", () => {
  it("restore port $FF, the Kempston state and RAM from the core's memory image", async () => {
    const s = await timexInHires();
    s.timex.setJoystickState("left", 0x11);
    const state = s.timex.saveMachineState();
    expect(state.coreId).toBe("timex");

    const t = await createTimexSession();
    t.bootToBasic();
    t.timex.loadMachineState(state);
    expect(t.portFf).toBe(6 | (3 << 3));
    expect(t.in(0x001f)).toBe(0x11);
    expect(t.peek(displayFileAddress(0, 0) + 0x2000)).toBe(0x0f);
    expect(t.machine.pc).toBe(s.machine.pc);
  });

  it("a 48K core's state does not load into the Timex core", async () => {
    const { createSp48Session } = await import("../harness/sp48");
    const z = await createSp48Session();
    z.bootToBasic();
    const t = await createTimexSession();
    expect(() => t.timex.loadMachineState(z.machine.saveMachineState())).toThrow();
  });
});
