import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BinaryReader } from "@common/utils/BinaryReader";
import { TapReader } from "@emu/machines/tape/TapReader";
import { sp48TapeLoadFlow } from "@emu/machines/tapeLoadFlows";
import { createSp48Session } from "../harness/sp48";

/*
 * "Load and run" on a 48K (`.plans/TAPE_VIEWER_PLAN.md` §4.6), on the real machine: the keystrokes
 * `sp48TapeLoadFlow` queues, typed into the real ROM's editor, load a real tape. The command and
 * the IDE side are covered by `test/commands/TapeLoadCommand.test.ts`.
 */

const FLOAT_SPY = new Uint8Array(readFileSync(join(__dirname, "../testfiles/floatspy.tap")));

function tapBlocks(bytes: Uint8Array) {
  const reader = new TapReader(new BinaryReader(bytes));
  expect(reader.readContent()).toBeNull();
  return reader.dataBlocks;
}

describe("tape load flow on the 48K", () => {
  it('types LOAD "", and the ROM loads and autostarts the program', async () => {
    const blocks = tapBlocks(FLOAT_SPY);
    const program = blocks[1].data.subarray(1, blocks[1].data.length - 1);

    const s = await createSp48Session();
    s.bootToBasic();
    s.insertTape(blocks);
    // --- The ROM takes a repeat of a key only once it has been up for ~5 interrupts; the flow's
    // --- 250 ms between keys gives the IDE that, and an 8-frame gap gives it here (the two quotes)
    s.typeFlowKeys(sp48TapeLoadFlow(), { gap: 8 });

    const prog = s.peekWord(0x5c53);
    let loaded = false;
    for (let frame = 0; frame < 3000 && !loaded; frame += 10) {
      s.runFrames(10);
      loaded = Array.from(program.subarray(0, 64)).every((b, i) => s.peek(prog + i) === b);
    }
    expect(loaded).toBe(true);

    // --- The program autostarts, loads its code block from the same tape, and runs it
    s.runFrames(300);
    expect(s.screenLine(8)).toContain("FLOATING BUS test program");
    expect(s.screenLine(12)).toContain("ULA TYPE: 48K");
  }, 60_000);
});
