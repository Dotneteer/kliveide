import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import { parseZ80File } from "@common/spectrum/snapshot/z80File";
import { CurrentStatementTracker, locateActivations, SourceDebugIndex, type MachineView, type SourceStep } from "@emu/machines/SourceStepDecision";
import { ZxSpectrum128WasmHost } from "@emu/machines/zxSpectrum128/ZxSpectrum128WasmHost";
import { bankedSegments, extractBankedProgram, programBankIds } from "@main/boriel-integration/boriel-banked";
import { parseMemoryMap } from "@main/boriel-integration/boriel-map";
import { adaptBorielDebugInfo } from "@main/boriel-integration/dbg-adapter";
import { loadNexFileContents } from "@renderer/appIde/DocumentPanels/Next/nexFileLoader";

import { createSp128Session } from "../harness/sp128";
import { createSession } from "../harness/zxnext";

/*
 * Banked Boriel BASIC programs (`--split-modules`, `.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §7) on
 * the real 128K and Next cores. The fixture's three table modules fill two banks; `Sum` (first bank)
 * and `Peek3` (second bank) start at the same window address, so only the partition tells their
 * breakpoints apart. Every call from the main program into a module is a far call through zxbc's
 * paging helper, whose shadow stack the frame locator reads to walk the call stack back out.
 */

const FIXTURES = path.join(__dirname, "fixtures");
const ORG = 0x8000;

type Program = {
  info: SourceLevelDebugInfo;
  segments: ReturnType<typeof bankedSegments>;
  dbg: any;
};

/** A fixture's program, extracted from zxbc's output as `BorielCompiler` does, and its debug data. */
function load(name: string, arch: "zx128k" | "zxnext"): Program {
  const folder = path.join(FIXTURES, name);
  const dbg = JSON.parse(fs.readFileSync(path.join(folder, "program.dbg"), "utf8"));
  const ram =
    arch === "zxnext"
      ? new Map(loadNexFileContents(new Uint8Array(fs.readFileSync(path.join(folder, "program.nex")))).fileInfo!.bankData)
      : parseZ80File(new Uint8Array(fs.readFileSync(path.join(folder, "program.z80")))).ram;
  const parts = extractBankedProgram(ram, ORG, programBankIds(dbg.sourceLevelDebug.extensions.codebank, arch), dbg.binaryLength, dbg.binaryChecksum);
  if (typeof parts === "string") throw new Error(parts);
  const resident = parts.find((p) => p.bank === undefined)!;
  const adapted = adaptBorielDebugInfo({
    dbg,
    map: parseMemoryMap(fs.readFileSync(path.join(folder, "program.map"), "utf8")),
    arch,
    baseFolder: folder,
    optimizationLevel: 1,
    image: { bytes: resident.bytes, origin: ORG },
    bankImages: parts
      .filter((p) => p.bank !== undefined)
      .map((p) => ({ partition: arch === "zxnext" ? p.bank! * 2 : p.bank!, bytes: p.bytes, origin: p.startAddress })),
    readFile: (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined)
  });
  expect(adapted.problems).toEqual([]);
  return { info: adapted.sourceLevelDebug, segments: bankedSegments(parts), dbg };
}

const callable = (info: SourceLevelDebugInfo, name: string) => info.callables.find((c) => c.name === name)!;

/** The breakpoints: each module routine's first statement, in its own partition. */
function routineBreakpoints(info: SourceLevelDebugInfo, names: string[]) {
  return names.map((name) => {
    const c = callable(info, name);
    const s = info.statements[c.firstStatementIndex];
    return { name, address: s.startAddress, partition: s.partition };
  });
}

type Session = {
  continueToBreakpoint: (o: { maxFrames?: number }) => number;
  machineView: () => MachineView;
};

