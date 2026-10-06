import { describe, expect, it } from "vitest";

import {
  renderTilemapImage,
  TILE_TRANSPARENT,
  tilemapMode,
  type TilemapImage
} from "@common/zxnext/tilemap/tilemapDecode";
import type { NextTilemapState } from "@common/messaging/EmuApi";
import { type NextTestSession } from "../../harness/zxnext";
import { hex8 } from "../ula/_ula-helpers";
import { control6B, randomBank5, TM_DEFAULT, tilemapIndex, tilemapScreen, type TM } from "./_tilemap-helpers";

/*
 * What the Tilemap Inspector reads (`.plans/TILEMAP_INSPECTOR_PLAN.md` Phase 2, D3): the snapshot is
 * the registers a program wrote and the bytes it stored; the image `tilemapDecode` makes from that
 * snapshot equals both the VHDL-derived model in `_tilemap-helpers.ts` and the core's rendered
 * tilemap pixels; reading never changes the machine.
 */

const BANK = randomBank5(5);
const NONE = hex8(0xe3);

function apply(s: NextTestSession, p: TM, onTop = false, palette2 = false): NextTestSession {
  s.setNextReg(0x6e, p.mapBase).setNextReg(0x6f, p.tileBase).setNextReg(0x6c, p.defaultAttr).setNextReg(0x4c, p.transparentIndex);
  s.setNextReg(0x2f, p.sx >> 8).setNextReg(0x30, p.sx & 0xff).setNextReg(0x31, p.sy);
  s.setNextReg(0x1c, 0x08).setNextReg(0x1b, p.clip[0]).setNextReg(0x1b, p.clip[1]).setNextReg(0x1b, p.clip[2]).setNextReg(0x1b, p.clip[3]);
  return s.setNextReg(0x6b, control6B(p, onTop, palette2));
}

/** The decoded *As displayed* image of a snapshot. */
function decodeImage(state: NextTilemapState): TilemapImage {
  const mode = tilemapMode(state.regs);
  return renderTilemapImage(mode, state.regs, state, { asDisplayed: true });
}

/** Pixels where the decode differs from the model (at most 8). */
function modelMismatches(image: TilemapImage, p: TM): string[] {
  const bad: string[] = [];
  for (let y = 0; y < 256 && bad.length < 8; y++) {
    for (let x = 0; x < image.width && bad.length < 8; x++) {
      const want = tilemapIndex(BANK, p, x, y);
      const got = image.pixels[y * image.width + x];
      if (got !== want) bad.push(`(${x},${y}): decode ${got} != model ${want}`);
    }
  }
  return bad;
}

/** Pixels where the core's picture differs from the decode (at most 8). */
function coreMismatches(s: NextTestSession, image: TilemapImage): string[] {
  const bad: string[] = [];
  const w = image.width === 640 ? 1 : 2;
  for (let y = 0; y < 256 && bad.length < 8; y++) {
    for (let x = 0; x < image.width && bad.length < 8; x++) {
      const index = image.pixels[y * image.width + x];
      const want = index === TILE_TRANSPARENT ? NONE : hex8(index);
      const got = s.pixel(32 + x * w, 16 + y);
      if (got !== want) bad.push(`(${x},${y}): core ${got} != decode ${want}`);
    }
  }
  return bad;
}

const CONFIGS: [string, TM][] = [
  ["TM-001: 40x32 with attributes, reset bases", TM_DEFAULT],
  ["TM-002: 80x32", { ...TM_DEFAULT, cols80: true }],
  ["TM-004: attribute-less, $6C = $5A", { ...TM_DEFAULT, noAttr: true, defaultAttr: 0x5a }],
  ["TM-004: attribute-less at 80 columns", { ...TM_DEFAULT, noAttr: true, cols80: true, defaultAttr: 0xa1 }],
  ["TM-010: 512 tiles", { ...TM_DEFAULT, mode512: true }],
  ["TM-011: text mode, 40 columns, scrolled", { ...TM_DEFAULT, text: true, sx: 13, sy: 77 }],
  ["TM-011: text mode, 80 columns, scrolled", { ...TM_DEFAULT, text: true, cols80: true, sx: 601, sy: 5 }],
  ["TM-012: scroll X and Y", { ...TM_DEFAULT, sx: 300, sy: 250 }],
  ["TM-013: transparency index $3", { ...TM_DEFAULT, transparentIndex: 0x03 }],
  ["TM-016: clip window at 40 columns", { ...TM_DEFAULT, clip: [10, 100, 20, 200] }],
  ["TM-016: clip window at 80 columns, scrolled", { ...TM_DEFAULT, cols80: true, sx: 500, clip: [3, 150, 7, 240] }],
  ["TM-018: other bases", { ...TM_DEFAULT, mapBase: 0x10, tileBase: 0x30 }]
];

