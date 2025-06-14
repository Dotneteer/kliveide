import { describe, it, expect } from "vitest";
import { createSjasmRunner } from "../../../src/script-packages/sjasm/sjasm";

describe("Sjasm - Arguments", () => {
  const validArgCases: { opts: Record<string, any>; exp: string | string[] }[] = [
    { opts: {}, exp: "" },
    { opts: { help: true }, exp: "-h" },
    { opts: { help: false }, exp: "" },
    { opts: { version: true }, exp: "--version" },
    { opts: { version: false }, exp: "" },
    { opts: { zxnext: "cspect" }, exp: "--zxnext=cspect" },
    { opts: { i8080: true }, exp: "--i8080" },
    { opts: { i8080: false }, exp: "" },
    { opts: { lr35902: true }, exp: "--lr35902" },
    { opts: { lr35902: false }, exp: "" },
    { opts: { outprefix: "some" }, exp: "--outprefix=some" },
    { opts: { inc: "some" }, exp: "--i=some" },
    { opts: { lst: "some" }, exp: "--lst=some" },
    { opts: { lstlab: "some" }, exp: "--lstlab=some" },
    { opts: { sym: "some" }, exp: "--sym=some" },
    { opts: { exp: "some" }, exp: "--exp=some" },
    { opts: { raw: "some" }, exp: "--raw=some" },
    { opts: { sld: "some" }, exp: "--sld=some" },
    { opts: { nologo: true }, exp: "--nologo" },
    { opts: { nologo: false }, exp: "" },
    { opts: { msg: "some" }, exp: "--msg=some" },
    { opts: { fullpath: "some" }, exp: "--fullpath=some" },
    { opts: { color: "some" }, exp: "--color=some" },
    { opts: { longptr: true }, exp: "--longptr" },
    { opts: { longptr: false }, exp: "" },
    { opts: { reversepop: true }, exp: "--reversepop" },
    { opts: { reversepop: false }, exp: "" },
    { opts: { dirbol: true }, exp: "--dirbol" },
    { opts: { dirbol: false }, exp: "" },
    { opts: { nofakes: true }, exp: "--nofakes" },
    { opts: { nofakes: false }, exp: "" },
    { opts: { dos866: true }, exp: "--dos866" },
    { opts: { dos866: false }, exp: "" },
    { opts: { syntax: "some" }, exp: "--syntax=some" },
  ];

  validArgCases.forEach((c, idx) =>
    it(`Sjasm args #${idx + 1}`, () => {
      // --- Arrange
      const sajsmp = createSjasmRunner({}, "", c.opts, ["file.c"]);

      // --- Act
      const options = sajsmp.composeCmdLineArgs();

      // --- Assert
      const expLength = typeof c.exp === "string" ? (c.exp.length ? 2 : 1) : c.exp.length + 1;
      expect(options.errors).toStrictEqual({});
      expect(options.args.length).toEqual(expLength);
      if (typeof c.exp === "string") {
        if (c.exp.length) {
          expect(options.args[0]).toEqual(c.exp);
        }
      } else {
        for (let i = 0; i < c.exp.length; i++) {
          expect(options.args[i]).toEqual(c.exp[i]);
        }
      }
      expect(options.args[options.args.length - 1]).toEqual("file.c");
    })
  );

  it("Sjasm with unknown option fails #1", () => {
    // --- Arrange
    const sjasm = createSjasmRunner({}, "", { unknown: true }, ["file.c"]);

    // --- Act
    const cmdLine = sjasm.composeCmdLineArgs();

    // --- Assert
    expect(Object.keys(cmdLine.errors).length).toBe(1);
    const unknown = cmdLine.errors.unknown;
    expect(unknown.length).toBe(1);
    expect(unknown[0].includes("unknown")).toBe(true);
  });

  it("Sjasm with unknown option fails #2", () => {
    // --- Arrange
    const sjasm = createSjasmRunner({}, "", { unknown1: true, other: false }, ["file.c"]);

    // --- Act
    const cmdLine = sjasm.composeCmdLineArgs();

    // --- Assert
    expect(Object.keys(cmdLine.errors).length).toBe(2);
    const unknown1 = cmdLine.errors.unknown1;
    expect(unknown1.length).toBe(1);
    expect(unknown1[0].includes("unknown1"));
    const other = cmdLine.errors.other;
    expect(other.length).toBe(1);
    expect(other[0].includes("other"));
  });

  it("bool option fails with number", () => {
    // --- Arrange
    const sjasm = createSjasmRunner({}, "", { i8080: 123 }, ["file.c"]);

    // --- Act
    const cmdLine = sjasm.composeCmdLineArgs();

    // --- Assert
    expect(Object.keys(cmdLine.errors).length).toBe(1);
    const i8080 = cmdLine.errors.i8080;
    expect(i8080.length).toBe(1);
    expect(i8080[0].includes("i8080")).toBe(true);
    expect(i8080[0].includes("i8080")).toBe(true);
  });

  it("bool option fails with string", () => {
    // --- Arrange
    const sjasm = createSjasmRunner({}, "", { i8080: "123" }, ["file.c"]);

    // --- Act
    const cmdLine = sjasm.composeCmdLineArgs();

    // --- Assert
    const i8080 = cmdLine.errors.i8080;
    expect(i8080.length).toBe(1);
    expect(i8080[0].includes("i8080")).toBe(true);
    expect(i8080[0].includes("i8080")).toBe(true);
  });
});
