import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { CodeToInject } from "@abstractions/CodeToInject";
import { BinaryReader } from "@common/utils/BinaryReader";
import { TapReader } from "@emu/machines/tape/TapReader";
import { p3ModelRomSet, type P3ModelId } from "@emu/machines/zxSpectrumP3e/p3RomSets";
import { createSp128Session, type Sp128TestSession } from "../harness/sp128";

/*
 * The +2A/+3 with the Amstrad ROMs (`.plans/PLUS3_AMSTRAD_ROMS_PLAN.md` Phase 2), on the real core
 * and the real ROMs: every ROM set's row of `p3RomSets.ts` is checked by running the IDE's own
 * flows. The flows are played without the ROM check, as the IDE plays them (the core stops on the
 * PC alone), and the ROM is asserted afterwards: an address that a boot passed first in another ROM
 * would stop the flow there.
 */

const TESTFILES = join(__dirname, "../testfiles");
const FLOAT_SPY = new Uint8Array(readFileSync(join(TESTFILES, "floatspy.tap")));
const LTK_DSK = new Uint8Array(readFileSync(join(TESTFILES, "ltk.dsk")));

/** One model of each ROM set (+3 models), and the drive-less +2As */
const MODELS: { model: P3ModelId; banner: string; loader: string; amstrad: boolean }[] = [
  { model: "fdd1", banner: "128 +3e", loader: "Loader", amstrad: false },
  { model: "plus3-v40-fdd1", banner: "128 +3", loader: "Loader", amstrad: true },
  { model: "plus3-fdd1", banner: "128 +3", loader: "Loader", amstrad: true },
  { model: "plus3-es-fdd1", banner: "128 +3", loader: "Cargador", amstrad: true },
  { model: "plus2a", banner: "128 +2A", loader: "Loader", amstrad: true },
  { model: "plus2a-es", banner: "128 +2A", loader: "Cargador", amstrad: true }
];

/** LD A,$42 / LD ($9000),A / RET at $8000, called as a subroutine */
function program(model: "sp48" | "spp3e"): CodeToInject {
  return {
    model,
    subroutine: true,
    entryAddress: 0x8000,
    segments: [{ startAddress: 0x8000, bankOffset: 0, emittedCode: [0x3e, 0x42, 0x32, 0x00, 0x90, 0xc9] }],
    options: { noCls: true }
  };
}

function tapBlocks(bytes: Uint8Array) {
  const reader = new TapReader(new BinaryReader(bytes));
  expect(reader.readContent()).toBeNull();
  return reader.dataBlocks;
}

const nonBlank = (s: Sp128TestSession) => s.screenText().split("\n").filter((l) => l.trim());

