import { describe, expect, it } from "vitest";

import { kitMachine, loadKitFile, pictureRgb, savePicture, type KitMachine, type KitSession } from "./kit";
import { PublishedPictures } from "./pictures";

/*
 * The kit's programs that draw their result rather than print it, checked against real machines.
 *
 * - ULA 48 Simple Test, ULA 128 Timing Test, ULA 128E +3 Test (azesmbog, 2012): a picture drawn by
 *   timed border writes over the border and the paper. A timing error puts stripes in the wrong place.
 *   The rows below are transcribed from each program's expected screen on its ZXE wiki page; the
 *   real machines' photos there show the same pictures (ULA 128: Marta Sevillano Mancilla's 128K and
 *   +2; ULA 128E +3: her +3). Colours are compared by ZX colour (0-7), not by brightness.
 * - IR Contention and IR Contention 128 (Mark Woodmass, 2023): code with IR in contended memory runs
 *   through the display; the programs say "The 4 bars in lower border are symmetrical to those in top
 *   border" on a real machine, which the real 48K's and 128K's photos on the wiki show.
 */

type Run = [from: number, colour: number];

const BLACK = 0, BLUE = 1, RED = 2, MAGENTA = 3, GREEN = 4, CYAN = 5, YELLOW = 6, WHITE = 7;

/** The ZX colour of a pixel, brightness ignored */
function zxColour(rgb: number): number {
  const on = (v: number) => (v > 0x40 ? 1 : 0);
  return on(rgb >> 16) * 2 + on((rgb >> 8) & 0xff) * 4 + on(rgb & 0xff);
}

/** A picture row as runs of ZX colours */
function row(s: KitSession, y: number): Run[] {
  const runs: Run[] = [];
  for (let x = 0; x < 352; x++) {
    const colour = zxColour(pictureRgb(s, y, x));
    if (runs.length === 0 || runs[runs.length - 1][1] !== colour) runs.push([x, colour]);
  }
  return runs;
}

async function run(model: KitMachine["model"], file: string, name: string, pictures?: PublishedPictures): Promise<KitSession> {
  const s = await kitMachine({ model });
  loadKitFile(s, file);
  s.runFrames(2000);
  savePicture(s, name);
  pictures?.take(s, name);
  return s;
}

type Program = { name: string; model: KitMachine["model"]; file: string; publish: boolean; rows: Record<number, Run[]> };

