import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { CurrentStatementTracker, locateActivations, SourceDebugIndex } from "@emu/machines/SourceStepDecision";
import { parseMemoryMap } from "@main/boriel-integration/boriel-map";
import { adaptBorielDebugInfo } from "@main/boriel-integration/dbg-adapter";

import { createSession } from "../harness/zxnext";

/*
 * Boriel BASIC programs on the real ZX Spectrum Next core, started from the `.nex` zxbc wrote, as the
 * IDE starts them (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §6.3): source breakpoints, the call
 * stack, and the runtime-error stop, which on the Next must come before zxbc's panic screen.
 */

const FIXTURES = path.join(__dirname, "fixtures");

function load(name: string) {
  const folder = path.join(FIXTURES, name);
  return adaptBorielDebugInfo({
    dbg: JSON.parse(fs.readFileSync(path.join(folder, "program.dbg"), "utf8")),
    map: parseMemoryMap(fs.readFileSync(path.join(folder, "program.map"), "utf8")),
    arch: "zxnext",
    baseFolder: folder,
    optimizationLevel: 2,
    image: { bytes: fs.readFileSync(path.join(folder, "program.bin")), origin: 0x8000 },
    readFile: (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined)
  }).sourceLevelDebug;
}

async function startNex(name: string) {
  const session = await createSession();
  // --- The state NextZXOS's .nexload leaves: the 48K BASIC ROM paged in, its system variables set up
  await session.prepareBasic();
  await session.loadProgramFile(path.join(FIXTURES, name, "program.nex"));
  return session;
}

describe("Boriel BASIC on the ZX Spectrum Next", () => {
  it("stops at a source breakpoint inside a FUNCTION, with the call stack", async () => {
    const info = load("calls-next");
    const session = await startNex("calls-next");
    const index = new SourceDebugIndex(info, false);
    const debug = session.attachDebugSupport();
    debug.statementTracker = new CurrentStatementTracker(index);
    const returnR = info.statements.find((s) => s.startLine === 12)!;
    debug.addBreakpoint({ address: returnR.startAddress, exec: true });
    const pc = session.continueToBreakpoint({ maxFrames: 300 });
    expect(pc).toBe(returnR.startAddress);
    const chain = locateActivations(index, session.machineView());
    expect(chain.map((a) => info.callables[a.callableIndex].name)).toEqual(["Square", "main"]);
  });

  it("stops at the runtime error routine with the error code in A, before the panic screen", async () => {
    const info = load("runtime-error-next");
    const errorEntry = info.extensions!.errorEntry!;
    expect(errorEntry).toBeDefined();
    const session = await startNex("runtime-error-next");
    const debug = session.attachDebugSupport();
    debug.statementTracker = new CurrentStatementTracker(new SourceDebugIndex(info, false));
    debug.errorStopAddress = errorEntry;
    debug.addBreakpoint({ address: errorEntry, exec: true });
    const pc = session.continueToBreakpoint({ maxFrames: 300 });
    expect(pc).toBe(errorEntry);
    // --- a(k) = 1 with k = 5: 2, Subscript wrong; the POKE before it ran, the one after did not
    expect(session.registers().a).toBe(2);
    expect(session.peek(40000)).toBe(1);
    expect(session.peek(40001)).toBe(0);
  });
});
