import { describe, expect, it } from "vitest";

import { parseArgs, parseLocation, parseNumber, parseSeconds } from "../../src/cli/args";
import { CliError, exitCodeOfRpcError } from "../../src/cli/exit-codes";
import { describeMachineState, gccDiagnostic, hexDump } from "../../src/cli/format";
import { launchCommand } from "../../src/cli/rpc/launch";

/*
 * The CLI's pure parts (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` §6): argument parsing, exit-code
 * mapping and formatting.
 */

describe("cli arguments", () => {
  it("parses long options, values and repeats; single-dash words stay positional", () => {
    expect(parseArgs(["a", "--flag", "--v", "1", "--r=x", "--r", "y", "-if"], { flags: ["flag"], values: ["v"], repeatable: ["r"] })).toEqual({
      positional: ["a", "-if"],
      options: { flag: true, v: "1", r: ["x", "y"] }
    });
    expect(parseArgs(["--", "--not-an-option"], {})).toEqual({ positional: ["--not-an-option"], options: {} });
  });

  it("rejects unknown options and missing values with exit 3", () => {
    expect(() => parseArgs(["--nope"], {})).toThrow(CliError);
    expect(() => parseArgs(["--v"], { values: ["v"] })).toThrow("--v needs a value.");
    expect(() => parseArgs(["--flag=1"], { flags: ["flag"] })).toThrow("takes no value");
    try {
      parseArgs(["--nope"], {});
    } catch (err) {
      expect((err as CliError).exitCode).toBe(3);
    }
  });

  it("reads the IDE's number notations", () => {
    expect(parseNumber("$8000")).toBe(0x8000);
    expect(parseNumber("0x8000")).toBe(0x8000);
    expect(parseNumber("#8000")).toBe(0x8000);
    expect(parseNumber("8000h")).toBe(0x8000);
    expect(parseNumber("%1010")).toBe(10);
    expect(parseNumber("32_768")).toBe(32768);
    expect(parseNumber("x")).toBeUndefined();
  });

  it("reads a location as an address or a partition and offset (T8)", () => {
    expect(parseLocation("$5C00")).toEqual({ address: 0x5c00 });
    expect(parseLocation("b5:$0100")).toEqual({ partition: "B5", offset: 0x100 });
    expect(() => parseLocation("$10000")).toThrow(CliError);
    expect(parseSeconds("1.5")).toBe(1500);
    expect(() => parseSeconds("0")).toThrow(CliError);
  });
});

describe("cli exit codes", () => {
  it("maps the server's error kinds (D12)", () => {
    const e = (kind: string) => ({ code: -32000, message: "", data: { kind } as any });
    expect(exitCodeOfRpcError(e("level-too-low"))).toBe(3);
    expect(exitCodeOfRpcError(e("unauthorized"))).toBe(3);
    expect(exitCodeOfRpcError(e("no-project"))).toBe(3);
    expect(exitCodeOfRpcError(e("command-denied"))).toBe(3);
    expect(exitCodeOfRpcError(e("command-failed"))).toBe(1);
    expect(exitCodeOfRpcError(e("timeout"), "machine.wait")).toBe(5);
    expect(exitCodeOfRpcError(e("timeout"), "project.build")).toBe(4);
    expect(exitCodeOfRpcError(e("not-ready"))).toBe(4);
    expect(exitCodeOfRpcError({ code: -32601, message: "" })).toBe(3);
    expect(exitCodeOfRpcError({ code: -32602, message: "" })).toBe(3);
    expect(exitCodeOfRpcError({ code: -32603, message: "" })).toBe(4);
  });
});

describe("cli formatting", () => {
  it("writes diagnostics in the gcc format", () => {
    expect(gccDiagnostic({ file: "a.asm", line: 3, column: 7, code: "Z0101", message: "Bad" })).toBe("a.asm:3:7: error: Z0101: Bad");
    expect(gccDiagnostic({ file: "a.asm", line: 3, message: "Hm", warning: true })).toBe("a.asm:3:1: warning: Hm");
  });

  it("describes machine states", () => {
    expect(describeMachineState({ state: "running" })).toBe("running");
    expect(describeMachineState({ state: "paused", pc: 0x8103 })).toBe("paused at $8103");
    expect(describeMachineState({ state: "paused", pc: 0x8103, breakpoint: { address: 0x9000, kind: "write" } })).toBe(
      "paused at $8103 (write breakpoint at $9000)"
    );
  });

  it("dumps memory 16 bytes a line", () => {
    const lines = hexDump(new Uint8Array(20).fill(0x41), 0x4000);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("$4000  41 41 41 41 41 41 41 41 41 41 41 41 41 41 41 41  |AAAAAAAAAAAAAAAA|");
    expect(lines[1]).toBe(`$4010  ${"41 41 41 41".padEnd(47)}  |AAAA|`);
  });
});

describe("cli --launch (T1)", () => {
  it("launches KLIVE_APP with --automation --noide", () => {
    expect(launchCommand({ KLIVE_APP: "/Applications/Klive.app/Contents/MacOS/Klive" })).toEqual({
      command: "/Applications/Klive.app/Contents/MacOS/Klive",
      args: ["--automation", "--noide"]
    });
  });

  it("cannot tell where Klive is under plain Node without KLIVE_APP", () => {
    if (process.versions.electron) return;
    expect(launchCommand({})).toBeUndefined();
  });
});
