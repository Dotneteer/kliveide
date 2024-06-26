import { describe, it, expect } from "vitest";
import { createZccRunner } from "../../../src/script-packages/z88dk/Zcc";

describe("Zcc - Arguments", () => {
  const validArgCases: { opts: Record<string, any>; exp: string | string[] }[] = [
    { opts: {}, exp: "" },
    { opts: { help: true }, exp: "-h" },
    { opts: { help: false }, exp: "" },
    { opts: { verbose: true }, exp: "-v" },
    { opts: { verbose: false }, exp: "" },
    { opts: { output: "border" }, exp: "-o=border" },
    { opts: { output: "border def" }, exp: '-o="border def"' },
    { opts: { specs: true }, exp: "-specs" },
    { opts: { specs: false }, exp: "" },
    { opts: { m8080: true }, exp: "-m8080" },
    { opts: { m8080: false }, exp: "" },
    { opts: { m8085: true }, exp: "-m8085" },
    { opts: { m8085: false }, exp: "" },
    { opts: { mz80: true }, exp: "-mz80" },
    { opts: { mz80: false }, exp: "" },
    { opts: { mz80_ixiy: true }, exp: "-mz80_ixiy" },
    { opts: { mz80_ixiy: false }, exp: "" },
    { opts: { mz80_strict: true }, exp: "-mz80_strict" },
    { opts: { mz80_strict: false }, exp: "" },
    { opts: { mz80n: true }, exp: "-mz80n" },
    { opts: { mz80n: false }, exp: "" },
    { opts: { mz180: true }, exp: "-mz180" },
    { opts: { mz180: false }, exp: "" },
    { opts: { mr2ka: true }, exp: "-mr2ka" },
    { opts: { mr2ka: false }, exp: "" },
    { opts: { mr3k: true }, exp: "-mr3k" },
    { opts: { mr3k: false }, exp: "" },
    { opts: { mr4k: true }, exp: "-mr4k" },
    { opts: { mr4k: false }, exp: "" },
    { opts: { mgbz80: true }, exp: "-mgbz80" },
    { opts: { mgbz80: false }, exp: "" },
    { opts: { mez80_z80: true }, exp: "-mez80_z80" },
    { opts: { mez80_z80: false }, exp: "" },
    { opts: { mkc160: true }, exp: "-mkc160" },
    { opts: { mkc160: false }, exp: "" },
    { opts: { subType: "st" }, exp: "-subtype=st" },
    { opts: { subType: "" }, exp: "" },
    { opts: { cLib: "cl" }, exp: "-clib=cl" },
    { opts: { cLib: "" }, exp: "" },
    { opts: { crt0: "c0" }, exp: "-crt0=c0" },
    { opts: { crt0: "" }, exp: "" },
    { opts: { startupLib: "stl" }, exp: "-startuplib=stl" },
    { opts: { startupLib: "" }, exp: "" },
    { opts: { noCrt: true }, exp: "-no-crt" },
    { opts: { noCrt: false }, exp: "" },
    { opts: { startupOffset: 1234 }, exp: "-startupoffset=1234" },
    { opts: { startup: 31 }, exp: "-startup=31" },
    { opts: { zOrg: 1234 }, exp: "-zorg=1234" },
    { opts: { noStdLib: true }, exp: "-nostdlib" },
    { opts: { pragmaRedirect: "AAA" }, exp: "-pragma-redirect=AAA" },
    {
      opts: { pragmaRedirect: ["AAA", "BBB"] },
      exp: ["-pragma-redirect=AAA", "-pragma-redirect=BBB"]
    },
    { opts: { pragmaDefine: "AAA" }, exp: "-pragma-define=AAA" },
    {
      opts: { pragmaDefine: ["AAA", "BBB"] },
      exp: ["-pragma-define=AAA", "-pragma-define=BBB"]
    },
    { opts: { pragmaOutput: "AAA" }, exp: "-pragma-output=AAA" },
    {
      opts: { pragmaOutput: ["AAA", "BBB"] },
      exp: ["-pragma-output=AAA", "-pragma-output=BBB"]
    },
    { opts: { pragmaExport: "AAA" }, exp: "-pragma-export=AAA" },
    {
      opts: { pragmaExport: ["AAA", "BBB"] },
      exp: ["-pragma-export=AAA", "-pragma-export=BBB"]
    },
    { opts: { pragmaNeed: "AAA" }, exp: "-pragma-need=AAA" },
    {
      opts: { pragmaNeed: ["AAA", "BBB"] },
      exp: ["-pragma-need=AAA", "-pragma-need=BBB"]
    },
    { opts: { pragmaBytes: "AAA" }, exp: "-pragma-bytes=AAA" },
    {
      opts: { pragmaBytes: ["AAA", "BBB"] },
      exp: ["-pragma-bytes=AAA", "-pragma-bytes=BBB"]
    },
    { opts: { pragmaString: "AAA" }, exp: "-pragma-string=AAA" },
    {
      opts: { pragmaString: ["AAA", "BBB"] },
      exp: ["-pragma-string=AAA", "-pragma-string=BBB"]
    },
    { opts: { pragmaInclude: "AAA" }, exp: "-pragma-include=AAA" },
    {
      opts: { pragmaInclude: ["AAA", "BBB"] },
      exp: ["-pragma-include=AAA", "-pragma-include=BBB"]
    },
    { opts: { m4: true }, exp: "-m4" },
    { opts: { m4: false }, exp: "" },
    { opts: { preprocessOnly: true }, exp: "-E" },
    { opts: { preprocessOnly: false }, exp: "" },
    { opts: { printMacroDefs: true }, exp: "-dD" },
    { opts: { printMacroDefs: false }, exp: "" },
    { opts: { compileOnly: true }, exp: "-c" },
    { opts: { compileOnly: false }, exp: "" },
    { opts: { assembleOnly: true }, exp: "-a" },
    { opts: { assembleOnly: false }, exp: "" },
    { opts: { makeLib: true }, exp: "-x" },
    { opts: { makeLib: false }, exp: "" },
    { opts: { explicitC: true }, exp: "-xc" },
    { opts: { explicitC: false }, exp: "" },
    { opts: { createApp: true }, exp: "-create-app" },
    { opts: { createApp: false }, exp: "" },
    { opts: { m4Opt: "AAA" }, exp: "-Cm=AAA" },
    { opts: { m4Opt: ["AAA", "BBB"] }, exp: ["-Cm=AAA", "-Cm=BBB"] },
    { opts: { copyBackAfterM4: true }, exp: "-copy-back-after-m4" },
    { opts: { copyBackAfterM4: false }, exp: "" },
    { opts: { addPreprocOpt: "AAA" }, exp: "-Cp=AAA" },
    { opts: { addPreprocOpt: ["AAA", "BBB"] }, exp: ["-Cp=AAA", "-Cp=BBB"] },
    { opts: { defPreprocOpt: "AAA" }, exp: "-D=AAA" },
    { opts: { defPreprocOpt: ["AAA", "BBB"] }, exp: ["-D=AAA", "-D=BBB"] },
    { opts: { undefPreprocOpt: "AAA" }, exp: "-U=AAA" },
    { opts: { undefPreprocOpt: ["AAA", "BBB"] }, exp: ["-U=AAA", "-U=BBB"] },
    { opts: { includePath: "AAA" }, exp: "-I=AAA" },
    { opts: { includePath: ["AAA", "BBB"] }, exp: ["-I=AAA", "-I=BBB"] },
    { opts: { includeQuote: "AAA" }, exp: "-iquote=AAA" },
    { opts: { includeQuote: ["AAA", "BBB"] }, exp: ["-iquote=AAA", "-iquote=BBB"] },
    { opts: { includeSystem: "AAA" }, exp: "-isystem=AAA" },
    {
      opts: { includeSystem: ["AAA", "BBB"] },
      exp: ["-isystem=AAA", "-isystem=BBB"]
    },
    { opts: { compiler: "sdcc" }, exp: "-compiler=sdcc" },
    { opts: { cCodeInAsm: true }, exp: "--c-code-in-asm" },
    { opts: { cCodeInAsm: false }, exp: "" },
    { opts: { optCodeSpeed: "all" }, exp: "--opt-code-speed=all" },
    {
      opts: { optCodeSpeed: ["cpu", "oth"] },
      exp: ["--opt-code-speed=cpu", "--opt-code-speed=oth"]
    },
    { opts: { debug: true }, exp: "-debug" },
    { opts: { debug: false }, exp: "" },
    { opts: { sccz80Option: "all" }, exp: "-Cc=all" },
    { opts: { sccz80Option: ["cpu", "oth"] }, exp: ["-Cc=cpu", "-Cc=oth"] },
    { opts: { setR2LByDefault: true }, exp: "-set-r2l-by-default" },
    { opts: { setR2LByDefault: false }, exp: "" },
    { opts: { copt: 123 }, exp: "-O=123" },
    { opts: { sccz80peepholeOpt: "all" }, exp: "-Ch=all" },
    { opts: { sccz80peepholeOpt: ["cpu", "oth"] }, exp: ["-Ch=cpu", "-Ch=oth"] },
    { opts: { sdccOption: "all" }, exp: "-Cs=all" },
    { opts: { sdccOption: ["cpu", "oth"] }, exp: ["-Cs=cpu", "-Cs=oth"] },
    { opts: { optCodeSize: 123 }, exp: "-opt-code-size=123" },
    { opts: { sdccPeepholeOpt: 123 }, exp: "-SO=123" },
    { opts: { fsignedChar: true }, exp: "-fsigned-char" },
    { opts: { fsignedChar: false }, exp: "" },
    { opts: { clangOption: "all" }, exp: "-Cg=all" },
    { opts: { clangOption: ["cpu", "oth"] }, exp: ["-Cg=cpu", "-Cg=oth"] },
    { opts: { clang: true }, exp: "-clang" },
    { opts: { clang: false }, exp: "" },
    { opts: { llvm: true }, exp: "-llvm" },
    { opts: { llvm: false }, exp: "" },
    { opts: { llvmOption: "all" }, exp: "-Co=all" },
    { opts: { llvmOption: ["cpu", "oth"] }, exp: ["-Co=cpu", "-Co=oth"] },
    { opts: { llvmCbeOption: "all" }, exp: "-Cv=all" },
    { opts: { llvmCbeOption: ["cpu", "oth"] }, exp: ["-Cv=cpu", "-Cv=oth"] },
    { opts: { zOpt: true }, exp: "-zopt" },
    { opts: { zOpt: false }, exp: "" },
    { opts: { asmOption: "all" }, exp: "-Ca=all" },
    { opts: { asmOption: ["cpu", "oth"] }, exp: ["-Ca=cpu", "-Ca=oth"] },
    { opts: { z80Verbose: true }, exp: "-z80-verb" },
    { opts: { z80Verbose: false }, exp: "" },
    { opts: { linkerOption: "all" }, exp: "-Cl=all" },
    { opts: { linkerOption: ["cpu", "oth"] }, exp: ["-Cl=cpu", "-Cl=oth"] },
    { opts: { libSearchPath: "all" }, exp: "-L=all" },
    { opts: { libSearchPath: ["cpu", "oth"] }, exp: ["-L=cpu", "-L=oth"] },
    { opts: { lib: "all" }, exp: "-l=all" },
    { opts: { lib: ["cpu", "oth"] }, exp: ["-l=cpu", "-l=oth"] },
    { opts: { linkerOutput: "out.lnk" }, exp: "-bn=out.lnk" },
    { opts: { relocInfo: true }, exp: "-reloc-info" },
    { opts: { relocInfo: false }, exp: "" },
    { opts: { genMapFile: true }, exp: "-gen-map-file" },
    { opts: { genMapFile: false }, exp: "" },
    { opts: { genSymFile: true }, exp: "-gen-sym-file" },
    { opts: { list: true }, exp: "--list" },
    { opts: { list: false }, exp: "" },
    { opts: { appMakeOption: "all" }, exp: "-Cz=all" },
    { opts: { appMakeOption: ["cpu", "oth"] }, exp: ["-Cz=cpu", "-Cz=oth"] },
    { opts: { globalDefC: "all" }, exp: "-g=all" },
    { opts: { alias: "all" }, exp: "-alias=all" },
    { opts: { alias: ["cpu", "oth"] }, exp: ["-alias=cpu", "-alias=oth"] },
    { opts: { listCwd: true }, exp: "--lstcwd" },
    { opts: { listCwd: false }, exp: "" },
    { opts: { customCoptRules: "all" }, exp: "-custom-copt-rules=all" },
    { opts: { swallowM: true }, exp: "-M" },
    { opts: { swallowM: false }, exp: "" },
    { opts: { cmdTracingOff: true }, exp: "-vn" },
    { opts: { cmdTracingOff: false }, exp: "" },
    { opts: { noCleanup: true }, exp: "-no-cleanup" },
    { opts: { noCleanup: false }, exp: "" }
  ];

  validArgCases.forEach((c, idx) =>
    it(`Zcc args #${idx + 1}`, () => {
      // --- Arrange
      const zcc = createZccRunner("", "zx", c.opts, ["file.c"]);

      // --- Act
      const options = zcc.composeCmdLineArgs();

      // --- Assert
      const expLength = typeof c.exp === "string" ? (c.exp.length ? 3 : 2) : c.exp.length + 2;
      expect(options.errors).toStrictEqual({});
      expect(options.args.length).toEqual(expLength);
      expect(options.args[0]).toEqual("+zx");
      if (typeof c.exp === "string") {
        if (c.exp.length) {
          expect(options.args[1]).toEqual(c.exp);
        }
      } else {
        for (let i = 0; i < c.exp.length; i++) {
          expect(options.args[i + 1]).toEqual(c.exp[i]);
        }
      }
      expect(options.args[options.args.length - 1]).toEqual("file.c");
    })
  );

  it("Zcc with unknown option fails #1", () => {
    // --- Arrange
    const zcc = createZccRunner("", "zx", { unknown: true }, ["file.c"]);

    // --- Act
    const cmdLine = zcc.composeCmdLineArgs();

    // --- Assert
    expect(Object.keys(cmdLine.errors).length).toBe(1);
    const unknown = cmdLine.errors.unknown;
    expect(unknown.length).toBe(1);
    expect(unknown[0].includes("unknown")).toBe(true);
  });

  it("Zcc with unknown option fails #2", () => {
    // --- Arrange
    const zcc = createZccRunner("", "zx", { unknown1: true, other: false }, ["file.c"]);

    // --- Act
    const cmdLine = zcc.composeCmdLineArgs();

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
    const zcc = createZccRunner("", "zx", { verbose: 123 }, ["file.c"]);

    // --- Act
    const cmdLine = zcc.composeCmdLineArgs();

    // --- Assert
    expect(Object.keys(cmdLine.errors).length).toBe(1);
    const verbose = cmdLine.errors.verbose;
    expect(verbose.length).toBe(1);
    expect(verbose[0].includes("verbose")).toBe(true);
    expect(verbose[0].includes("boolean")).toBe(true);
  });

  it("bool option fails with string", () => {
    // --- Arrange
    const zcc = createZccRunner("", "zx", { verbose: "123" }, ["file.c"]);

    // --- Act
    const cmdLine = zcc.composeCmdLineArgs();

    // --- Assert
    const verbose = cmdLine.errors.verbose;
    expect(verbose.length).toBe(1);
    expect(verbose[0].includes("verbose")).toBe(true);
    expect(verbose[0].includes("boolean")).toBe(true);
  });

  it("bool option fails with array", () => {
    // --- Arrange
    const zcc = createZccRunner("", "zx", { verbose: [123] }, ["file.c"]);

    // --- Act
    const cmdLine = zcc.composeCmdLineArgs();

    // --- Assert
    expect(Object.keys(cmdLine.errors).length).toBe(1);
    const verbose = cmdLine.errors.verbose;
    expect(verbose.length).toBe(1);
    expect(verbose[0].includes("verbose")).toBe(true);
    expect(verbose[0].includes("boolean")).toBe(true);
  });

  it("number option fails with bool", () => {
    // --- Arrange
    const zcc = createZccRunner("", "zx", { startup: true }, ["file.c"]);

    // --- Act
    const cmdLine = zcc.composeCmdLineArgs();

    // --- Assert
    expect(Object.keys(cmdLine.errors).length).toBe(1);
    const startup = cmdLine.errors.startup;
    expect(startup.length).toBe(1);
    expect(startup[0].includes("startup"));
    expect(startup[0].includes("number"));
  });

  it("number option fails with string", () => {
    // --- Arrange
    const zcc = createZccRunner("", "zx", { startup: "123" }, ["file.c"]);

    // --- Act
    const cmdLine = zcc.composeCmdLineArgs();

    // --- Assert
    expect(Object.keys(cmdLine.errors).length).toBe(1);
    const startup = cmdLine.errors.startup;
    expect(startup.length).toBe(1);
    expect(startup[0].includes("startup"));
    expect(startup[0].includes("number"));
  });

  it("number option fails with array", () => {
    // --- Arrange
    const zcc = createZccRunner("", "zx", { startup: ["123"] }, ["file.c"]);

    // --- Act
    const cmdLine = zcc.composeCmdLineArgs();

    // --- Assert
    expect(Object.keys(cmdLine.errors).length).toBe(1);
    const startup = cmdLine.errors.startup;
    expect(startup.length).toBe(1);
    expect(startup[0].includes("startup"));
    expect(startup[0].includes("number"));
  });

  it("string option fails with boolean", () => {
    // --- Arrange
    const zcc = createZccRunner("", "zx", { output: false }, ["file.c"]);

    // --- Act
    const cmdLine = zcc.composeCmdLineArgs();

    // --- Assert
    expect(Object.keys(cmdLine.errors).length).toBe(1);
    const output = cmdLine.errors.output;
    expect(output.length).toBe(1);
    expect(output[0].includes("output"));
    expect(output[0].includes("string"));
  });

  it("string option fails with number", () => {
    // --- Arrange
    const zcc = createZccRunner("", "zx", { output: 123 }, ["file.c"]);

    // --- Act
    const cmdLine = zcc.composeCmdLineArgs();

    // --- Assert
    expect(Object.keys(cmdLine.errors).length).toBe(1);
    const output = cmdLine.errors.output;
    expect(output.length).toBe(1);
    expect(output[0].includes("output"));
    expect(output[0].includes("string"));
  });

  it("string option fails with array", () => {
    // --- Arrange
    const zcc = createZccRunner("", "zx", { output: [false] }, ["file.c"]);

    // --- Act
    const cmdLine = zcc.composeCmdLineArgs();

    // --- Assert
    expect(Object.keys(cmdLine.errors).length).toBe(1);
    const output = cmdLine.errors.output;
    expect(output.length).toBe(1);
    expect(output[0].includes("output"));
    expect(output[0].includes("string"));
  });

  it("string array option fails with bool item #1", () => {
    // --- Arrange
    const zcc = createZccRunner("", "zx", { pragmaRedirect: [false] }, ["file.c"]);

    // --- Act
    const cmdLine = zcc.composeCmdLineArgs();

    // --- Assert
    expect(Object.keys(cmdLine.errors).length).toBe(1);
    const pragmaRedirect = cmdLine.errors.pragmaRedirect;
    expect(pragmaRedirect.length).toBe(1);
    expect(pragmaRedirect[0].includes("pragmaRedirect"));
    expect(pragmaRedirect[0].includes("array of strings"));
  });

  it("string array option fails with bool item #2", () => {
    // --- Arrange
    const zcc = createZccRunner("", "zx", { pragmaRedirect: ["pragma", false] }, ["file.c"]);

    // --- Act
    const cmdLine = zcc.composeCmdLineArgs();

    // --- Assert
    expect(Object.keys(cmdLine.errors).length).toBe(1);
    const pragmaRedirect = cmdLine.errors.pragmaRedirect;
    expect(pragmaRedirect.length).toBe(1);
    expect(pragmaRedirect[0].includes("pragmaRedirect"));
    expect(pragmaRedirect[0].includes("array of strings"));
  });

  it("string array option fails with number item #1", () => {
    // --- Arrange
    const zcc = createZccRunner("", "zx", { pragmaRedirect: [123] }, ["file.c"]);

    // --- Act
    const cmdLine = zcc.composeCmdLineArgs();

    // --- Assert
    expect(Object.keys(cmdLine.errors).length).toBe(1);
    const pragmaRedirect = cmdLine.errors.pragmaRedirect;
    expect(pragmaRedirect.length).toBe(1);
    expect(pragmaRedirect[0].includes("pragmaRedirect"));
    expect(pragmaRedirect[0].includes("array of strings"));
  });

  it("string array option fails with number item #2", () => {
    // --- Arrange
    const zcc = createZccRunner("", "zx", { pragmaRedirect: ["pragma", 123] }, ["file.c"]);

    // --- Act
    const cmdLine = zcc.composeCmdLineArgs();

    // --- Assert
    expect(Object.keys(cmdLine.errors).length).toBe(1);
    const pragmaRedirect = cmdLine.errors.pragmaRedirect;
    expect(pragmaRedirect.length).toBe(1);
    expect(pragmaRedirect[0].includes("pragmaRedirect"));
    expect(pragmaRedirect[0].includes("array of strings"));
  });
});
