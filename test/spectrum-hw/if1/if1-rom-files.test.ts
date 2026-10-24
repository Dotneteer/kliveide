import { describe, expect, it } from "vitest";

import { createFormattedMdr, readMdrCatalog, readMdrFile } from "@emu/machines/microdrive/mdrImage";
import { runBasic, screenLines, sp48WithInterface1 } from "./if1TestSupport";

/*
 * Files on a cartridge with the shipped v2 ROM (`.plans/MICRODRIVE_PLAN.md` Phase 4.1; the scripts
 * are `_input/microdrive/test-material.md` T3-T8). Each test starts from a tool-formatted cartridge
 * (`createFormattedMdr`), which the ROM uses as it would one it formatted itself, and reads the
 * result both on the screen and in the image.
 */

async function session(mdr: Uint8Array = createFormattedMdr("TEST")) {
  return (await sp48WithInterface1()).insertCartridge(0, mdr);
}

const last = (s: Parameters<typeof screenLines>[0]) => screenLines(s).at(-1);

describe("Interface 1 files (real v2 ROM)", () => {
  it("SAVE * CODE and SCREEN$: their headers, and LOAD * CODE at another address", async () => {
    const s = await session();
    for (let i = 0; i < 1000; i++) s.poke(32768 + i, (i * 7) & 0xff);
    runBasic(s, `10 SAVE *"m";1;"code" CODE 32768,1000\n20 SAVE *"m";1;"scr" SCREEN$\n30 LOAD *"m";1;"code" CODE 40000`, 3000);
    expect(last(s)).toBe("0 OK, 30:1");
    for (let i = 0; i < 1000; i++) expect(s.peek(40000 + i)).toBe((i * 7) & 0xff);
    const catalog = readMdrCatalog(s.cartridge(0)!);
    const code = catalog.files.find((f) => f.name === "code")!;
    expect(code.header).toEqual({ type: 3, length: 1000, start: 32768, programLength: 0xffff, autorun: 0xffff });
    const scr = catalog.files.find((f) => f.name === "scr")!;
    expect(scr.header).toMatchObject({ type: 3, length: 6912, start: 16384 });
    // --- 6912 bytes and the 9-byte header: 14 records
    expect(scr.slots.length).toBe(14);
    expect(readMdrFile(s.cartridge(0)!, code).length).toBe(1000);
  }, 120_000);

  it("LOAD * of a CODE file as a program is the wrong file type", async () => {
    const s = await session();
    runBasic(s, `10 SAVE *"m";1;"code" CODE 0,100\n20 LOAD *"m";1;"code"`, 1500);
    expect(last(s)).toBe("Wrong file type, 20:1");
  }, 120_000);

  it("arrays: SAVE * DATA and LOAD * DATA bring the values back", async () => {
    const s = await session();
    runBasic(s, `10 DIM a(10): LET a(3)=42: SAVE *"m";1;"arr" DATA a()\n20 CLEAR\n30 LOAD *"m";1;"arr" DATA b()\n40 PRINT b(3)`, 1500);
    expect(screenLines(s)).toEqual(["42", "0 OK, 40:1"]);
    const arr = readMdrCatalog(s.cartridge(0)!).files.find((f) => f.name === "arr")!;
    // --- The array's name byte: $80 + "a" (a number array), $FF above it (RES-VARS)
    expect(arr.header).toMatchObject({ type: 1, programLength: 0xff81 });
  }, 120_000);

  it("VERIFY * passes on the program saved, fails on a changed one", async () => {
    const s = await session();
    runBasic(s, `10 SAVE *"m";1;"prog"\n20 VERIFY *"m";1;"prog"\n30 STOP`, 1500);
    expect(last(s)).toBe("9 STOP statement, 30:1");
    runBasic(s, `10 SAVE *"m";1;"prog2"\n15 LET x=1\n20 VERIFY *"m";1;"prog"`, 1500);
    expect(last(s)).toBe("Verification has failed, 20:1");
  }, 120_000);

  it("a PRINT # stream: OPEN #, PRINT #, CLOSE #, then INPUT # reads it back; MOVE copies it", async () => {
    const s = await session();
    runBasic(
      s,
      `10 OPEN #4;"m";1;"data": PRINT #4;"hello": PRINT #4;"world": CLOSE #4\n20 OPEN #4;"m";1;"data": INPUT #4;a$: INPUT #4;b$: CLOSE #4\n30 PRINT a$;" ";b$\n40 MOVE "m";1;"data" TO #2`,
      3000
    );
    expect(screenLines(s)).toEqual(["hello world", "hello", "world", "0 OK, 40:1"]);
    const data = readMdrCatalog(s.cartridge(0)!).files.find((f) => f.name === "data")!;
    // --- No header: a stream's bytes as they were printed
    expect(data.saved).toBe(false);
    expect(String.fromCharCode(...readMdrFile(s.cartridge(0)!, data))).toBe("hello\rworld\r");
  }, 120_000);

  it("ERASE frees the file's sectors; CAT no longer lists it", async () => {
    const s = await session();
    runBasic(s, `10 SAVE *"m";1;"prog"\n20 ERASE "m";1;"prog"\n30 CAT 1`, 2500);
    expect(screenLines(s)).toEqual(["TEST", "127", "0 OK, 30:1"]);
    expect(readMdrCatalog(s.cartridge(0)!)).toMatchObject({ free: 254, files: [] });
  }, 120_000);

  it.each([
    [`LOAD *"m";1;"nosuch"`, "File not found"],
    [`CAT 9`, "Invalid drive number"],
    [`SAVE *"m";1;""`, "Invalid name"],
    [`SAVE *"m";1;"elevenchars"`, "Invalid name"],
    [`OPEN #4;"x"`, "Invalid device expression"]
  ])("%s reports %s", async (command, report) => {
    const s = await session();
    runBasic(s, `10 ${command}`, command.startsWith("LOAD") ? 900 : 200);
    expect(last(s)).toBe(`${report}, 10:1`);
  }, 120_000);

  it("SAVE * over an existing name, and a second OPEN # on a stream, are refused", async () => {
    const s = await session();
    runBasic(s, `10 SAVE *"m";1;"prog"\n20 SAVE *"m";1;"prog"`, 1500);
    expect(last(s)).toBe("Writing to a 'read' file, 20:1");
    runBasic(s, `10 OPEN #4;"m";1;"a": OPEN #4;"m";1;"b"`, 1500);
    expect(last(s)).toBe("Stream already open, 10:2");
  }, 120_000);

  it("a full cartridge says so", async () => {
    const s = await session(createFormattedMdr("TINY", 3));
    runBasic(s, `10 SAVE *"m";1;"big" CODE 0,4000`, 600);
    expect(last(s)).toBe("Microdrive full, 10:1");
  }, 120_000);
});
