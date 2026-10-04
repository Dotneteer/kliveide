import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseZxProgramFile, isZx8081ProgramFileName, zx8081CharText } from "@emu/machines/zx8081/ZxPFile";
import { zx8081KeysForText } from "@emu/machines/zx8081/Zx8081Typer";
import { Zx8081KeyCode } from "@emu/machines/zx8081/Zx8081KeyCode";
import { resolveZx8081Hardware, zx8081ModelForProgram } from "@emu/machines/zx8081/zx8081MachineInfo";

const TAPES = join(__dirname, "../../_input/zx81-tapes");
const read = (path: string) => new Uint8Array(readFileSync(join(TAPES, path)));

describe("ZX81 .P files", () => {
  it("recognises a .P file and puts the nameless marker in front of its tape bytes", () => {
    const file = parseZxProgramFile(read("basic/Characters.P"), "Characters.P")!;
    expect(file.isZx81).toBe(true);
    expect(file.tapeBytes[0]).toBe(0x80);
    expect(file.tapeBytes.length).toBe(file.data.length + 1);
    expect(file.tapeBytes.subarray(1)).toEqual(file.data);
  });

  it("rejects an empty file", () => {
    expect(parseZxProgramFile(read("edge-cases/zero.p"), "zero.p")).toBeUndefined();
  });

  it("accepts the smallest program and files with bytes after E_LINE", () => {
    expect(parseZxProgramFile(read("edge-cases/minimal.p"), "minimal.p")).toBeDefined();
    expect(parseZxProgramFile(read("basic/BASE.p"), "BASE.p")).toBeDefined();
    expect(parseZxProgramFile(read("basic/POKE1.p"), "POKE1.p")).toBeDefined();
  });

  it("does not validate the system variables beyond E_LINE (1K programs keep code in them)", () => {
    expect(parseZxProgramFile(read("1k/byteForever.p"), "byteForever.p")?.ramKb).toBe(1);
    expect(parseZxProgramFile(read("1k/rcar.p"), "rcar.p")?.ramKb).toBe(1);
  });

  it("asks for 16K when the program ends past $4400", () => {
    // --- chess.p is "1K chess", but its file runs to $4470
    expect(parseZxProgramFile(read("1k/chess.p"), "chess.p")?.ramKb).toBe(16);
    expect(parseZxProgramFile(read("machine-code/jump.p"), "jump.p")?.ramKb).toBe(16);
    expect(zx8081ModelForProgram(true, 16)).toEqual({ machineId: "zx81", modelId: "zx81-16k" });
    expect(zx8081ModelForProgram(true, 1)).toEqual({ machineId: "zx81", modelId: "zx81-1k" });
  });

  it("knows the program extensions", () => {
    for (const name of ["a.p", "A.P", "b.81", "c.o", "d.80"]) expect(isZx8081ProgramFileName(name)).toBe(true);
    expect(isZx8081ProgramFileName("e.tap")).toBe(false);
  });
});

describe("ZX81 and ZX80 character sets", () => {
  it("follow the ROMs' glyphs, not CLK's tables", () => {
    // --- ZX81: $12-$18 are > < = + - * /; ZX80: - + * / = > <
    expect([0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18].map((c) => zx8081CharText(c, true)).join("")).toBe("><=+-*/");
    expect([0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18].map((c) => zx8081CharText(c, false)).join("")).toBe("-+*/=><");
    expect(zx8081CharText(0x0b, true)).toBe('"');
    expect(zx8081CharText(0x01, false)).toBe('"');
    expect(zx8081CharText(0x26, true)).toBe("A");
    expect(zx8081CharText(0xa6, true)).toBe("A");
    expect(zx8081CharText(0xf5, true)).toBe(" PRINT ");
  });
});

describe("ZX81 and ZX80 typing", () => {
  const K = Zx8081KeyCode;
  it("types the quote and the star with the machine's own shifts", () => {
    expect(zx8081KeysForText('"*', true)).toEqual([[K.Shift, K.P], [K.Shift, K.B]]);
    expect(zx8081KeysForText('"*', false)).toEqual([[K.Shift, K.Y], [K.Shift, K.P]]);
  });

  it("types letters, digits and NEW LINE unshifted", () => {
    expect(zx8081KeysForText("a1\n", true)).toEqual([[K.A], [K.N1], [K.NewLine]]);
  });

  it("refuses what the keyboard cannot type", () => {
    expect(() => zx8081KeysForText("@", true)).toThrow(/cannot type/);
  });
});

describe("ZX80/ZX81 models", () => {
  it("resolves the hardware of each model", () => {
    expect(resolveZx8081Hardware("zx81", { memSize: 64, screenFreq: "ntsc" })).toEqual({
      machineId: "zx81",
      hardwareZx81: true,
      romZx81: true,
      ramKb: 64,
      ntsc: true
    });
    expect(resolveZx8081Hardware("zx80", { memSize: 16, zx80Rom8K: true })).toMatchObject({
      hardwareZx81: false,
      romZx81: true,
      ramKb: 16,
      ntsc: false
    });
    expect(resolveZx8081Hardware("zx80", { memSize: 64 }).ramKb).toBe(16);
  });
});
