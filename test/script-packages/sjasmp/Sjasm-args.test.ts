import { describe, it, expect } from "vitest";
import { createSjasmRunner } from "../../../src/script-packages/sjasm/sjasm";

describe("Sjasm - Arguments", () => {
  const validArgCases: { opts: Record<string, any>; exp: string | string[] }[] = [
    { opts: {}, exp: "" },
  ];

  validArgCases.forEach((c, idx) =>
    it(`Zcc args #${idx + 1}`, () => {
      // --- Arrange
      const sajsmp = createSjasmRunner("", c.opts, ["file.c"]);

      // --- Act
      const options = sajsmp.composeCmdLineArgs();

      // --- Assert
      const expLength = typeof c.exp === "string" ? (c.exp.length ? 1 : 0) : c.exp.length;
      expect(options.errors).toStrictEqual({});
      expect(options.args.length).toEqual(expLength);
      //expect(options.args[options.args.length - 1]).toEqual("file.c");
    })
  );

  // it("Zcc with unknown option fails #1", () => {
  //   // --- Arrange
  //   const zcc = createZccRunner("", "zx", { unknown: true }, ["file.c"]);

  //   // --- Act
  //   const cmdLine = zcc.composeCmdLineArgs();

  //   // --- Assert
  //   expect(Object.keys(cmdLine.errors).length).toBe(1);
  //   const unknown = cmdLine.errors.unknown;
  //   expect(unknown.length).toBe(1);
  //   expect(unknown[0].includes("unknown")).toBe(true);
  // });

  // it("Zcc with unknown option fails #2", () => {
  //   // --- Arrange
  //   const zcc = createZccRunner("", "zx", { unknown1: true, other: false }, ["file.c"]);

  //   // --- Act
  //   const cmdLine = zcc.composeCmdLineArgs();

  //   // --- Assert
  //   expect(Object.keys(cmdLine.errors).length).toBe(2);
  //   const unknown1 = cmdLine.errors.unknown1;
  //   expect(unknown1.length).toBe(1);
  //   expect(unknown1[0].includes("unknown1"));
  //   const other = cmdLine.errors.other;
  //   expect(other.length).toBe(1);
  //   expect(other[0].includes("other"));
  // });

  // it("bool option fails with number", () => {
  //   // --- Arrange
  //   const zcc = createZccRunner("", "zx", { verbose: 123 }, ["file.c"]);

  //   // --- Act
  //   const cmdLine = zcc.composeCmdLineArgs();

  //   // --- Assert
  //   expect(Object.keys(cmdLine.errors).length).toBe(1);
  //   const verbose = cmdLine.errors.verbose;
  //   expect(verbose.length).toBe(1);
  //   expect(verbose[0].includes("verbose")).toBe(true);
  //   expect(verbose[0].includes("boolean")).toBe(true);
  // });

  // it("bool option fails with string", () => {
  //   // --- Arrange
  //   const zcc = createZccRunner("", "zx", { verbose: "123" }, ["file.c"]);

  //   // --- Act
  //   const cmdLine = zcc.composeCmdLineArgs();

  //   // --- Assert
  //   const verbose = cmdLine.errors.verbose;
  //   expect(verbose.length).toBe(1);
  //   expect(verbose[0].includes("verbose")).toBe(true);
  //   expect(verbose[0].includes("boolean")).toBe(true);
  // });

  // it("bool option fails with array", () => {
  //   // --- Arrange
  //   const zcc = createZccRunner("", "zx", { verbose: [123] }, ["file.c"]);

  //   // --- Act
  //   const cmdLine = zcc.composeCmdLineArgs();

  //   // --- Assert
  //   expect(Object.keys(cmdLine.errors).length).toBe(1);
  //   const verbose = cmdLine.errors.verbose;
  //   expect(verbose.length).toBe(1);
  //   expect(verbose[0].includes("verbose")).toBe(true);
  //   expect(verbose[0].includes("boolean")).toBe(true);
  // });

  // it("number option fails with bool", () => {
  //   // --- Arrange
  //   const zcc = createZccRunner("", "zx", { startup: true }, ["file.c"]);

  //   // --- Act
  //   const cmdLine = zcc.composeCmdLineArgs();

  //   // --- Assert
  //   expect(Object.keys(cmdLine.errors).length).toBe(1);
  //   const startup = cmdLine.errors.startup;
  //   expect(startup.length).toBe(1);
  //   expect(startup[0].includes("startup"));
  //   expect(startup[0].includes("number"));
  // });

  // it("number option fails with string", () => {
  //   // --- Arrange
  //   const zcc = createZccRunner("", "zx", { startup: "123" }, ["file.c"]);

  //   // --- Act
  //   const cmdLine = zcc.composeCmdLineArgs();

  //   // --- Assert
  //   expect(Object.keys(cmdLine.errors).length).toBe(1);
  //   const startup = cmdLine.errors.startup;
  //   expect(startup.length).toBe(1);
  //   expect(startup[0].includes("startup"));
  //   expect(startup[0].includes("number"));
  // });

  // it("number option fails with array", () => {
  //   // --- Arrange
  //   const zcc = createZccRunner("", "zx", { startup: ["123"] }, ["file.c"]);

  //   // --- Act
  //   const cmdLine = zcc.composeCmdLineArgs();

  //   // --- Assert
  //   expect(Object.keys(cmdLine.errors).length).toBe(1);
  //   const startup = cmdLine.errors.startup;
  //   expect(startup.length).toBe(1);
  //   expect(startup[0].includes("startup"));
  //   expect(startup[0].includes("number"));
  // });

  // it("string option fails with boolean", () => {
  //   // --- Arrange
  //   const zcc = createZccRunner("", "zx", { output: false }, ["file.c"]);

  //   // --- Act
  //   const cmdLine = zcc.composeCmdLineArgs();

  //   // --- Assert
  //   expect(Object.keys(cmdLine.errors).length).toBe(1);
  //   const output = cmdLine.errors.output;
  //   expect(output.length).toBe(1);
  //   expect(output[0].includes("output"));
  //   expect(output[0].includes("string"));
  // });

  // it("string option fails with number", () => {
  //   // --- Arrange
  //   const zcc = createZccRunner("", "zx", { output: 123 }, ["file.c"]);

  //   // --- Act
  //   const cmdLine = zcc.composeCmdLineArgs();

  //   // --- Assert
  //   expect(Object.keys(cmdLine.errors).length).toBe(1);
  //   const output = cmdLine.errors.output;
  //   expect(output.length).toBe(1);
  //   expect(output[0].includes("output"));
  //   expect(output[0].includes("string"));
  // });

  // it("string option fails with array", () => {
  //   // --- Arrange
  //   const zcc = createZccRunner("", "zx", { output: [false] }, ["file.c"]);

  //   // --- Act
  //   const cmdLine = zcc.composeCmdLineArgs();

  //   // --- Assert
  //   expect(Object.keys(cmdLine.errors).length).toBe(1);
  //   const output = cmdLine.errors.output;
  //   expect(output.length).toBe(1);
  //   expect(output[0].includes("output"));
  //   expect(output[0].includes("string"));
  // });

  // it("string array option fails with bool item #1", () => {
  //   // --- Arrange
  //   const zcc = createZccRunner("", "zx", { pragmaRedirect: [false] }, ["file.c"]);

  //   // --- Act
  //   const cmdLine = zcc.composeCmdLineArgs();

  //   // --- Assert
  //   expect(Object.keys(cmdLine.errors).length).toBe(1);
  //   const pragmaRedirect = cmdLine.errors.pragmaRedirect;
  //   expect(pragmaRedirect.length).toBe(1);
  //   expect(pragmaRedirect[0].includes("pragmaRedirect"));
  //   expect(pragmaRedirect[0].includes("array of strings"));
  // });

  // it("string array option fails with bool item #2", () => {
  //   // --- Arrange
  //   const zcc = createZccRunner("", "zx", { pragmaRedirect: ["pragma", false] }, ["file.c"]);

  //   // --- Act
  //   const cmdLine = zcc.composeCmdLineArgs();

  //   // --- Assert
  //   expect(Object.keys(cmdLine.errors).length).toBe(1);
  //   const pragmaRedirect = cmdLine.errors.pragmaRedirect;
  //   expect(pragmaRedirect.length).toBe(1);
  //   expect(pragmaRedirect[0].includes("pragmaRedirect"));
  //   expect(pragmaRedirect[0].includes("array of strings"));
  // });

  // it("string array option fails with number item #1", () => {
  //   // --- Arrange
  //   const zcc = createZccRunner("", "zx", { pragmaRedirect: [123] }, ["file.c"]);

  //   // --- Act
  //   const cmdLine = zcc.composeCmdLineArgs();

  //   // --- Assert
  //   expect(Object.keys(cmdLine.errors).length).toBe(1);
  //   const pragmaRedirect = cmdLine.errors.pragmaRedirect;
  //   expect(pragmaRedirect.length).toBe(1);
  //   expect(pragmaRedirect[0].includes("pragmaRedirect"));
  //   expect(pragmaRedirect[0].includes("array of strings"));
  // });

  // it("string array option fails with number item #2", () => {
  //   // --- Arrange
  //   const zcc = createZccRunner("", "zx", { pragmaRedirect: ["pragma", 123] }, ["file.c"]);

  //   // --- Act
  //   const cmdLine = zcc.composeCmdLineArgs();

  //   // --- Assert
  //   expect(Object.keys(cmdLine.errors).length).toBe(1);
  //   const pragmaRedirect = cmdLine.errors.pragmaRedirect;
  //   expect(pragmaRedirect.length).toBe(1);
  //   expect(pragmaRedirect[0].includes("pragmaRedirect"));
  //   expect(pragmaRedirect[0].includes("array of strings"));
  // });
});
