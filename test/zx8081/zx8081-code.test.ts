import { describe, expect, it } from "vitest";

import { parseZxProgramFile } from "@emu/machines/zx8081/ZxPFile";
import {
  zx8081ExportFile,
  zx8081ExportFormatOf,
  zx8081InjectionProblem
} from "@renderer/appIde/utils/zx8081-code";

/** The IDE's check before it sends built code to a ZX80/ZX81 (`.plans/ZX8081_CODE_INJECTION_PLAN.md` D4) */
const seg = (startAddress: number, length = 1) => ({ startAddress, emittedCode: new Array(length).fill(0xc9) });

describe("zx8081InjectionProblem", () => {
  it("does not look at other machines", () => {
    expect(zx8081InjectionProblem("sp48", {}, [seg(0x4040)], undefined)).toBeUndefined();
  });

  it("accepts code in the REM body", () => {
    expect(zx8081InjectionProblem("zx81", {}, [seg(0x4082)], undefined)).toBeUndefined();
    expect(zx8081InjectionProblem("zx80", {}, [seg(0x402b)], undefined)).toBeUndefined();
  });

  it("reports code the machine cannot lay out", () => {
    expect(zx8081InjectionProblem("zx81", {}, [seg(0x4040)], undefined)).toMatch(/system variables/);
  });

  it("checks the fit against the machine's RAM", () => {
    expect(zx8081InjectionProblem("zx81", { memSize: 1 }, [seg(0x4082, 900)], undefined)).toMatch(/1K ZX81/);
    expect(zx8081InjectionProblem("zx81", { memSize: 16 }, [seg(0x4082, 900)], undefined)).toBeUndefined();
  });

  it("lays out ZX81 code on a ZX80 with the 8K ROM", () => {
    // --- $4082 is past the ZX80's REM body too, but a $76 would only be refused by the ZX80 layout
    expect(zx8081InjectionProblem("zx80", { zx80Rom8K: true }, [{ startAddress: 0x4082, emittedCode: [0x76] }], undefined)).toBeUndefined();
    expect(zx8081InjectionProblem("zx80", {}, [{ startAddress: 0x4082, emittedCode: [0x76] }], undefined)).toMatch(/\$76/);
  });

  it("refuses debugging a unit test", () => {
    expect(zx8081InjectionProblem("zx81", {}, [seg(0x4082)], undefined, true)).toMatch(/unit test/);
  });
});

describe("ZX80/ZX81 export", () => {
  it("picks the format from .model, else from the running machine's ROM", () => {
    expect(zx8081ExportFormatOf(6, "sp48", {})).toBe("p");
    expect(zx8081ExportFormatOf(5, undefined, undefined)).toBe("o");
    expect(zx8081ExportFormatOf(1, "zx81", {})).toBeUndefined();
    expect(zx8081ExportFormatOf(undefined, "zx81", {})).toBe("p");
    expect(zx8081ExportFormatOf(undefined, "zx80", {})).toBe("o");
    expect(zx8081ExportFormatOf(undefined, "zx80", { zx80Rom8K: true })).toBe("p");
    expect(zx8081ExportFormatOf(undefined, "sp48", {})).toBeUndefined();
  });

  it("writes a .p file that runs itself when asked to", () => {
    const build = { modelType: 6, segments: [seg(0x4082)] };
    const auto = zx8081ExportFile("p", build, "zx81", {}, true);
    const plain = zx8081ExportFile("p", build, "zx81", {}, false);
    if ("error" in auto || "error" in plain) throw new Error("unexpected error");
    const nxtlin = (d: Uint8Array) => d[0x4029 - 0x4009] | (d[0x402a - 0x4009] << 8);
    expect(nxtlin(auto.data)).toBe(0x407d + 7);
    expect(nxtlin(plain.data)).not.toBe(0x407d + 7);
    expect(parseZxProgramFile(auto.data, "x.p")?.isZx81).toBe(true);
  });

  it("writes an .o file", () => {
    const file = zx8081ExportFile("o", { modelType: 5, segments: [seg(0x402b)] }, "sp48", {}, false);
    if ("error" in file) throw new Error(file.error);
    expect(parseZxProgramFile(file.data, "x.o")?.isZx81).toBe(false);
  });

  it("refuses a format that does not match the build's model", () => {
    expect(zx8081ExportFile("o", { modelType: 6, segments: [seg(0x4082)] }, "zx81", {}, false)).toEqual({
      error: "An .o file holds a ZX80 program: assemble the code with .model ZX80."
    });
    expect(zx8081ExportFile("p", { modelType: 1, segments: [seg(0x4082)] }, "sp48", {}, false)).toHaveProperty("error");
  });

  it("checks the fit against the running machine's RAM, else 16K", () => {
    const big = { modelType: 6, segments: [seg(0x4082, 900)] };
    expect(zx8081ExportFile("p", big, "zx81", { memSize: 1 }, false)).toHaveProperty("error");
    expect(zx8081ExportFile("p", big, "sp48", {}, false)).toHaveProperty("data");
  });
});
