import { expect, it } from "vitest";

import { kitMachine, loadKitFile, savePicture, screenText } from "./kit";

/*
 * HALT2INT v3 (Mark Woodmass, 2022): when a HALT reaches its interrupt, at six addresses and five
 * starting T-states, with the R register as the witness; and where the floating bus is read. The
 * program compares its results with its own tables of a real early and a real late machine and says
 * which it is. The kit has its author's photos of both real 48Ks: `halt2int/Real 48k (early).png`
 * and `Real 48k (late).png`, transcribed below.
 */

const EARLY_48K = `Float: Early    HALT: Early
ADDR  CYCLE R   ADDR  CYCLE R
16384/12000:0C  32767/12000:0C
32768/12000:0C  49151/12000:0C
49152/12000:0C  65535/12000:0C

16384/14335:44  32767/14335:43
32768/14335:45  49151/14335:45
49152/14335:45  65535/14335:45

16384/14336:44  32767/14336:43
32768/14336:44  49151/14336:44
49152/14336:44  65535/14336:44

16384/14562:1C  32767/14562:0B
32768/14562:0C  49151/14562:0C
49152/14562:0C  65535/14562:0C

16384/57239:5D  32767/57239:5D
32768/57239:5F  49151/57239:5F
49152/57239:5F  65535/57239:5F`;

const LATE_48K = `Float: Late     HALT: Late
ADDR  CYCLE R   ADDR  CYCLE R
16384/12000:0C  32767/12000:0C
32768/12000:0C  49151/12000:0C
49152/12000:0C  65535/12000:0C

16384/14335:45  32767/14335:45
32768/14335:45  49151/14335:45
49152/14335:45  65535/14335:45

16384/14336:44  32767/14336:43
32768/14336:44  49151/14336:44
49152/14336:44  65535/14336:44

16384/14562:1C  32767/14562:0B
32768/14562:0C  49151/14562:0C
49152/14562:0C  65535/14562:0C

16384/57239:5E  32767/57239:5F
32768/57239:5F  49151/57239:5F
49152/57239:5F  65535/57239:5F`;

async function run(model: "48k" | "128k", late: boolean): Promise<string> {
  const s = await kitMachine({ model, late });
  loadKitFile(s, model === "48k" ? "halt2int/halt2int.tap" : "halt2int/halt2int128.tap");
  s.runFrames(3000);
  savePicture(s, `halt2int-${model}-${late ? "late" : "early"}`);
  return screenText(s);
}

it("the 48K with early timing shows the real early 48K's photo", async () => {
  expect(await run("48k", false)).toContain(EARLY_48K);
}, 120_000);

it("the 48K with late timing shows the real late 48K's photo", async () => {
  expect(await run("48k", true)).toContain(LATE_48K);
}, 120_000);

it("the 128K matches the program's own early and late tables", async () => {
  expect(await run("128k", false)).toContain("Float: Early    HALT: Early");
  expect(await run("128k", true)).toContain("Float: Late     HALT: Late");
}, 180_000);
