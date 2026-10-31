import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { detectCasFormat } from "@emu/machines/casFormat";
import { buildTvcCasFile, parseTvcCasFile, tvcCasPayloadLength } from "@emu/machines/tvc/TvcCasFile";
import { basToBasicTape } from "@emu/machines/ht1080z/Ht1080zTapeFile";
import { analyzeTvcCas, programLines } from "@renderer/appIde/DocumentPanels/TvcTape/tvcCasModel";

/*
 * `.cas` is the HT-1080Z's tape and the Videoton TVC's, in two unrelated formats: which one a file is,
 * is read from its bytes (`casFormat.ts`), and the TVC's is taken apart for the viewer
 * (`tvcCasModel.ts`).
 */

const htCas = (name: string) => new Uint8Array(readFileSync(join(__dirname, "../testfiles/ht1080z", name)));

/** 10 PRINT 42 as TVC BASIC stores it, then the closing 00h */
const PROGRAM = Uint8Array.from([0x08, 0x0a, 0x00, 0xdd, 0x20, 0x34, 0x32, 0xff, 0x00]);
const CODE = [0x3e, 0x01, 0xc9];

describe(".cas format detection", () => {
  it("tells a TVC container from an HT-1080Z bit stream", () => {
    expect(detectCasFormat(buildTvcCasFile(PROGRAM, 0x01, true))).toBe("tvc");
    for (const name of ["galaxy.cas", "amoeba.cas", "android-nim.cas", "galaxyld.cas"]) {
      expect(detectCasFormat(htCas(name)), name).toBe("ht1080z");
    }
    expect(detectCasFormat(basToBasicTape(Uint8Array.from([0xff, 0x00, 0x00]), "A"))).toBe("ht1080z");
  });

  it("knows neither a text file nor a file too short for the TVC's header", () => {
    expect(detectCasFormat(new TextEncoder().encode("*** BASIC corrupted.\r\nLOAD\"x\"\r\n"))).toBeUndefined();
    expect(detectCasFormat(Uint8Array.from([0x11, 0x00, 0x01]))).toBeUndefined();
  });

  it("reads a TVC file whose record counts are wrong by the application header's length", () => {
    const cas = buildTvcCasFile(PROGRAM, 0x01, false);
    cas[2] = 0x4a; // --- 74 records: far more than the file holds
    expect(detectCasFormat(cas)).toBe("tvc");
    expect(tvcCasPayloadLength(cas)).toBe(PROGRAM.length);
    expect(parseTvcCasFile(cas, "x.cas").payload).toEqual(PROGRAM);
    // --- Shorter than both say: not loadable
    expect(tvcCasPayloadLength(cas.subarray(0, 148))).toBeUndefined();
  });
});

describe("TVC .cas view model", () => {
  it("splits a program file into its headers, the BASIC program and the code after it", () => {
    const payload = Uint8Array.from([...PROGRAM, ...CODE]);
    const { analysis } = analyzeTvcCas(buildTvcCasFile(payload, 0x01, true), "/p/hello.cas");
    expect(analysis).toBeDefined();
    expect(analysis!.name).toBe("HELLO");
    expect(analysis!.autostart).toBe(true);
    expect(analysis!.fileType).toBe(0x01);
    expect(analysis!.parts.map((p) => p.role)).toEqual(["fileHeader", "appHeader", "basicProgram", "afterProgram"]);
    expect(analysis!.lines).toEqual([{ offset: 0, lineNo: 10, length: 8 }]);
    expect(analysis!.programBytes).toBe(PROGRAM.length);
    const [, , program, code] = analysis!.parts;
    expect([program.loadFrom, program.loadTo]).toEqual([0x19ef, 0x19ef + PROGRAM.length]);
    expect([code.loadFrom, code.loadTo]).toEqual([0x19ef + PROGRAM.length, 0x19ef + PROGRAM.length + CODE.length]);
    expect(Array.from(code.bytes)).toEqual(CODE);
    expect(analysis!.playMs).toBeGreaterThan(4000);
    expect(analysis!.hasProblems).toBe(false);
    expect(analysis!.recordCountsWrong).toBe(false);
  });

  it("shows a payload that is not BASIC as one part", () => {
    const { analysis } = analyzeTvcCas(buildTvcCasFile(Uint8Array.from(CODE), 0x01, false), "/p/code.cas");
    expect(analysis!.parts.map((p) => p.role)).toEqual(["fileHeader", "appHeader", "payload"]);
    expect(analysis!.lines).toBeUndefined();
  });

  it("marks a cut-off file and a file with wrong record counts", () => {
    const cas = buildTvcCasFile(Uint8Array.from([...PROGRAM, ...CODE]), 0x01, false);
    const cut = analyzeTvcCas(cas.subarray(0, cas.length - 2), "/p/cut.cas").analysis!;
    expect(cut.hasProblems).toBe(true);
    expect(cut.parts[2]).toMatchObject({ role: "payload", problem: "truncated" });
    expect(cut.playMs).toBe(0);

    cas[2] = 0x40;
    const wrong = analyzeTvcCas(cas, "/p/wrong.cas").analysis!;
    expect(wrong.recordCountsWrong).toBe(true);
    expect(wrong.hasProblems).toBe(false);
    expect(wrong.parts.map((p) => p.role)).toEqual(["fileHeader", "appHeader", "basicProgram", "afterProgram"]);
  });

  it("shows bytes past the declared payload as trailing", () => {
    const cas = buildTvcCasFile(PROGRAM, 0x01, false);
    const longer = Uint8Array.from([...cas, 0xaa, 0xbb]);
    const { analysis } = analyzeTvcCas(longer, "/p/x.cas");
    expect(analysis!.parts.at(-1)).toMatchObject({ role: "trailing", offset: cas.length });
  });

  it("reads BASIC lines only up to a closing 00h", () => {
    expect(programLines(PROGRAM)).toEqual({ lines: [{ offset: 0, lineNo: 10, length: 8 }], bytes: 9 });
    expect(programLines(PROGRAM.subarray(0, 8))).toBeUndefined();
    expect(programLines(Uint8Array.from(CODE))).toBeUndefined();
  });

  it("refuses what is not a TVC container", () => {
    expect(analyzeTvcCas(htCas("galaxy.cas"), "galaxy.cas").error).toBe("notTvcCas");
  });
});
