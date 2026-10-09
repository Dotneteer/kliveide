import { describe, expect, it } from "vitest";

import type { CliIo } from "../../src/cli/io";
import { runCli } from "../../src/cli/run-cli";
import { parseBreakpointOption, resolveAddress } from "../../src/cli/run/breakpoints";
import { inputKindOf } from "../../src/cli/run/inputs";
import { describeStop, parseDumpOption, registersOf } from "../../src/cli/verbs/run";
import { spectrumChordsOf } from "@common/headless/keyboard";
import { artifactNameOf, headlessUnsupportedMessage, HEADLESS_MACHINES } from "@common/headless/headlessMachines";
import { unsupportedMachineMessage } from "@main/unit-tests/unitTestMachines";

/*
 * `klive run`'s parsing and reporting, without a machine (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md`
 * §6 "Node unit"): the `--bp` subset of `bp-set`, `--keys`, `--dump-mem`, the input kinds, the
 * machines that run headless, and the usage errors that come before anything is built. The runs
 * themselves are in `klive-run-e2e.test.ts` (e2e tier).
 */

function captureIo(): { io: CliIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: {
      out: (t) => out.push(t),
      err: (t) => err.push(t),
      outBytes: () => {},
      writeFile: (f) => f,
      env: {},
      cwd: __dirname,
      isTty: false,
      waitForInterrupt: () => new Promise(() => {})
    }
  };
}

describe("klive run: --bp", () => {
  it("parses an address, a label, the access kinds and the filters", () => {
    expect(parseBreakpointOption("$8000")).toEqual({ address: 0x8000, exec: true });
    expect(parseBreakpointOption("Loop", { Loop: 0x8010 })).toEqual({ address: 0x8010, exec: true });
    expect(parseBreakpointOption("$5C00 -w -len 4")).toEqual({ address: 0x5c00, memoryWrite: true, length: 4 });
    expect(parseBreakpointOption("$FE -i -m $00FF")).toEqual({ address: 0xfe, ioRead: true, ioMask: 0xff });
    expect(parseBreakpointOption("$8000 -hit >=3 -once")).toMatchObject({ address: 0x8000, exec: true, oneShot: true, hitMode: "ge", hitCount: 3 });
    expect(parseBreakpointOption('$8000 -log "A={A} \\"x\\""')).toMatchObject({ logMessage: 'A={A} "x"' });
  });

  it("takes the rest of the text as the condition, as bp-set's -if does", () => {
    expect(parseBreakpointOption("$8000 -hit 2 -if A == 1 && !ZF")).toMatchObject({ hitMode: "eq", hitCount: 2, condition: "A == 1 && !ZF" });
  });

  it("refuses what it cannot set", () => {
    expect(() => parseBreakpointOption("")).toThrow(/needs an address/);
    expect(() => parseBreakpointOption("Nowhere")).toThrow(/labels need a project build/);
    expect(() => parseBreakpointOption("Nowhere", {})).toThrow(/neither a number nor a label/);
    expect(() => parseBreakpointOption("$8000 -x")).toThrow(/unknown option '-x'/);
    expect(() => parseBreakpointOption("$8000 -m 1")).toThrow(/I\/O breakpoint/);
    expect(() => parseBreakpointOption("$8000 -len 2")).toThrow(/memory breakpoint/);
    expect(() => parseBreakpointOption("$8000 -once -log x")).toThrow(/one-shot/);
    expect(() => parseBreakpointOption("$8000 -if")).toThrow(/needs a condition/);
    expect(() => parseBreakpointOption("$8000 -hit")).toThrow(/needs a hit rule/);
    expect(() => resolveAddress("$10000", undefined, "X")).toThrow(/between 0 and \$FFFF/);
  });
});

describe("klive run: --keys", () => {
  it("maps text to Spectrum key chords", () => {
    expect(spectrumChordsOf("p1 a\n")).toEqual([["P"], ["N1"], ["Space"], ["A"], ["Enter"]]);
    expect(spectrumChordsOf('"+,')).toEqual([["SShift", "P"], ["SShift", "K"], ["SShift", "N"]]);
    expect(spectrumChordsOf("{CS+5}{ss+p}{ENTER}{CShift+SShift}")).toEqual([["CShift", "N5"], ["SShift", "P"], ["Enter"], ["CShift", "SShift"]]);
  });

  it("names what it cannot type", () => {
    expect(() => spectrumChordsOf("~")).toThrow(/cannot type '~'/);
    expect(() => spectrumChordsOf("{CS+5")).toThrow(/unclosed/);
    expect(() => spectrumChordsOf("{Hyper}")).toThrow(/Unknown key 'Hyper'/);
  });
});