const PROGRAMS: Program[] = [
  {
    name: "ula48-simple",
    model: "48k",
    file: "ula48-simple/ULA 48 Simple Test (2012-10-06)(azesmbog)[!].tap",
    publish: false,
    rows: {
      26: [[0, BLUE], [24, BLACK], [48, BLUE], [72, RED], [96, BLACK], [144, MAGENTA], [168, BLACK], [216, GREEN], [240, BLACK], [264, GREEN], [288, BLACK], [312, CYAN], [336, BLACK]],
      44: [[0, BLUE], [24, BLACK], [48, BLUE], [72, RED], [96, BLACK], [120, MAGENTA], [192, BLACK], [216, GREEN], [288, BLACK], [312, CYAN], [336, BLACK]],
      56: [[0, BLUE], [72, RED], [120, MAGENTA], [144, BLACK], [146, WHITE], [166, BLACK], [168, MAGENTA], [192, BLACK], [194, WHITE], [262, BLACK], [264, GREEN], [288, CYAN]],
      70: [[0, BLACK], [48, WHITE], [304, BLACK]],
      100: [[0, BLUE], [24, BLACK], [48, BLUE], [72, WHITE], [80, BLUE], [96, WHITE], [104, BLUE], [120, WHITE], [128, BLUE], [144, WHITE], [152, BLUE], [168, WHITE], [176, BLUE], [190, WHITE], [236, BLUE], [252, WHITE], [272, BLUE], [296, BLACK], [304, WHITE], [312, BLUE], [336, BLACK]],
      180: [[0, RED], [88, MAGENTA], [160, BLUE], [256, GREEN], [336, BLACK]],
      230: [[0, BLACK], [24, RED], [56, WHITE], [88, MAGENTA], [112, WHITE], [192, BLUE], [256, WHITE], [280, GREEN], [312, BLACK]]
    }
  },
  {
    name: "ula128-timing",
    model: "128k",
    file: "ula128-timing/ULA 128 Timing Test (2012-10-06)(azesmbog)[!].tap",
    publish: true,
    rows: {
      24: [[0, BLUE], [24, BLACK], [48, BLUE], [72, RED], [96, BLACK], [144, MAGENTA], [168, BLACK], [192, GREEN], [216, BLACK], [240, CYAN], [264, BLACK], [312, YELLOW], [336, BLACK]],
      30: [[0, BLUE], [24, BLACK], [48, BLUE], [72, RED], [96, BLACK], [120, MAGENTA], [192, GREEN], [216, CYAN], [288, YELLOW]],
      60: [[0, BLACK], [16, BLUE], [72, RED], [120, MAGENTA], [144, BLACK], [146, WHITE], [166, BLACK], [168, MAGENTA], [192, GREEN], [216, CYAN], [288, BLACK], [290, WHITE], [302, BLACK], [304, YELLOW], [344, BLACK]],
      100: [[0, BLACK], [16, RED], [40, BLACK], [48, YELLOW], [64, BLACK], [66, RED], [86, BLACK], [88, YELLOW], [96, BLACK], [98, RED], [118, BLACK], [120, YELLOW], [128, BLACK], [130, RED], [150, BLACK], [152, YELLOW], [160, BLACK], [162, RED], [182, BLACK], [184, YELLOW], [192, BLACK], [194, RED], [214, BLACK], [216, YELLOW], [224, BLACK], [226, RED], [246, BLACK], [248, YELLOW], [256, BLACK], [258, RED], [278, BLACK], [280, YELLOW], [288, BLACK], [290, RED], [304, BLACK]],
      140: [[0, BLACK], [48, YELLOW], [302, BLACK]],
      200: [[0, BLACK], [24, BLUE], [56, BLACK], [88, BLUE], [120, BLACK], [160, BLUE], [224, BLACK], [280, BLUE], [312, BLACK]],
      240: [[0, BLACK], [24, RED], [56, BLACK], [88, RED], [120, BLACK], [216, RED], [256, BLACK], [280, RED], [312, BLACK]]
    }
  },
  {
    name: "ula128e-plus3",
    model: "plus2a",
    file: "ula128e-plus3/ULA 128E +3 Test (2012-10-10)(azesmbog)[!].tap",
    publish: true,
    rows: {
      // --- The top border: "ULA128" drawn by border writes only
      24: [[0, BLUE], [24, BLACK], [48, BLUE], [72, RED], [96, BLACK], [144, MAGENTA], [168, BLACK], [192, GREEN], [216, BLACK], [240, CYAN], [264, BLACK], [312, YELLOW], [336, BLACK]],
      56: [[0, BLUE], [72, RED], [120, MAGENTA], [144, BLACK], [146, WHITE], [166, BLACK], [168, MAGENTA], [192, GREEN], [216, CYAN], [288, BLACK], [304, YELLOW]],
      152: [[0, WHITE], [86, BLACK], [88, WHITE], [158, BLACK], [160, YELLOW], [182, BLACK], [184, WHITE], [254, BLACK], [256, WHITE], [344, BLACK]],
      // --- "TEST", across the paper's edges into the border
      200: [[0, BLACK], [24, BLUE], [56, BLACK], [88, BLUE], [120, BLACK], [160, BLUE], [224, BLACK], [280, BLUE], [312, BLACK]],
      236: [[0, BLACK], [24, RED], [56, BLACK], [88, RED], [120, BLACK], [208, RED], [256, BLACK], [280, RED], [312, BLACK]]
    }
  }
];

describe.each(PROGRAMS)("$name", (p) => {
  it("draws the real machine's picture", async () => {
    const pictures = new PublishedPictures();
    const s = await run(p.model, p.file, p.name, p.publish ? pictures : undefined);
    for (const [y, runs] of Object.entries(p.rows)) expect(row(s, Number(y)), `row ${y}`).toEqual(runs);
    pictures.settle();
  }, 300_000);
});

describe.each([
  { name: "ir-contention", model: "48k" as const, file: "ir-contention/IR Contention (2023-01-08)(Woodmass, Mark)[!].tap", publish: false },
  { name: "ir-contention-128", model: "128k" as const, file: "ir-contention-128/IR Contention 128 (2023-07-02)(Woodmass, Mark)[!].tap", publish: true }
])("$name", ({ name, model, file, publish }) => {
  it("draws the lower border's four bars symmetrical to the top border's", async () => {
    const pictures = new PublishedPictures();
    const s = await run(model, file, name, publish ? pictures : undefined);
    const top = row(s, 8);
    expect(top.filter(([, colour]) => colour !== BLACK), "four bars in the top border").toHaveLength(4);
    // --- Every line of the bottom border (the picture's last 48) shows them where the top border does
    for (let y = 240; y < 287; y++) expect(row(s, y), `row ${y}`).toEqual(top);
    pictures.settle();
  }, 300_000);
});
