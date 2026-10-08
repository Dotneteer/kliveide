import { describe, expect, it, vi } from "vitest";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { decodeHistoryPage } from "@common/history/historyRecord";
import { HistoryExportCommand } from "@renderer/appIde/commands/HistoryCommands";
import { extractArguments } from "@renderer/appIde/services/ide-commands";
import { parseCommand } from "@renderer/appIde/services/command-parser";
import { createMockContext } from "../commands/test-helpers/mock-context";
import { createSp48Session, type Sp48TestSession } from "../harness/sp48";

/*
 * `history-export` on the real 48K core (`.plans/TRACE_EXPORT_PLAN.md` Phase 4): the command reads
 * the ring through an Emu API backed by the machine, as the IDE's emulator answers it. Two runs of
 * the same program stopped at the same breakpoint give traces a diff tool compares line by line.
 */

/** Exports the session's history with a command line; returns the file's text */
async function exportTrace(s: Sp48TestSession, commandLine: string): Promise<string> {
  const m = s.machine;
  const files = new Map<string, string>();
  const context = createMockContext();
  const state = { emulatorState: { machineId: "sp48", machineState: MachineControllerState.Paused }, compilation: {} };
  (context.store.getState as any).mockImplementation(() => state);
  (context.service.machineService as any).getMachineInfo = () => ({ machine: { machineId: "sp48" } });
  Object.assign(context.emuApi, {
    getHistoryInfo: async () => m.getHistoryInfo(),
    getHistoryRecords: async (from: number, count: number) => m.readHistory(from, count),
    getHistoryServiceSpans: async () => m.getHistoryServiceSpans(),
    getPartitionLabels: async () => ({}),
    getCpuState: async () => m.getCpuState()
  });
  Object.assign(context.mainApi, {
    readBinaryFile: vi.fn(async () => {
      throw new Error("File does not exist");
    }),
    saveTextFile: vi.fn(async (path: string, data: string) => {
      files.set(path, data);
      return path;
    }),
    getAppVersion: vi.fn(async () => "test")
  });
  const command = new HistoryExportCommand();
  const args = extractArguments(parseCommand(commandLine).slice(1), command.argumentInfo);
  if (Array.isArray(args)) throw new Error(args.join("; "));
  const result = await command.execute(context, args as any);
  if (!result.success) throw new Error(result.finalMessage);
  return files.values().next().value!;
}

const rows = (text: string) => text.split("\n").filter((l) => l && !l.startsWith(";"));

/** The relative frame a default-column row starts with */
const frameOf = (row: string) => Number(row.trim().split(/\s+/)[0]);

/** Boots a 48K, loads the program, and arms a breakpoint at `Done` with a fresh, recording history */
async function prepare(source: string, beforeCall?: (s: Sp48TestSession) => void) {
  const s = await createSp48Session();
  s.bootToBasic();
  await s.loadCode(source);
  beforeCall?.(s);
  // --- The same registers in every run: only what the test varies may differ
  Object.assign(s.machine, { af: 0, bc: 0, de: 0, hl: 0 });
  s.attachDebugSupport().addBreakpoint({ address: s.program!.symbol("Done"), exec: true });
  s.clearHistory().recordHistory(true);
  return s;
}

/** Waits for SPACE with HALT, then counts down: the path changes in the frame the key goes down */
const KEY_PROGRAM = `
    .org $8000
Main:
    ei
Wait:
    halt
    ld a,$7f
    in a,($fe)
    rra
    jr c,Wait
    ld b,20
Count:
    djnz Count
Done:
    nop
`;

/** A loop that never looks at the outside world: only where the interrupts land can differ */
const PURE_PROGRAM = `
    .org $8000
Main:
    ei
    ld bc,6000
    ld hl,0
Loop:
    inc hl
    dec bc
    ld a,b
    or c
    jr nz,Loop
Done:
    nop
`;

/** Runs to `Done`, pressing SPACE after `pressAfter` frames; returns the press's relative frame */
function runPressingSpace(s: Sp48TestSession, pressAfter: number): number {
  let frames = 0;
  let pressFrame = -1;
  s.callToBreakpoint("Main", {
    maxFrames: pressAfter + 20,
    onFrame: () => {
      if (++frames !== pressAfter) return;
      s.keyDown("Space");
      const info = s.historyInfo();
      const newest = decodeHistoryPage(s.machine.readHistory(info.newestSequence, 1)!)[0];
      const first = decodeHistoryPage(s.machine.readHistory(info.oldestSequence, 1)!)[0];
      pressFrame = newest.frame - first.frame;
    }
  });
  return pressFrame;
}

describe("history-export on the ZX Spectrum 48K", () => {
  it("gives two runs equal traces up to the frame of a key pressed a frame later, and different ones after", async () => {
    const one = await prepare(KEY_PROGRAM);
    const pressed = runPressingSpace(one, 5);
    const two = await prepare(KEY_PROGRAM);
    runPressingSpace(two, 6);
    expect(one.machine.pc).toBe(one.program!.symbol("Done"));
    expect(two.machine.pc).toBe(two.program!.symbol("Done"));

    const a = rows(await exportTrace(one, "hexp run1.txt"));
    const b = rows(await exportTrace(two, "hexp run2.txt"));
    expect(a.length).toBeGreaterThan(300);
    const firstDiff = a.findIndex((line, i) => line !== b[i]);
    expect(firstDiff).toBeGreaterThan(0);
    // --- Every row before it is the same; it is in the frame the key went down (or the next, where
    // --- the matrix is read), and the traces do not meet again at the same length
    expect(a.slice(0, firstDiff)).toEqual(b.slice(0, firstDiff));
    expect(frameOf(a[firstDiff])).toBeGreaterThanOrEqual(pressed);
    expect(frameOf(a[firstDiff])).toBeLessThanOrEqual(pressed + 1);
    expect(a).not.toEqual(b);
  });

  it("makes two runs whose interrupts land differently equal with -nointerrupts", async () => {
    const one = await prepare(PURE_PROGRAM);
    one.callToBreakpoint("Main", { maxFrames: 20 });
    // --- The second run starts 37 instructions later in the frame, so its interrupts land elsewhere
    const two = await prepare(PURE_PROGRAM, (s) => s.step(37));
    two.callToBreakpoint("Main", { maxFrames: 20 });
    expect(one.machine.hl).toBe(6000);
    expect(two.machine.hl).toBe(6000);

    // --- The defaults show where the interrupts landed...
    const plainOne = rows(await exportTrace(one, "hexp a.txt"));
    const plainTwo = rows(await exportTrace(two, "hexp b.txt"));
    expect(plainOne.some((l) => l.includes("IM 1 interrupt"))).toBe(true);
    expect(plainOne).not.toEqual(plainTwo);
    const firstInt = (lines: string[]) => lines.findIndex((l) => l.includes("IM 1 interrupt"));
    expect(firstInt(plainOne)).not.toBe(firstInt(plainTwo));

    // --- ...and the program's path alone, without its timing, is the same
    const options = "-nointerrupts -nomarkers -noheader -columns addr,bytes,instr,changes";
    const pathOne = await exportTrace(one, `hexp a.txt ${options}`);
    const pathTwo = await exportTrace(two, `hexp b.txt ${options}`);
    expect(pathOne.split("\n").length).toBeGreaterThan(6000 * 5);
    expect(pathOne).toBe(pathTwo);
    expect(pathOne).not.toContain("interrupt");
  });
});
