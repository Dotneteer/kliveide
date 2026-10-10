import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { checkRomSidecar } from "@renderer/appIde/annotations/romSidecarCheck";
import { formatRomSidecar } from "@common/roms/romAnnotationTools";

/*
 * `rom-ann-check` and the editor's readiness chip (`.plans/ROM_ANNOTATION_EDITING_PLAN.md` R7): the
 * assertions of `shippedRomSidecars.test.ts`, in process. Kept in step with that test here — every
 * shipped sidecar must pass — and each rule is shown to bite.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const sidecars = readdirSync(ROMS).filter((name) => name.endsWith(".rom.dis")).sort();
const romPages = (sidecar: string) => {
  const rom = new Uint8Array(readFileSync(join(ROMS, sidecar.replace(/\.dis$/, ""))));
  return (page: number) => {
    const start = page * 0x4000;
    return start < rom.length ? rom.subarray(start, Math.min(rom.length, start + 0x4000)) : undefined;
  };
};
const SP48_TEXT = readFileSync(join(ROMS, "sp48.rom.dis"), "utf8");
const sp48 = () => JSON.parse(SP48_TEXT);

describe("checkRomSidecar", () => {
  it.each(sidecars)("passes the shipped %s, as CI does", async (name) => {
    const check = await checkRomSidecar(readFileSync(join(ROMS, name), "utf8"), romPages(name));
    expect(check.problems).toEqual([]);
  });

  it("reports the measured level and the unlabelled targets", async () => {
    const check = await checkRomSidecar(SP48_TEXT, romPages("sp48.rom.dis"));
    expect(check.levels["0"]).toBeGreaterThanOrEqual(check.recordedLevel);
    expect(Array.isArray(check.unlabelledTargets["0"])).toBe(true);
  });

  it("finds a file that is not in the canonical format", async () => {
    const check = await checkRomSidecar(JSON.stringify(sp48()), romPages("sp48.rom.dis"));
    expect(check.problems).toEqual([expect.stringContaining("format")]);
  });

  it("finds missing and stray provenance", async () => {
    const raw = sp48();
    const [first] = Object.keys(raw.provenance);
    delete raw.provenance[first];
    raw.provenance["0:1:label"] = "observed";
    const check = await checkRomSidecar(formatRomSidecar(raw), romPages("sp48.rom.dis"));
    expect(check.problems).toEqual([
      expect.stringContaining(`No provenance: ${first}`),
      expect.stringContaining("0:1:label")
    ]);
  });

  it("finds a page whose bytes are not the ROM it names", async () => {
    const raw = sp48();
    raw.pages["0"].crc32 = "00000000";
    const check = await checkRomSidecar(formatRomSidecar(raw), romPages("sp48.rom.dis"));
    expect(check.problems).toEqual([expect.stringContaining("names CRC 00000000")]);
  });

  it("finds a page whose ROM is missing", async () => {
    const check = await checkRomSidecar(SP48_TEXT, () => undefined);
    expect(check.problems).toEqual([expect.stringContaining("was not found")]);
  });

  it("finds a duplicated or invalid label name", async () => {
    const raw = sp48();
    const labels = raw.banks["0"].localLabels;
    labels[1] = { ...labels[1], name: labels[0].name };
    labels[2] = { ...labels[2], name: "not valid!" };
    const check = await checkRomSidecar(formatRomSidecar(raw), romPages("sp48.rom.dis"));
    expect(check.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${labels[0].name} is used twice`),
        expect.stringContaining("not valid! is not a valid label name")
      ])
    );
  });

  it("finds a recorded level higher than the measured one", async () => {
    const raw = sp48();
    raw.level = 2;
    const check = await checkRomSidecar(formatRomSidecar(raw), romPages("sp48.rom.dis"));
    expect(check.problems).toEqual(expect.arrayContaining([expect.stringContaining("records level 2")]));
  });
});