describe("klive run: inputs and outputs", () => {
  it("tells the input kinds apart by extension", () => {
    expect(inputKindOf("/p", true)).toBe("project");
    expect(inputKindOf("a.TAP", false)).toBe("tape");
    expect(inputKindOf("a.tzx", false)).toBe("tape");
    expect(inputKindOf("a.sna", false)).toBe("snapshot");
    expect(inputKindOf("a.Z80", false)).toBe("snapshot");
    expect(inputKindOf("a.szx", false)).toBe("snapshot");
    expect(inputKindOf("a.kls", false)).toBe("state");
    expect(inputKindOf("a.nex", false)).toBe("nex");
    expect(inputKindOf("a.P", false)).toBe("zxprogram");
    expect(inputKindOf("a.81", false)).toBe("zxprogram");
    expect(inputKindOf("a.o", false)).toBe("zxprogram");
    expect(inputKindOf("a.bin", false)).toBeUndefined();
  });

  it("parses --dump-mem", () => {
    expect(parseDumpOption("$C000:256=state.bin")).toEqual({ address: "$C000", length: "256", file: "state.bin" });
    expect(parseDumpOption("Counter=c.bin")).toEqual({ address: "Counter", file: "c.bin" });
    expect(() => parseDumpOption("$C000")).toThrow(/<addr>\[:<len>\]=<file>/);
  });

  it("reports the stop and the registers as cpu.get names them", () => {
    expect(describeStop({ reason: "breakpoint", pc: 0x8103, frames: 1, tstates: 70000, breakpoints: [] })).toBe(
      "stopped at $8103 (breakpoint) after 1 frame, 70,000 T-states"
    );
    expect(registersOf({ af: 0x1234, pc: 0x8000, iff1: 1, halted: false, tacts: 99 })).toMatchObject({
      af: 0x1234,
      pc: 0x8000,
      bc: 0,
      iff1: true,
      halted: false,
      tacts: 99
    });
  });

  it("runs the Spectrums, the Next and the ZX80/81 headless, and names the others", () => {
    expect(HEADLESS_MACHINES).toEqual(["sp48", "sp128", "spp3e", "zxnext", "zx80", "zx81"]);
    expect(artifactNameOf("zx81")).toBe("zx8081.wasm");
    expect(artifactNameOf("zx80")).toBe("zx8081.wasm");
    expect(headlessUnsupportedMessage("zx81")).toBeUndefined();
    expect(headlessUnsupportedMessage("z88")).toMatch(/Cambridge Z88/);
    // --- Unit tests still need code injection, which the ZX81 does not have
    expect(unsupportedMachineMessage("zx81")).toMatch(/Sinclair ZX81/);
  });
});

describe("klive run: usage errors before anything runs", () => {
  it("exits 3 with a message", async () => {
    const cases: [string[], RegExp][] = [
      [["run", "fixtures/run48"], /Say when the run stops/],
      [["run", "fixtures/run48", "--frames", "-1"], /--frames must be a whole number/],
      [["run", "fixtures/run48", "--timeout", "0"], /--timeout must be a positive number/],
      [["run", "fixtures/run48", "--frames", "1", "--dump-mem", "$C000"], /--dump-mem takes/],
      [["run", "a", "b", "--frames", "1"], /takes one project folder or file/],
      [["run", "nowhere.tap", "--frames", "1"], /does not exist/],
      [["run", "run-verb.test.ts", "--frames", "1"], /klive run starts a project folder or/],
      [["run", "--frames", "1", "--bogus"], /Unknown option --bogus/]
    ];
    for (const [argv, message] of cases) {
      const c = captureIo();
      expect(await runCli(argv, c.io), argv.join(" ")).toBe(3);
      expect(c.err[0], argv.join(" ")).toMatch(message);
    }
  });

  it("prints its help", async () => {
    const c = captureIo();
    expect(await runCli(["run", "--help"], c.io)).toBe(0);
    expect(c.out[0]).toMatch(/^Usage: klive run/);
    const top = captureIo();
    await runCli(["help"], top.io);
    expect(top.out[0]).toMatch(/run \[<dir\|file>\]/);
  });
});