describe.each(MODELS)("$model", ({ model, banner, loader, amstrad }) => {
  const rom = p3ModelRomSet(model);

  it("boots to its start-up menu at the table's menu address, in ROM 0", async () => {
    const s = await createSp128Session(model);
    s.runTo(rom.mainWaitingLoop, { maxFrames: 600 });
    expect(s.paging().rom).toBe(0);
    s.runFrames(5);
    const text = s.screenText();
    expect(text).toContain(banner);
    expect(text).toContain(loader);
    expect(text).toContain("+3 BASIC");
    expect(text).toContain("48 BASIC");
    expect(text).toContain("1982, 1986, 1987 Amstrad Plc.");
    expect(text.includes("Garry Lancaster")).toBe(!amstrad);
  }, 60_000);

  it("injects into +3 BASIC; the program returns to a working editor", async () => {
    const s = await createSp128Session(model);
    const flow = await s.machine.getCodeInjectionFlow("spp3e");
    s.runFlow(flow, { code: program("spp3e"), checkRom: false });
    expect(s.cpu().pc).toBe(0x8000);
    s.runTo(rom.returnToEditor, { maxFrames: 5 });
    expect(s.paging().rom).toBe(0);
    expect(s.peek(0x9000)).toBe(0x42);
    s.runFrames(30).typeText("PRINT 42\n").runFrames(30);
    expect(nonBlank(s)).toEqual(expect.arrayContaining(["42", "0 OK, 0:1"]));
  }, 60_000);

  it("injects into 48 BASIC; the program returns to its main loop in ROM 3", async () => {
    const s = await createSp128Session(model);
    const flow = await s.machine.getCodeInjectionFlow("sp48");
    s.runFlow(flow, { code: program("sp48"), checkRom: false });
    expect(s.cpu().pc).toBe(0x8000);
    expect(s.paging().rom).toBe(3);
    s.runTo(rom.sp48MainEntry, { maxFrames: 5 });
    expect(s.peek(0x9000)).toBe(0x42);
    expect(s.paging().rom).toBe(3);
  }, 60_000);

  it("Loader loads a tape (no disk in drive A)", async () => {
    const s = await createSp128Session(model);
    s.insertTape(tapBlocks(FLOAT_SPY));
    s.runFlow(s.machine.getTapeLoadFlow!(), { checkRom: false });
    for (let frame = 0; frame < 3000 && !s.screenText().includes("ULA TYPE"); frame += 25) {
      s.runFrames(25);
    }
    expect(s.screenText()).toContain("FLOATING BUS test program");
  }, 120_000);
});

describe("ROM pages", () => {
  it.each(["plus3-fdd1", "plus3-v40-fdd2", "plus2a-es", "nofdd"] as const)(
    "%s holds its set's four pages, and a hard reset replays them",
    async (model) => {
      const s = await createSp128Session(model);
      const romId = p3ModelRomSet(model).romId;
      const expectPages = () => {
        for (let page = 0; page < 4; page++) {
          const file = new Uint8Array(readFileSync(join(__dirname, `../../src/public/roms/${romId}-${page}.rom`)));
          expect(Buffer.from(s.machine.getMemoryPartition(-1 - page)).equals(Buffer.from(file)), `${romId}-${page}`).toBe(true);
        }
      };
      expectPages();
      s.runFrames(50);
      s.machine.hardReset();
      expectPages();
    },
    60_000
  );
});

describe.each(MODELS.filter((m) => m.model !== "plus2a" && m.model !== "plus2a-es"))(
  "$model with a disk",
  ({ model }) => {
    it("CAT lists the disk in drive A (+3DOS in ROM 2 driving Klive's FDC)", async () => {
      const s = await createSp128Session(model);
      s.insertDisk(0, LTK_DSK);
      const flow = await s.machine.getCodeInjectionFlow("spp3e");
      s.runFlow(flow, { checkRom: false });
      s.machine.pc = p3ModelRomSet(model).returnToEditor;
      s.runFrames(30).typeText("CAT\n");
      for (let frame = 0; frame < 1500 && !s.screenText().includes("0 OK"); frame += 25) {
        s.runFrames(25);
      }
      // --- ltk.dsk's one visible file is its DISK boot program (the +3E lists the same)
      const lines = nonBlank(s);
      expect(lines.some((l) => /^DISK\s+\.\s+1K$/.test(l))).toBe(true);
      expect(lines).toContain(model.includes("-es-") ? "124K LIBRES" : "124K free");
    }, 120_000);

    it("Loader boots the disk in drive A", async () => {
      const s = await createSp128Session(model);
      s.insertDisk(0, LTK_DSK);
      s.runFlow(s.machine.getTapeLoadFlow!(), { checkRom: false });
      // --- The DISK program loads "scr" to the screen: wait for the screen bank to fill
      let filled = 0;
      for (let frame = 0; frame < 3000 && filled < 2000; frame += 25) {
        s.runFrames(25);
        filled = s.bank(5).subarray(0, 0x1800).reduce((n, b) => n + (b ? 1 : 0), 0);
      }
      expect(filled).toBeGreaterThanOrEqual(2000);
    }, 120_000);
  }
);
