import { describe, expect, it } from "vitest";

import { createSamSession } from "../harness/samcoupe";
import { SamKeyCode } from "@emu/machines/samcoupe/SamKeyCode";
import { samDecodeSavedEdges, samTapeFromBlocks } from "@emu/machines/samcoupe/SamTapeFile";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";

/*
 * The tape (plan §9.4; SOUND_INPUT_IO.md §5): the ROM's SAVE recorded from MIC and decoded, then loaded
 * back by the ROM from EAR, at its default speed, with the deck starting itself.
 */

describe("SAM tape", () => {
  it("SAVE ... CODE to tape and LOAD it back", async () => {
    const s = await createSamSession();
    s.bootToBasic();
    for (let i = 0; i < 100; i++) s.pokePage(1, i, (i * 13 + 5) & 0xff);
    s.machine.recordTape(true);
    s.typeKeys('SAVE "klive" CODE 32768,100\n', { settle: 30 });
    // --- "Start tape, then press any key"
    s.pressKey(SamKeyCode.Space);
    s.runFrames(800);
    const length = s.wasm.samTapeGetSavedLength();
    expect(length).toBeGreaterThan(1000);
    const runtime = s.machine.wasmV2Runtime!;
    const blocks = samDecodeSavedEdges(runtime.savedEdges.subarray(0, length));
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    // --- The data block: its flag, the 100 bytes, its checksum
    const data = blocks[blocks.length - 1];
    expect(data.length).toBeGreaterThanOrEqual(100);

    const t = await createSamSession();
    const tapeBlocks = blocks.map((bytes) => {
      const block = new TapeDataBlock();
      block.data = bytes;
      return block;
    });
    t.insertTape(samTapeFromBlocks(tapeBlocks));
    t.bootToBasic();
    t.typeKeys('LOAD "" CODE\n', { settle: 10 });
    t.runFrames(1500);
    const loaded = Array.from({ length: 100 }, (_, i) => t.page(1, i));
    expect(loaded).toEqual(Array.from({ length: 100 }, (_, i) => (i * 13 + 5) & 0xff));
  }, 120_000);
});