describe("Tilemap Inspector state", () => {
  for (const [name, p] of CONFIGS) {
    it(`D3: ${name} - the decode equals the model and the core`, async () => {
      const s = apply(await tilemapScreen(BANK), p).runFrames(2);
      const state = s.tilemapState();
      expect(Array.from(state.bank5)).toEqual(Array.from(BANK));
      const image = decodeImage(state);
      expect(modelMismatches(image, p)).toEqual([]);
      expect(coreMismatches(s, image)).toEqual([]);
    });
  }

  it("D3: bank 7, with the 8K wrap - the decode equals the core", async () => {
    const page = randomBank5(71).slice(0, 0x2000);
    const s = await tilemapScreen(BANK);
    s.setNextReg(0x56, 0x0e).poke(0xc000, page).setNextReg(0x56, 0x00);
    apply(s, { ...TM_DEFAULT, cols80: true, mapBase: 0x1c, tileBase: 0x08 });
    s.setNextReg(0x6e, 0x80 | 0x1c).setNextReg(0x6f, 0x80 | 0x08).runFrames(2);
    const state = s.tilemapState();
    expect(state.regs).toMatchObject({ mapBank7: true, mapMsb: 0x1c, defBank7: true, defMsb: 0x08 });
    expect(Array.from(state.bank7.slice(0, 0x2000))).toEqual(Array.from(page));
    expect(coreMismatches(s, decodeImage(state))).toEqual([]);
  });

  it("reads back every register a program wrote", async () => {
    const s = await tilemapScreen(BANK);
    apply(s, { ...TM_DEFAULT, noAttr: true, defaultAttr: 0x5a, transparentIndex: 3, sx: 0x2c5, sy: 9, clip: [1, 2, 3, 4], mapBase: 0x11, tileBase: 0x22 }, true, true);
    s.setNextReg(0x1b, 7); // --- one more write: the next one sets x2
    const { regs, copperRunning } = s.tilemapState();
    expect(regs).toEqual({
      enabled: true,
      control: 0x80 | 0x20 | 0x10 | 0x01,
      defaultAttr: 0x5a,
      mapBank7: false,
      mapMsb: 0x11,
      defBank7: false,
      defMsb: 0x22,
      scrollX: 0x2c5,
      scrollY: 9,
      transparencyIndex: 3,
      globalTransparency: 0xe3,
      clip: [7, 2, 3, 4],
      clipIndex: 1,
      ulaDisabled: true
    });
    expect(copperRunning).toBe(false);
  });

  it("T1: knows which physical page each Z80 slot reads", async () => {
    const s = await tilemapScreen(BANK);
    const { slotOffsets } = s.tilemapState();
    // --- default paging: bank 5 at $4000, so slot 2 reads physical $054000
    expect(slotOffsets[2]).toBe(0x054000);
    expect(slotOffsets[3]).toBe(0x056000);
  });

  it("D8: two reads in a row are identical, and reading does not change the state image", async () => {
    const s = apply(await tilemapScreen(BANK), { ...TM_DEFAULT, sx: 3 }).runFrames(1);
    const before = s.machine.saveMachineState().image;
    const a = s.tilemapState();
    const b = s.tilemapState();
    const after = s.machine.saveMachineState().image;
    expect(b).toEqual(a);
    expect(Buffer.compare(Buffer.from(before), Buffer.from(after))).toBe(0);
  });
});
