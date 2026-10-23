import { expect, it } from "vitest";

import { kitMachine, loadKitFile, press, savePicture, screenText } from "./kit";

/*
 * The floating bus: Float48K and Float128K (Mark Woodmass, 2008) list what an IN from an unattached
 * port reads at each T-state; FloatSpy v0.33 (RAMSOFT, 2002) finds the ULA type from it. The author
 * of this plan ran FloatSpy on Klive's 48K and 128K, and both pass. The pattern asserted here is the
 * one the floating bus was calibrated on: from the first bitmap read on, the ULA reads a bitmap, its
 * attribute, the next bitmap and attribute, then the bus idles ($FF) for four T-states.
 */

/** The "T-state value" rows of a Float48K/Float128K screen */
function rows(text: string): Map<number, number> {
  const result = new Map<number, number>();
  for (const m of text.matchAll(/^(\d{5})\s+(\d+)\s*$/gm)) result.set(Number(m[1]), Number(m[2]));
  return result;
}

function expectPattern(table: Map<number, number>, firstRead: number): void {
  expect(table.size).toBeGreaterThan(15);
  for (const [tact, value] of table) {
    const phase = tact - firstRead;
    const reading = phase >= 0 && phase % 8 < 4;
    expect(value === 255, `${tact}: ${value}`).toBe(!reading);
  }
}

it("Float48K: the ULA's reads from 14,338 on", async () => {
  const s = await kitMachine({ model: "48k" });
  loadKitFile(s, "float48k/Float48K (2008-03-24)(Woodmass, Mark)[!].tap");
  s.runFrames(3000);
  savePicture(s, "float48k");
  expectPattern(rows(screenText(s)), 14338);
}, 120_000);

it("Float128K: the ULA's reads from 14,364 on", async () => {
  const s = await kitMachine({ model: "128k" });
  loadKitFile(s, "float128k/Float128K (2008-04-02)(Woodmass, Mark)[!].tap");
  s.runFrames(3000);
  savePicture(s, "float128k");
  expectPattern(rows(screenText(s)), 14364);
}, 120_000);

it("FloatSpy finds a 48K ULA on the 48K", async () => {
  const s = await kitMachine({ model: "48k" });
  loadKitFile(s, "floating-spy/floatspy.tap");
  s.runFrames(1500);
  savePicture(s, "floatspy-48k");
  const text = screenText(s);
  expect(text).toMatch(/ULA TYPE: 48K/);
}, 120_000);
