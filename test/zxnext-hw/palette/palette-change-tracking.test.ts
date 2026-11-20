import { describe, expect, it } from "vitest";

import type { NextTestSession } from "../../harness/zxnext";
import { parkedSession } from "../ula/_ula-helpers";

/*
 * The palette's change tracking (`dev/plans/NEXT_PALETTE_DEBUGGING_PLAN.md` §5, Phase 1): not hardware
 * behaviour but what the IDE reads to decide whether a palette panel must re-read 2048 entries, and
 * which entries the program wrote since the last stop.
 *
 * - `version` changes with every stored entry, a live-bank or ULANext flip ($43 bits 0-3, $6B bit 4),
 *   a reset, a state restore and a clearing of the written marks that had any mark to clear.
 * - `written` marks every stored entry (a write, not a change of colour) until a run starts.
 *
 * Slots are the `$43` bits 6-4 order: 0 ULA 1, 1 Layer 2 1, 2 sprites 1, 3 tilemap 1, 4-7 the second banks.
 */

const palette = (s: NextTestSession) => s.ideState().palette;
const version = (s: NextTestSession) => palette(s).version!;

/** The written entries as "slot:index" strings, in order. */
function written(s: NextTestSession): string[] {
  const bytes = palette(s).written!;
  const out: string[] = [];
  for (let slot = 0; slot < 8; slot++) {
    for (let index = 0; index < 256; index++) {
      if (bytes[slot * 32 + (index >> 3)] & (1 << (index & 7))) {
        out.push(`${slot}:$${index.toString(16).padStart(2, "0")}`);
      }
    }
  }
  return out;
}

/** A parked machine with no marks left from the boot */
async function cleanSession(): Promise<NextTestSession> {
  const s = await parkedSession();
  s.beginRun();
  expect(written(s)).toEqual([]);
  return s;
}

describe("palette change tracking", () => {
  it("reports a version and 256 bytes of written marks", async () => {
    const s = await cleanSession();
    expect(typeof version(s)).toBe("number");
    expect(palette(s).written).toHaveLength(256);
  });

  it("a $41 write changes the version and marks that entry in the selected bank only", async () => {
    const s = await cleanSession();
    const before = version(s);
    // --- $43 bits 6-4 = 010: the first sprite palette
    s.setNextReg(0x43, 0x20).setNextReg(0x40, 0x03).setNextReg(0x41, 0xe0);
    expect(version(s)).not.toBe(before);
    expect(written(s)).toEqual(["2:$03"]);
  });

  it("a $44 pair marks on the second byte; the first byte stores nothing", async () => {
    const s = await cleanSession();
    s.setNextReg(0x43, 0x50).setNextReg(0x40, 0x1f); // --- 101: the second Layer 2 palette
    const before = version(s);
    s.setNextReg(0x44, 0x12);
    expect(version(s), "after the first byte").toBe(before);
    expect(written(s)).toEqual([]);
    s.setNextReg(0x44, 0x81);
    expect(version(s), "after the second byte").not.toBe(before);
    expect(written(s)).toEqual(["5:$1f"]);
  });

  it("marks a write that stores the colour already there: a write, not a change", async () => {
    const s = await cleanSession();
    s.setNextReg(0x43, 0x00).setNextReg(0x40, 0x07);
    const same = s.readNextReg(0x41);
    const before = version(s);
    s.setNextReg(0x40, 0x07).setNextReg(0x41, same);
    expect(version(s)).not.toBe(before);
    expect(written(s)).toEqual(["0:$07"]);
  });

  it("an autoincrementing upload marks every entry it wrote", async () => {
    const s = await cleanSession();
    s.setNextReg(0x43, 0x30).setNextReg(0x40, 0xfe); // --- 011: the first tilemap palette
    for (const v of [1, 2, 3, 4]) s.setNextReg(0x41, v);
    expect(written(s)).toEqual(["3:$00", "3:$01", "3:$fe", "3:$ff"]);
  });

  it("a ULA+ data port write marks the ULA entry $C0 + index", async () => {
    const s = await cleanSession();
    s.setNextReg(0x43, 0x00);
    s.out(0xbf3b, 0x05).out(0xff3b, 0x1c); // --- palette group, index 5
    expect(written(s)).toEqual(["0:$c5"]);
  });

  it("a live-bank flip changes the version without marking an entry", async () => {
    const s = await cleanSession();
    s.setNextReg(0x43, 0x00);
    let before = version(s);
    s.setNextReg(0x43, 0x04); // --- Layer 2 draws with its second bank
    expect(version(s), "$43 bit 2").not.toBe(before);
    before = version(s);
    s.setNextReg(0x6b, s.nextRegValue(0x6b) ^ 0x10); // --- the tilemap's bank
    expect(version(s), "$6B bit 4").not.toBe(before);
    expect(written(s)).toEqual([]);
  });

  it("selecting a bank to write leaves the version alone: the picture does not change", async () => {
    const s = await cleanSession();
    s.setNextReg(0x43, 0x00);
    const before = version(s);
    s.setNextReg(0x43, 0x70).setNextReg(0x40, 0x10);
    expect(version(s)).toBe(before);
  });

  it("running code that touches no palette leaves the version alone", async () => {
    const s = await cleanSession();
    const before = version(s);
    s.runFrames(3);
    expect(version(s)).toBe(before);
  });

  it("a run start clears the marks, and changes the version only when there was a mark", async () => {
    const s = await cleanSession();
    let before = version(s);
    s.beginRun();
    expect(version(s), "nothing to clear").toBe(before);

    s.setNextReg(0x43, 0x00).setNextReg(0x40, 0x00).setNextReg(0x41, 0xff);
    before = version(s);
    s.beginRun();
    expect(written(s)).toEqual([]);
    expect(version(s), "marks cleared").not.toBe(before);
  });

  it("a checkpoint restore changes the version even at the same write count, and drops the marks", async () => {
    const s = await cleanSession();
    s.captureCheckpoint("before");
    const atCapture = version(s);
    s.restoreCheckpoint("before");
    expect(version(s), "the same write count").not.toBe(atCapture);

    s.setNextReg(0x43, 0x00).setNextReg(0x40, 0x01).setNextReg(0x41, 0x55);
    s.restoreCheckpoint("before");
    expect(written(s)).toEqual([]);
  });
});
