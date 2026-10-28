import { describe, expect, it } from "vitest";

import { playInjectionFlow, type FrameMachine } from "@common/headless/frameRunner";
import { buildTvcCasFile, parseTvcCasFile } from "@emu/machines/tvc/TvcCasFile";
import { tvcExportFile } from "@renderer/appIde/utils/tvc-code";
import { createTvcSession } from "../harness/tvc";

/*
 * Load and Run on the TVC (`TvcWasmV2Machine.getTapeLoadFlow`, `tape-load -r`): the flow boots BASIC
 * and types LOAD; a program that does not start itself gets RUN typed once BASIC is back at its prompt.
 */

/** A BASIC program typed on one machine, as the bytes from 19EFh to its end marker */
async function basicProgram(lines: string): Promise<Uint8Array> {
  const s = (await createTvcSession()).bootToBasic();
  s.typeKeys(lines, { settle: 10 });
  let end = 0x19ef;
  while (s.peek(end) !== 0) end += s.peek(end);
  return Uint8Array.from({ length: end + 1 - 0x19ef }, (_, i) => s.peek(0x19ef + i));
}

describe("TVC Load and Run", () => {
  it.each(["tvc64", "tvc64p"])("%s: loads a BASIC tape and types RUN", async (model) => {
    const cas = buildTvcCasFile(await basicProgram("10 POKE 24576,42\n"), 0x01, false);
    const s = await createTvcSession({ model });
    s.insertTape(parseTvcCasFile(cas, "poke.cas"));
    playInjectionFlow(s.machine as unknown as FrameMachine, s.machine.getTapeLoadFlow(), { maxFrames: 2000 });
    expect(s.machine.pendingLoadCommands).toEqual(["RUN\n"]);
    s.runUntil(() => s.peek(0x6000) === 42, { maxFrames: 1500 }, "the program running");
    expect(s.machine.pendingLoadCommands).toEqual([]);
  });

  it("types nothing more for a tape that starts itself", async () => {
    const file = tvcExportFile({ segments: [{ startAddress: 0x1a30, emittedCode: [0x3e, 0x2a, 0x32, 0x00, 0x60, 0xc9] }] });
    if ("error" in file) throw new Error(file.error);
    const s = await createTvcSession();
    s.insertTape(parseTvcCasFile(file.data, "code.cas"));
    playInjectionFlow(s.machine as unknown as FrameMachine, s.machine.getTapeLoadFlow(), { maxFrames: 2000 });
    expect(s.machine.pendingLoadCommands).toEqual([]);
    s.runUntil(() => s.peek(0x6000) === 42, { maxFrames: 1500 }, "the code running");
  });

  it("refuses an empty deck", async () => {
    const s = await createTvcSession();
    expect(() => s.machine.getTapeLoadFlow()).toThrow(/no Videoton TVC tape/);
  });
});
