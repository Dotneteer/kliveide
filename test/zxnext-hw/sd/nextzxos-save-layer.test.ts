import { describe, expect, it } from "vitest";

import { CimFile } from "@main/fat32/CimFileManager";
import { O_RDONLY } from "@main/fat32/Fat32Types";
import { Fat32Volume } from "@main/fat32/Fat32Volume";
import { splitPlus3Header } from "@common/diskfs/plus3dos";
import { slrPicture } from "@common/screenFiles/loresScreen";
import { readScreenFile, type ScreenFileKind } from "@common/screenFiles/screenFile";
import { shcPicture, shrPicture } from "@common/screenFiles/timexScreen";
import { scrPicture } from "@common/screenFiles/zxScreen";
import { parseLayer2File } from "@common/zxnext/layer2/layer2File";
import { layer2Image } from "@common/zxnext/layer2/layer2Decode";

import { bootNextZxos, type NextKey, type NextTestSession } from "../../harness/zxnext";

/*
 * Screen files as NextZXOS writes them (`dev/plans/SCREEN_FILE_VIEWERS_PLAN.md`, §8): NextBASIC draws a
 * circle on each layer and saves it with `SAVE ... LAYER`; the files are read off the card and must
 * open in the screen file viewers' readers with the circle in them.
 *
 * What it pins: every file starts with a PLUS3DOS header; the ULA screen is CODE (6,912 bytes at
 * $4000); LoRes, Timex hi-res and hi-colour are header type 4 and Layer 2 type 5, with load address 0;
 * the bytes after the header are the layouts the decoders read.
 *
 * Driving NextBASIC: its editor clears the screen when the next line is typed after a report, so each
 * layer is drawn and saved on one line; it drops keys typed while it is busy, so keys are held for 6
 * frames with 12 between them.
 */

const RTC = { year: 26, month: 9, date: 19, day: 7, hours: 10, minutes: 0, seconds: 0 };

async function tap(s: NextTestSession, ...keys: NextKey[]): Promise<void> {
  s.keyDown(...keys);
  await s.runFramesAsync(6);
  s.keyUp(...keys);
  await s.runFramesAsync(12);
}

async function enter(s: NextTestSession, text: string, frames: number): Promise<void> {
  for (const c of text) {
    if (c === ":") await tap(s, "SYM", "Z");
    else await tap(s, c === " " ? "SPACE" : (c as NextKey));
  }
  await tap(s, "ENTER");
  await s.runFramesAsync(frames);
}

const LAYERS: { file: string; layer: string; draw: string; type: number; size: number; kind: ScreenFileKind | "l2" }[] = [
  { file: "ULA.SCR", layer: "LAYER 0", draw: "INK 2: CIRCLE 40,40,30", type: 3, size: 6912, kind: "scr" },
  { file: "LORES.SLR", layer: "LAYER 1,0", draw: "CIRCLE 40,40,30", type: 4, size: 12288, kind: "slr" },
  { file: "HIRES.SHR", layer: "LAYER 1,2", draw: "CIRCLE 40,40,30", type: 4, size: 12288, kind: "shr" },
  { file: "HICOL.SHC", layer: "LAYER 1,3", draw: "INK 4: CIRCLE 40,40,30", type: 4, size: 12288, kind: "shc" },
  { file: "L2.SL2", layer: "LAYER 2,1", draw: "CIRCLE 40,40,30", type: 5, size: 49152, kind: "l2" }
];

/** How many pixels differ from the picture's most common value: the circle's */
function circlePixels(pixels: ArrayLike<number>): number {
  const counts = new Map<number, number>();
  for (let i = 0; i < pixels.length; i++) counts.set(pixels[i], (counts.get(pixels[i]) ?? 0) + 1);
  return pixels.length - Math.max(...counts.values());
}

describe("SPI-014: NextZXOS SAVE ... LAYER writes screen files the viewers read", () => {
  it("saves each layer and reads it back", async () => {
    const { s, cardPath, close } = await bootNextZxos(RTC);
    try {
      // --- Browser, Command Line, NextBASIC
      await tap(s, "DOWN");
      await tap(s, "DOWN");
      await tap(s, "ENTER");
      await s.runFramesAsync(100);
      for (const l of LAYERS) {
        await enter(s, l.layer, 80);
        await enter(s, `${l.draw}: SAVE "${l.file}" LAYER`, 500);
      }

      const cim = new CimFile(cardPath);
      try {
        const volume = new Fat32Volume(cim);
        volume.init();
        for (const l of LAYERS) {
          const handle = volume.open(l.file, O_RDONLY);
          expect(handle, l.file).not.toBeNull();
          const bytes = handle!.readFileData(handle!.fileSize)!;
          const { header, body } = splitPlus3Header(bytes);
          expect(header?.type, `${l.file}: header type`).toBe(l.type);
          expect(body.length, `${l.file}: picture size`).toBe(l.size);
          if (l.type === 3) expect(header?.param1, `${l.file}: load address`).toBe(0x4000);

          let pixels: ArrayLike<number>;
          if (l.kind === "l2") {
            const { file } = parseLayer2File(bytes);
            expect(file?.resolutions, l.file).toEqual([0]);
            pixels = layer2Image(0, file!.data, 0);
          } else {
            const { file } = readScreenFile(l.kind, bytes);
            expect(file, l.file).toBeDefined();
            pixels =
              l.kind === "scr"
                ? scrPicture(file!.body).pixels
                : l.kind === "shc"
                  ? shcPicture(file!.body).pixels
                  : l.kind === "shr"
                    ? shrPicture(file!.body).pixels
                    : slrPicture(file!.body).pixels;
          }
          // --- A circle of radius 30 sets about 170 pixels; a cleared screen sets none
          expect(circlePixels(pixels), `${l.file}: the circle`).toBeGreaterThan(100);
        }
      } finally {
        cim.close();
      }
    } finally {
      close();
    }
  }, 600_000);
});
