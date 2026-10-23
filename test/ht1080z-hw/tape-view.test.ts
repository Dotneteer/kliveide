import { describe, expect, it } from "vitest";

import { analyzeHt1080zFile } from "@renderer/appIde/DocumentPanels/Ht1080zTape/ht1080zTapeView";
import { basToBasicTape } from "@emu/machines/ht1080z/Ht1080zTapeFile";
import { createHtSession, Ht1080zTestSession } from "../harness/ht1080z";

/*
 * The tape viewer's model against the machine (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` Phase 2): a tape
 * the ROM saved with CSAVE reads as its program, and the play time the viewer shows is how long the
 * core's tape player takes to play the tape.
 */

describe("HT-1080Z tape viewer model on the machine", () => {
  it("reads a tape the ROM wrote with CSAVE", async () => {
    const s = (await createHtSession()).bootToPrompt();
    s.typeKeys("10 FOR I=1 TO 3\n20 PRINT I*7\n30 NEXT I\n");
    s.typeKeys('CSAVE "A"\n', { settle: 0 });
    s.runUntil(() => s.machine.getMachineProperty("SavedToTape") !== undefined, { maxFrames: 3000 }, "the save");
    const saved = s.takeSavedTape()!.contents;
    const { analysis } = analyzeHt1080zFile(saved, "A.cas");
    expect(analysis).toMatchObject({ kind: "basicTape", name: "A", hasProblems: false });
    expect(analysis!.lines!.map((l) => l.lineNo)).toEqual([10, 20, 30]);
  });

  it("plays a tape in the time the viewer shows", async () => {
    const tape = basToBasicTape(
      Uint8Array.from([0xff, 0xf2, 0x42, 0x0a, 0x00, 0xb2, 0x20, 0x34, 0x32, 0x00, 0x00, 0x00]),
      "P"
    );
    const { analysis } = analyzeHt1080zFile(tape, "p.cas");
    const s = (await createHtSession()).bootToPrompt();
    s.insertTape(Ht1080zTestSession.tape(tape, "p.cas"), { fastLoad: false });
    // --- 6000h: LD A,4 / OUT (FFh),A / JR $ - the relay on, so the motor runs and the tape plays
    s.poke(0x6000, [0x3e, 0x04, 0xd3, 0xff, 0x18, 0xfe]);
    s.machine.pc = 0x6000;
    s.step(2);
    const w = s.machine.wasmV2Runtime!.exports;
    expect(w.ht1080zTapeGetBitPosition()).toBe(0);
    const start = s.machine.tacts;
    s.runUntil(() => w.ht1080zTapeGetBitPosition() >= w.ht1080zTapeGetLengthBits(), { maxFrames: 2000 }, "the tape's end");
    // --- Frames run to their end: step back to within one frame of the tape's last cell
    const playedMs = ((s.machine.tacts - start) * 1000) / s.machine.baseClockFrequency;
    const frameMs = (s.machine.tactsInFrame * 1000) / s.machine.baseClockFrequency;
    expect(playedMs).toBeGreaterThanOrEqual(analysis!.playMs - 1);
    expect(playedMs).toBeLessThan(analysis!.playMs + frameMs + 1);
  });
});
