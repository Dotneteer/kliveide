import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { provenanceDelta, romSidecarText, withProvenance } from "@renderer/appIde/annotations/romSidecarWriter";
import { checkRomSidecar } from "@renderer/appIde/annotations/romSidecarCheck";
import { formatRomSidecar, missingProvenance, strayProvenance } from "@common/roms/romAnnotationTools";

/*
 * A working copy is written so it can be shipped as it is (`.plans/ROM_ANNOTATION_EDITING_PLAN.md`
 * R5, T2, T3): banks from the model, everything else from the file, provenance moved with the
 * entries, the CLI's own format.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const SHIPPED_TEXT = readFileSync(join(ROMS, "sp48.rom.dis"), "utf8");
const SP48 = new Uint8Array(readFileSync(join(ROMS, "sp48.rom")));
const shipped = () => JSON.parse(SHIPPED_TEXT);

const bank = (extra: Record<string, unknown> = {}) => ({
  offsetIndex: 0,
  regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
  ...extra
});
const sidecar = (banks: Record<string, unknown>, provenance?: Record<string, string>) => ({
  schemaVersion: 3,
  machine: "rom",
  banks,
  ...(provenance ? { provenance } : {})
});

describe("provenanceDelta", () => {
  it("gives a created entry the chosen provenance", () => {
    const before = sidecar({ "0": bank() });
    const after = sidecar({ "0": bank({ localLabels: [{ name: "START", value: 0 }] }) });
    expect(provenanceDelta(before, after, "manual")).toEqual({ "0:0:label": "manual" });
  });

  it("keeps a changed entry's provenance: fixing a manual name's typo does not make it observed", () => {
    const before = sidecar({ "0": bank({ localLabels: [{ name: "CL_AL", value: 0x0d6b }] }) }, { "0:3435:label": "manual" });
    const after = sidecar({ "0": bank({ localLabels: [{ name: "CL_ALL", value: 0x0d6b }] }) });
    expect(provenanceDelta(before, after, "observed")).toEqual({ "0:3435:label": "manual" });
  });

  it("stops a derived entry being derived once it is edited", () => {
    const before = sidecar({ "0": bank({ lineAnnotations: { "8": { comment: "a" } } }) }, { "0:8:line": "derived" });
    const after = sidecar({ "0": bank({ lineAnnotations: { "8": { comment: "b" } } }) });
    expect(provenanceDelta(before, after, "observed")).toEqual({ "0:8:line": "observed" });
  });

  it("drops the key of a removed or moved entry", () => {
    const before = sidecar(
      { "0": bank({ localLabels: [{ name: "A", value: 4 }], regions: [{ start: 0, end: 9, type: "disassemble" }, { start: 10, end: 0x3fff, type: "bytes" }] }) },
      { "0:4:label": "manual", "0:10:region": "observed" }
    );
    const after = sidecar({
      "0": bank({ localLabels: [{ name: "A", value: 6 }], regions: [{ start: 0, end: 11, type: "disassemble" }, { start: 12, end: 0x3fff, type: "bytes" }] })
    });
    expect(provenanceDelta(before, after, "observed")).toEqual({ "0:6:label": "observed", "0:12:region": "observed" });
  });

  it("leaves untouched entries exactly as they were", () => {
    expect(provenanceDelta(shipped(), shipped(), "manual")).toEqual(shipped().provenance);
  });
});

describe("romSidecarText", () => {
  it("writes only the banks, keeping every other key, in the canonical format", () => {
    const raw = { ...shipped(), futureKey: { kept: true } };
    const banks = shipped().banks;
    banks["0"].lineAnnotations = { ...banks["0"].lineAnnotations, "1": { comment: "new" } };
    const text = romSidecarText(raw, banks, "observed");
    const written = JSON.parse(text);
    expect(text).toBe(formatRomSidecar(written));
    for (const key of ["source", "authoring", "level", "pages", "futureKey"]) expect(written[key]).toEqual(raw[key]);
    expect(written.provenance["0:1:line"]).toBe("observed");
    expect(missingProvenance(written)).toEqual([]);
    expect(strayProvenance(written)).toEqual([]);
  });

  it("never writes global labels, a debug subtree, or a bank document's view settings", () => {
    const raw = { ...shipped(), globalLabels: [], debug: { breakpoints: [] } };
    const banks = shipped().banks;
    banks["0"].lastView = "memory";
    banks["0"].decimalView = true;
    const written = JSON.parse(romSidecarText(raw, banks, "observed"));
    expect(written.globalLabels).toBeUndefined();
    expect(written.debug).toBeUndefined();
    expect(written.banks["0"].lastView).toBeUndefined();
    expect(written.banks["0"].decimalView).toBeUndefined();
  });

  it("leaves an unchanged copy byte for byte what was shipped", () => {
    expect(romSidecarText(shipped(), shipped().banks, "manual")).toBe(SHIPPED_TEXT);
  });

  it("produces a file that passes every check a shipped sidecar must (T2)", async () => {
    const banks = shipped().banks;
    banks["0"].localLabels = [...banks["0"].localLabels, { name: "AT_ZERO", value: 0 }].filter(
      (label: { value: number }, index: number, all: { value: number }[]) =>
        all.findIndex((other) => other.value === label.value) === index
    );
    const text = romSidecarText(shipped(), banks, "observed");
    const check = await checkRomSidecar(text, (page) => (page === 0 ? SP48 : undefined));
    expect(check.problems).toEqual([]);
  });
});

describe("withProvenance", () => {
  it("sets an existing entry's provenance, and refuses one that is not there", () => {
    const raw = shipped();
    const key = Object.keys(raw.provenance)[0];
    expect(withProvenance(raw, key, "manual")?.provenance[key]).toBe("manual");
    expect(withProvenance(raw, "0:1:label", "manual")).toBeUndefined();
  });
});
