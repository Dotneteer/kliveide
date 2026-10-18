import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import {
  loadAddressOf,
  mapValue,
  parseZ88dkLocation,
  parseZ88dkMap,
  projectFileTest,
  unescapeMapName,
  z88dkBanks,
  z88dkLineDebug,
  z88dkLineRecords,
  z88dkSymbols
} from "@main/z88dk-integration/z88dk-map";

const FIXTURES = path.join(__dirname, "fixtures");
const mapOf = (fixture: string) => parseZ88dkMap(fs.readFileSync(path.join(FIXTURES, fixture, "program.map"), "utf8"));
const projectOf = (fixture: string) => projectFileTest([path.join(FIXTURES, fixture)], "/opt/z88dk");

describe("map lines", () => {
  it("reads every field of a line", () => {
    const [symbol] = parseZ88dkMap(
      "_add                            = $8303 ; addr, public, , main_c, code_compiler, main.c::add::0::0:9"
    );
    expect(symbol).toEqual({
      name: "_add",
      value: 0x8303,
      kind: "addr",
      scope: "public",
      linkerDefined: false,
      module: "main_c",
      section: "code_compiler",
      location: "main.c::add::0::0:9"
    });
  });

  it("reads linker-defined and banked values", () => {
    const symbols = parseZ88dkMap(
      ["__head                          = $8000 ; const, public, def, , ,", "_banked_add = $1C000 ; addr, public, , b1_c, BANK_1, b1.c::banked_add::0::0:5"].join("\n")
    );
    expect(symbols[0]).toMatchObject({ name: "__head", value: 0x8000, linkerDefined: true, location: "" });
    expect(symbols[1].value).toBe(0x1c000);
  });

  it("parses the whole zx-hello fixture", () => {
    const symbols = mapOf("zx-hello");
    expect(symbols.length).toBeGreaterThan(1000);
    expect(loadAddressOf(symbols)).toBe(0x8000);
    expect(mapValue(symbols, "_main")).toBeGreaterThan(0x8000);
  });
});

describe("names and locations", () => {
  it("unescapes both escaping schemes", () => {
    expect(unescapeMapName("main_2ec_3a_3aadd")).toBe("main.c::add");
    expect(unescapeMapName("S_3aLmain_2ec_2eadd_24s_24_31_5f_30")).toBe("S:Lmain.c.add$s$1_0");
  });

  it("reads plain and C locations, and Windows paths", () => {
    expect(parseZ88dkLocation("main.c::add::1::1:10")).toEqual({ file: "main.c", func: "add", level: 1, block: 1, line: 10 });
    expect(parseZ88dkLocation("/opt/z88dk/lib/target/zx/classic/spec_crt0.asm:105")).toEqual({
      file: "/opt/z88dk/lib/target/zx/classic/spec_crt0.asm",
      line: 105
    });
    expect(parseZ88dkLocation("C:\\proj\\main.c::main::0::2:15")).toMatchObject({ file: "C:\\proj\\main.c", func: "main", line: 15 });
    expect(parseZ88dkLocation("")).toBeUndefined();
  });
});

describe("line records", () => {
  it("keeps the project's C lines inside functions, and drops headers, the crt0 and declarations", () => {
    const records = z88dkLineRecords(mapOf("zx-hello"), path.join(FIXTURES, "zx-hello"), projectOf("zx-hello"));
    expect(new Set(records.map((r) => path.basename(r.file)))).toEqual(new Set(["main.c"]));
    expect(records.map((r) => r.line)).toEqual([9, 10, 11, 14, 15, 16, 17, 18, 19]);
    expect(records.every((r) => r.kind === "c" && r.func)).toBe(true);
    // --- Line 3 (`int counter;`) is outside every function
    expect(records.some((r) => r.line === 3)).toBe(false);
  });

  it("maps a shared address to the lowest line, but gives every line its list item", () => {
    const records = z88dkLineRecords(mapOf("zx-hello"), path.join(FIXTURES, "zx-hello"), projectOf("zx-hello"));
    const debug = z88dkLineDebug(records);
    const item = (line: number) => debug.listFileItems.find((i) => i.lineNumber === line)!;
    // --- sccz80 reads one line ahead: 16 and 17 share line 16's code, 18 and 19 line 18's
    expect(item(16).address).toBe(item(17).address);
    expect(debug.sourceMap[item(16).address].line).toBe(16);
    expect(item(18).address).toBe(item(19).address);
    expect(debug.sourceMap[item(18).address].line).toBe(18);
    expect(debug.listFileItems).toHaveLength(9);
    expect(debug.sourceFileList.map((f) => path.basename(f.filename))).toEqual(["main.c"]);
  });

  it("marks banked lines with their bank's partition and segment", () => {
    const symbols = mapOf("zx-banked");
    const records = z88dkLineRecords(symbols, path.join(FIXTURES, "zx-banked"), projectOf("zx-banked"));
    const banked = records.filter((r) => r.bank !== undefined);
    expect(banked.map((r) => [path.basename(r.file), r.bank])).toEqual(expect.arrayContaining([["bank1.c", 1]]));
    const debug = z88dkLineDebug(records, (bank) => bank, (bank) => (bank === 1 ? 1 : undefined));
    const item = debug.listFileItems.find((i) => i.partition === 1)!;
    expect(item).toMatchObject({ segmentIndex: 1 });
    expect(item.address).toBeGreaterThanOrEqual(0xc000);
    expect(z88dkBanks(symbols)).toEqual([{ bank: 1, address: 0xc000, size: fs.statSync(path.join(FIXTURES, "zx-banked", "program_BANK_1.bin")).size }]);
  });
});

describe("symbols", () => {
  it("names C symbols without their underscore and keeps the library's own names", () => {
    const folder = path.join(FIXTURES, "zx-hello");
    const table = z88dkSymbols(mapOf("zx-hello"), folder, projectOf("zx-hello"), () => 0);
    expect(table.counter).toMatchObject({ name: "counter", type: 2, definitionFileIndex: 0 });
    expect(table.main).toMatchObject({ name: "main", type: 1 });
    expect(table.add.value._value).toBe(mapValue(mapOf("zx-hello"), "_add"));
    expect(Object.keys(table).some((k) => k.startsWith("__c_line"))).toBe(false);
    expect(table.printf).toBeDefined();
  });
});

describe("projectFileTest", () => {
  it("accepts files under the project, not the install or temp folders", () => {
    const test = projectFileTest(["/home/u/proj"], "/opt/z88dk");
    expect(test("/home/u/proj/code/main.c")).toBe(true);
    expect(test("/opt/z88dk/include/stdio.h")).toBe(false);
    expect(test("/tmp/tmpklive.i")).toBe(false);
  });
});