/** Runs to each breakpoint in turn, recording where it stopped and the call stack there. */
function stops(session: Session, info: SourceLevelDebugInfo, count: number) {
  const index = new SourceDebugIndex(info, false);
  const out: { pc: number; partition?: number; chain: string[] }[] = [];
  for (let i = 0; i < count; i++) {
    const pc = session.continueToBreakpoint({ maxFrames: 300 });
    const view = session.machineView();
    out.push({
      pc,
      partition: index.partitionNow(view, pc),
      chain: locateActivations(index, view).map((a) => info.callables[a.callableIndex].name)
    });
  }
  return out;
}

const ROUTINES = ["Sum", "Weigh", "Mix", "Peek3"];

describe("banked Boriel BASIC programs", () => {
  it("finds the resident code and both banks in the 128K snapshot, as the checksum confirms", () => {
    const { segments, info } = load("banked-128", "zx128k");
    expect(segments.map((s) => s.bank)).toEqual([undefined, 0, 1]);
    expect(segments[0].startAddress).toBe(ORG);
    expect(segments.slice(1).every((s) => s.startAddress === 0xc000 && s.bankOffset === 0)).toBe(true);
    // --- The two routines the test tells apart by partition alone
    const frameStart = (name: string) => info.extensions!.frames!.find((f) => f.callableIndex === callable(info, name).index)!.startAddress;
    expect(frameStart("Sum")).toBe(frameStart("Peek3"));
    expect([callable(info, "Sum").partition, callable(info, "Peek3").partition]).toEqual([0, 1]);
    expect(info.extensions?.codebank).toMatchObject({ shadowStackKind: "zxbc", bankMask: 0x07, window: 0xc000, windowSize: 0x4000 });
  });

  it("stops in the right bank and walks the call stack through far calls on the 128K", async () => {
    const { info, segments } = load("banked-128", "zx128k");
    const session = await createSp128Session("sp128");
    // --- The IDE's own route: the 128K's injection flow into 128 BASIC (no paging lock), then the code
    const flow = await ZxSpectrum128WasmHost.prototype.getCodeInjectionFlow.call(session.machine, "sp128");
    session.runFlow(flow, {
      checkRom: false,
      code: { model: "sp128", entryAddress: ORG, subroutine: true, options: {}, segments } as any
    });
    expect(session.paging().locked).toBe(false);
    const debug = session.attachDebugSupport();
    debug.statementTracker = new CurrentStatementTracker(new SourceDebugIndex(info, false));
    const bps = routineBreakpoints(info, ROUTINES);
    for (const bp of bps) debug.addBreakpoint({ address: bp.address, partition: bp.partition, exec: true });

    const seen = stops(session, info, 4);
    expect(seen.map((s) => [s.pc, s.partition])).toEqual(bps.map((b) => [b.address, b.partition]));
    expect(seen.map((s) => s.chain)).toEqual([
      ["Sum", "main"],
      ["Weigh", "main"],
      ["Mix", "Weigh", "main"],
      ["Peek3", "main"]
    ]);

    // --- And the program finishes with the right total, 98 + 166 + 47 (runFrames is not a debug run)
    session.runFrames(50);
    expect(session.screenText().replace(/\s+/g, "")).toContain("311");
  }, 120_000);

  it("finds the resident code and both banks in the Next's .nex", () => {
    const { segments, info } = load("banked-next", "zxnext");
    // --- 16K banks 16 and 17: the .dbg's pages 32-35
    expect(segments.map((s) => s.bank)).toEqual([undefined, 16, 17]);
    expect([callable(info, "Sum").partition, callable(info, "Peek3").partition]).toEqual([32, 34]);
    // --- Mix starts past $E000: its code is in the bank's second page
    expect(callable(info, "Mix").partition).toBe(33);
    expect(info.extensions?.codebank).toMatchObject({ shadowStackKind: "zxbc", bankMask: 0xff });
  });

  it("stops in the right page and walks the call stack through far calls on the Next", async () => {
    const { info } = load("banked-next", "zxnext");
    const session = await createSession();
    await session.prepareBasic();
    await session.loadProgramFile(path.join(FIXTURES, "banked-next", "program.nex"));
    const debug = session.attachDebugSupport();
    debug.statementTracker = new CurrentStatementTracker(new SourceDebugIndex(info, false));
    const bps = routineBreakpoints(info, ROUTINES);
    for (const bp of bps) debug.addBreakpoint({ address: bp.address, partition: bp.partition, exec: true });

    const seen = stops(session, info, 4);
    expect(seen.map((s) => [s.pc, s.partition])).toEqual(bps.map((b) => [b.address, b.partition]));
    expect(seen.map((s) => s.chain)).toEqual([
      ["Sum", "main"],
      ["Weigh", "main"],
      ["Mix", "Weigh", "main"],
      ["Peek3", "main"]
    ]);
  }, 120_000);

  describe("stepping across far calls (Step Into, Over and Out through zxbc's paging helper)", () => {
    type StepSession = Session & {
      sourceStep: (index: SourceDebugIndex, kind: "into" | "over" | "out", o?: { maxFrames?: number }) => SourceStep | undefined;
    };

    /** Where a step stopped: how, the statement's file and line, and the routine it is in. */
    const describeStop = (info: SourceLevelDebugInfo, step: SourceStep | undefined) => {
      if (!step?.stoppedAt || step.stopStatement === undefined || step.stopStatement < 0) return undefined;
      const s = info.statements[step.stopStatement];
      return {
        how: step.stoppedAt,
        file: path.basename(info.files[s.fileIndex].filename),
        line: s.startLine,
        routine: info.callables[s.callableIndex].name
      };
    };

    /** The same walk on either machine: main's three far calls, then a step inside a bank. */
    function walk(session: StepSession, info: SourceLevelDebugInfo, debug: { addBreakpoint: Function; removeBreakpoint: Function }) {
      const index = new SourceDebugIndex(info, false);
      const step = (kind: "into" | "over" | "out") => describeStop(info, session.sourceStep(index, kind, { maxFrames: 300 }));
      const main = (line: number) => info.statements.find((s) => s.startLine === line && info.callables[s.callableIndex].kind === "entrypoint")!;

      // --- Start at `total = big1.Sum(4)`: its call goes far, into the first bank
      const first = { address: main(9).startAddress, exec: true };
      debug.addBreakpoint(first);
      session.continueToBreakpoint({ maxFrames: 300 });
      debug.removeBreakpoint(first);

      expect(step("into")).toEqual({ how: "statement", file: "big1.bas", line: callable(info, "Sum").startLine + 3, routine: "Sum" });
      expect(step("out")).toEqual({ how: "returnPoint", file: "program.bas", line: 9, routine: "main" });
      expect(step("over")).toEqual({ how: "statement", file: "program.bas", line: 10, routine: "main" });
      // --- Weigh goes far, and calls Mix inside its bank: Step Over runs all of it
      expect(step("over")).toEqual({ how: "statement", file: "program.bas", line: 11, routine: "main" });
      // --- Peek3 is in the second bank, at the same window address as Sum
      expect(step("into")).toEqual({ how: "statement", file: "big3.bas", line: callable(info, "Peek3").startLine + 1, routine: "Peek3" });
      expect(step("out")).toEqual({ how: "returnPoint", file: "program.bas", line: 11, routine: "main" });
    }

    /** Inside the bank: Weigh's call of Mix is a plain CALL there. */
    function walkInBank(session: StepSession, info: SourceLevelDebugInfo, debug: { addBreakpoint: Function; removeBreakpoint: Function }) {
      const index = new SourceDebugIndex(info, false);
      const step = (kind: "into" | "over" | "out") => describeStop(info, session.sourceStep(index, kind, { maxFrames: 300 }));
      const weigh = info.statements[callable(info, "Weigh").firstStatementIndex];
      const bp = { address: weigh.startAddress, partition: weigh.partition, exec: true };
      debug.addBreakpoint(bp);
      session.continueToBreakpoint({ maxFrames: 300 });
      debug.removeBreakpoint(bp);

      // --- `w = shade.Mix(table(k), k)`: Step Into enters Mix, Step Out returns into Weigh
      expect(step("into")).toEqual({ how: "statement", file: "shade.bas", line: callable(info, "Mix").startLine + 2, routine: "Mix" });
      expect(step("out")).toMatchObject({ how: "returnPoint", file: "big2.bas", routine: "Weigh" });
      // --- Then on to Weigh's RETURN, and out of the bank back into main
      expect(step("over")).toMatchObject({ how: "statement", file: "big2.bas", routine: "Weigh" });
      expect(step("out")).toEqual({ how: "returnPoint", file: "program.bas", line: 10, routine: "main" });
    }

    async function sp128Session() {
      const { info, segments } = load("banked-128", "zx128k");
      const session = await createSp128Session("sp128");
      const flow = await ZxSpectrum128WasmHost.prototype.getCodeInjectionFlow.call(session.machine, "sp128");
      session.runFlow(flow, { checkRom: false, code: { model: "sp128", entryAddress: ORG, subroutine: true, options: {}, segments } as any });
      const debug = session.attachDebugSupport();
      debug.statementTracker = new CurrentStatementTracker(new SourceDebugIndex(info, false));
      return { session: session as unknown as StepSession, info, debug };
    }

    async function nextSession() {
      const { info } = load("banked-next", "zxnext");
      const session = await createSession();
      await session.prepareBasic();
      await session.loadProgramFile(path.join(FIXTURES, "banked-next", "program.nex"));
      const debug = session.attachDebugSupport();
      debug.statementTracker = new CurrentStatementTracker(new SourceDebugIndex(info, false));
      return { session: session as unknown as StepSession, info, debug };
    }

    it("steps into, out of and over far calls from the main program on the 128K", async () => {
      const { session, info, debug } = await sp128Session();
      walk(session, info, debug);
    }, 120_000);

    it("steps inside a bank and out of it on the 128K", async () => {
      const { session, info, debug } = await sp128Session();
      walkInBank(session, info, debug);
    }, 120_000);

    it("steps into, out of and over far calls from the main program on the Next", async () => {
      const { session, info, debug } = await nextSession();
      walk(session, info, debug);
    }, 120_000);

    it("steps inside a bank and out of it on the Next", async () => {
      const { session, info, debug } = await nextSession();
      walkInBank(session, info, debug);
    }, 120_000);
  });

  it("knows a Next routine that crosses $E000 in its second page: the call stack and Step Out", async () => {
    const { info } = load("banked-edge-next", "zxnext");
    const edge = callable(info, "Edge");
    // --- The routine starts in the bank's first page; the statement tested is past $E000, in its second
    const target = info.statements.find((s) => s.callableIndex === edge.index && s.startAddress >= 0xe010)!;
    expect(edge.partition).toBe(32);
    expect(target.partition).toBe(33);

    const session = await createSession();
    await session.prepareBasic();
    await session.loadProgramFile(path.join(FIXTURES, "banked-edge-next", "program.nex"));
    const debug = session.attachDebugSupport();
    const index = new SourceDebugIndex(info, false);
    debug.statementTracker = new CurrentStatementTracker(index);
    debug.addBreakpoint({ address: target.startAddress, partition: target.partition, exec: true });
    const pc = session.continueToBreakpoint({ maxFrames: 300 });
    expect(pc).toBe(target.startAddress);

    const view = session.machineView();
    expect(index.callableAt(pc, index.partitionNow(view, pc))).toBe(edge.index);
    expect(locateActivations(index, view).map((a) => info.callables[a.callableIndex].name)).toEqual(["Edge", "main"]);
    debug.removeBreakpoint({ address: target.startAddress, partition: target.partition, exec: true });
    const out = session.sourceStep(index, "out", { maxFrames: 300 })!;
    expect(out.stoppedAt).toBe("returnPoint");
    expect(info.statements[out.stopStatement!].startLine).toBe(5);
  }, 120_000);
});
