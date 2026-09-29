import { describe, expect, it } from "vitest";

import { locateActivations, SourceDebugIndex, type SourceStepKind } from "@emu/machines/SourceStepDecision";
import { stepIntoTargets } from "@renderer/appIde/debugger/source/step-targets";
import { libraryFile } from "@main/kbasic/stdlib";

import { startBasic } from "./run-kit";

/**
 * Just My Code (plan §10.12): the standard library's statements are in the debug tables, and source
 * stepping runs through them unless the setting is turned off — then it stops in the library's code
 * like in the user's.
 */
const PROGRAM = ["#include <hex.bas>", "DIM s AS String", "s = hex8(255)", "PRINT s", ""].join("\n");

async function debug(justMyCode: boolean) {
  const { session, generated, done } = await startBasic(PROGRAM);
  const info = generated.debug.sourceLevel;
  const index = new SourceDebugIndex(info, justMyCode);
  session.attachDebugSupport();
  const hexLines = libraryFile("hex.bas")!.text.split("\n");
  const userLines = PROGRAM.split("\n");
  const text = (i: number) => {
    const s = info.statements[i];
    const lines = info.files[s.fileIndex].filename.startsWith("<kbasic-stdlib>") ? hexLines : userLines;
    return lines[s.startLine - 1].slice(s.startColumn, s.startLine === s.endLine ? s.endColumn : undefined);
  };
  const step = (kind: SourceStepKind) => {
    const st = session.sourceStep(index, kind, { returnTo: done });
    if (!st) return "<end>";
    const i = st.stopStatement ?? index.statementAt(session.machine.pc);
    return `${st.stoppedAt === "returnPoint" ? "↩ " : ""}${i >= 0 ? text(i) : "<runtime>"}`;
  };
  const first = step("into");
  return { session, info, index, step, first };
}

describe("Just My Code (§10.12)", () => {
  it("puts the library's statements in the tables, after the user's files", async () => {
    const { info } = await debug(true);
    const library = info.extensions!.libraryFiles!;
    expect(library.map((f) => info.files[f].filename)).toEqual(["<kbasic-stdlib>/hex.bas"]);
    expect(info.files[0].filename).toBe("/test/main.bas");
    expect(info.statements.some((s) => library.includes(s.fileIndex))).toBe(true);
  });

  it("on: Step Into runs through a library routine", async () => {
    const d = await debug(true);
    expect(d.first).toBe("s = hex8(255)");
    expect(d.step("into")).toBe("PRINT s");
  });

  it("off: Step Into stops in the library, and Step Out comes back to the call", async () => {
    const d = await debug(false);
    expect(d.first).toBe("s = hex8(255)");
    expect(d.step("into")).toBe("RETURN __kbHexDigits(n, 2)");
    expect(d.step("into")).toBe('result = ""');
    const chain = locateActivations(d.index, { pc: d.session.machine.pc, sp: d.session.machine.sp, ix: d.session.machine.ix, readWord: (a) => d.session.peekWord(a) });
    expect(chain.map((a) => d.info.callables[a.callableIndex].name)).toEqual(["__kbHexDigits", "hex8", "main"]);
    expect(d.step("out")).toBe("↩ RETURN __kbHexDigits(n, 2)");
    expect(d.step("out")).toBe("↩ s = hex8(255)");
  });

  it("offers library routines as Step Into targets only when it is off", async () => {
    const d = await debug(true);
    const stop = { kind: "statement" as const, pc: d.session.machine.pc, statementIndex: d.index.statementAt(d.session.machine.pc), returned: [] };
    expect(stepIntoTargets(d.info, stop, true)).toEqual([]);
    expect(stepIntoTargets(d.info, stop, false).map((t) => t.name)).toEqual(["hex8"]);
  });
});
