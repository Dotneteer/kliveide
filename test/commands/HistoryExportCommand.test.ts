import { beforeEach, describe, expect, it, vi } from "vitest";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { encodeHistoryRecord, HistoryKind, type HistoryRecord } from "@common/history/historyRecord";
import { HISTORY_RECORD_SIZE, type ExecutionHistoryInfo } from "@common/history/historyTypes";
import { HistoryCommand, HistoryExportCommand, resolveExportRange } from "@renderer/appIde/commands/HistoryCommands";
import { extractArguments } from "@renderer/appIde/services/ide-commands";
import { parseCommand } from "@renderer/appIde/services/command-parser";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { createMockContext } from "./test-helpers/mock-context";

/* `.plans/TRACE_EXPORT_PLAN.md` Phase 2: `history-export` against a faked Emu API */

function record(sequence: number, init: Partial<Omit<HistoryRecord, "regs">> & { regs?: Partial<HistoryRecord["regs"]> } = {}): HistoryRecord {
  const { regs, ...rest } = init;
  return {
    sequence,
    frame: 10 + Math.floor(sequence / 4),
    frameTact: (sequence % 4) * 10,
    kind: HistoryKind.Instruction,
    repeat: 1,
    intPending: false,
    bytesTruncated: false,
    // --- inc hl, so each record's HL is the one before plus one
    bytes: [0x23, 0, 0, 0],
    context: new Uint8Array(16),
    ...rest,
    regs: {
      pc: 0x8000 + sequence,
      af: 0,
      bc: 0,
      de: 0,
      hl: sequence,
      af_: 0,
      bc_: 0,
      de_: 0,
      hl_: 0,
      ix: 0,
      iy: 0,
      sp: 0xfffe,
      ir: 0,
      wz: 0,
      iff1: false,
      iff2: false,
      interruptMode: 1,
      ...regs
    }
  };
}

type Fake = {
  context: IdeCommandContext;
  files: Map<string, string>;
  output: string[];
  emu: { getHistoryRecords: ReturnType<typeof vi.fn> };
};

function fake(options: {
  oldest?: number;
  newest?: number;
  machineState?: MachineControllerState;
  machineId?: string;
  existing?: string[];
  gone?: boolean;
  enabled?: boolean;
} = {}): Fake {
  const oldest = options.oldest ?? 100;
  const newest = options.newest ?? 139;
  const machineId = options.machineId ?? "sp48";
  const records = new Map<number, HistoryRecord>();
  for (let s = oldest; s <= newest; s++) records.set(s, record(s));
  const info: ExecutionHistoryInfo = {
    machineId,
    capacity: 65536,
    count: newest >= oldest ? newest - oldest + 1 : 0,
    newestSequence: newest,
    oldestSequence: oldest,
    generation: 1,
    enabled: options.enabled ?? true
  };
  const files = new Map<string, string>((options.existing ?? []).map((f) => [f, "old"]));
  const getHistoryRecords = vi.fn(async (from: number, count: number) => {
    const first = Math.max(from, oldest);
    const n = Math.max(0, Math.min(count, newest - first + 1));
    const bytes = new Uint8Array(n * HISTORY_RECORD_SIZE);
    for (let i = 0; i < n; i++) bytes.set(encodeHistoryRecord(records.get(first + i)!), i * HISTORY_RECORD_SIZE);
    return { info, firstSequence: first, records: bytes, gone: options.gone || from < oldest };
  });
  const context = createMockContext();
  const state = {
    emulatorState: { machineId, modelId: undefined, machineState: options.machineState ?? MachineControllerState.Paused },
    compilation: {}
  };
  (context.store.getState as any).mockImplementation(() => state);
  (context.service.machineService as any).getMachineInfo = () => ({ machine: { machineId } });
  Object.assign(context.emuApi, {
    getHistoryInfo: vi.fn(async () => info),
    getHistoryRecords,
    getHistoryServiceSpans: vi.fn(async () => []),
    getPartitionLabels: vi.fn(async () => ({})),
    getCpuState: vi.fn(async () => ({ ...record(newest + 1).regs }))
  });
  Object.assign(context.mainApi, {
    readBinaryFile: vi.fn(async (path: string) => {
      if (!files.has(path)) throw new Error("File does not exist");
      return new Uint8Array();
    }),
    saveTextFile: vi.fn(async (path: string, data: string) => {
      files.set(path, data);
      return path;
    }),
    getAppVersion: vi.fn(async () => "0.52.0")
  });
  const output: string[] = [];
  (context.output.writeLine as any).mockImplementation((text: string) => output.push(text));
  return { context, files, output, emu: { getHistoryRecords } };
}

/** Parses a command line the way the command service does */
function args(line: string): any {
  const command = new HistoryExportCommand();
  const parsed = extractArguments(parseCommand(line).slice(1), command.argumentInfo);
  if (Array.isArray(parsed)) throw new Error(parsed.join("; "));
  return parsed;
}

async function exportWith(f: Fake, line: string) {
  const command = new HistoryExportCommand();
  const a = args(line);
  const messages = await command.validateCommandArgs(f.context, a);
  if (messages.length) return { success: false, finalMessage: messages[0].message };
  return command.execute(f.context, a);
}

/** The trace's rows: its non-comment lines */
const rows = (text: string | undefined) => (text ?? "").split("\n").filter((l) => l && !l.startsWith(";"));

describe("history-export", () => {
  let f: Fake;
  beforeEach(() => {
    f = fake();
  });

  it("has its id, alias and options", () => {
    const command = new HistoryExportCommand();
    expect(command).toMatchObject({ id: "history-export", aliases: ["hexp"] });
    expect(args('hexp "a b.txt" -from -42 -to #130 -count 5 -columns frame,instr -filter "$8000-$80FF" -nointerrupts -f')).toEqual({
      file: "a b.txt",
      "-from": "-42",
      "-to": "#130",
      "-count": "5",
      "-columns": "frame,instr",
      "-filter": "$8000-$80FF",
      "-nointerrupts": true,
      "-f": true
    });
  });

  it("exports the whole ring by default, relative to its first record, with a header", async () => {
    const result = await exportWith(f, "hexp run1.txt");
    expect(result.success).toBe(true);
    const text = f.files.get("run1.txt")!;
    expect(text.startsWith("; Klive IDE 0.52.0 execution trace\n")).toBe(true);
    expect(text).toContain("; Range: #100..#139, 40 records, frames 0–9");
    expect(rows(text)).toHaveLength(40);
    expect(rows(text)[0]).toBe("     0       0  8064     23           inc hl                  HL=0065");
    // --- The newest record's "after" is the live CPU (T4)
    expect(rows(text)[39]).toMatch(/HL=008C$/);
    expect(f.output.join("\n")).toContain("Exported 40 records (frames 0–9) to run1.txt");
  });

  it("takes a range of steps and sequence numbers, inclusive (D5)", async () => {
    await exportWith(f, "hexp r.txt -from #110 -to -10 -noheader -columns seq,instr -absolute");
    // --- -10 is the tenth step back: sequence 139 - 10 + 1
    const lines = rows(f.files.get("r.txt"));
    expect(lines[0]).toMatch(/^ +110 {2}inc hl$/);
    expect(lines[lines.length - 1]).toMatch(/^ +130 {2}inc hl$/);
    expect(lines).toHaveLength(21);
  });

  it("takes -count from -from, or the newest n", async () => {
    expect(resolveExportRange({ oldestSequence: 100, newestSequence: 139 }, { "-count": "5" })).toEqual({ from: 135, to: 139, warnings: [] });
    expect(resolveExportRange({ oldestSequence: 100, newestSequence: 139 }, { "-from": "#120", "-count": "5" })).toEqual({
      from: 120,
      to: 124,
      warnings: []
    });
    expect(resolveExportRange({ oldestSequence: 100, newestSequence: 139 }, { "-to": "-2", "-count": "3" })).toEqual({
      from: 136,
      to: 138,
      warnings: []
    });
    expect(resolveExportRange({ oldestSequence: 100, newestSequence: 139 }, { "-from": "−1" })).toEqual({ from: 139, to: 139, warnings: [] });
  });

  it("clamps an endpoint older than the ring, with a warning", async () => {
    expect(resolveExportRange({ oldestSequence: 100, newestSequence: 139 }, { "-from": "#10" })).toEqual({
      from: 100,
      to: 139,
      warnings: ["The ring starts at #100; 90 earlier records are gone"]
    });
    await exportWith(f, "hexp r.txt -from -100");
    expect(f.output.join("\n")).toContain("Warning: The ring starts at #100; 60 earlier records are gone");
    expect(rows(f.files.get("r.txt"))).toHaveLength(40);
  });

  it("refuses bad ranges", () => {
    const info = { oldestSequence: 100, newestSequence: 139 };
    expect(resolveExportRange(info, { "-from": "abc" })).toMatch(/^-from: use a step/);
    expect(resolveExportRange(info, { "-to": "#" })).toMatch(/^-to: use a step/);
    expect(resolveExportRange(info, { "-count": "0" })).toMatch(/positive whole number/);
    expect(resolveExportRange(info, { "-from": "#110", "-to": "#120", "-count": "3" })).toMatch(/not both/);
    expect(resolveExportRange(info, { "-from": "#130", "-to": "#120" })).toBe("The range is empty");
  });

  it("refuses a running machine (D10)", async () => {
    f = fake({ machineState: MachineControllerState.Running });
    const result = await exportWith(f, "hexp r.txt");
    expect(result.success).toBe(false);
    expect(result.finalMessage).toMatch(/^Pause the machine first/);
    expect(f.files.size).toBe(0);
  });

  it("exports from a stopped machine", async () => {
    f = fake({ machineState: MachineControllerState.Stopped });
    expect((await exportWith(f, "hexp r.txt")).success).toBe(true);
  });

  it("refuses a machine that does not record history", async () => {
    f = fake({ machineId: "c64" });
    expect((await exportWith(f, "hexp r.txt")).finalMessage).toBe("This machine does not record execution history");
  });

  it("says why there is nothing to export", async () => {
    f = fake({ oldest: 1, newest: 0, enabled: false });
    expect((await exportWith(f, "hexp r.txt")).finalMessage).toMatch(/started with debugging/);
  });

  it("does not replace a file without -f", async () => {
    f = fake({ existing: ["r.txt"] });
    const result = await exportWith(f, "hexp r.txt");
    expect(result.finalMessage).toBe("r.txt already exists; use -f to replace it.");
    expect(f.files.get("r.txt")).toBe("old");
    expect((await exportWith(f, "hexp r.txt -f")).success).toBe(true);
    expect(f.files.get("r.txt")).not.toBe("old");
  });

  it("checks the format and the columns", async () => {
    expect((await exportWith(f, "hexp r.bin")).finalMessage).toMatch(/\.txt, \.log, \.trace or \.csv/);
    expect((await exportWith(f, "hexp r.bin -format xml")).finalMessage).toBe("-format: use text or csv");
    expect((await exportWith(f, "hexp r.bin -format csv")).success).toBe(true);
    expect(f.files.get("r.bin")!.startsWith('"frame","tact"')).toBe(true);
    expect((await exportWith(f, "hexp r.txt -columns addr,pc")).finalMessage).toMatch(/Unknown column 'pc'/);
    expect((await exportWith(f, "hexp r.txt -columns ,")).finalMessage).toBe("No columns given");
  });

  it("writes CSV with CRLF, and its metadata to the output pane (Q6)", async () => {
    await exportWith(f, "hexp r.csv -bom");
    const text = f.files.get("r.csv")!;
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text.split("\r\n")[0]).toBe('﻿"frame","tact","part","addr","bytes","instr","repeat","changes"');
    expect(text.split("\r\n")).toHaveLength(42);
    expect(f.output).toContain("Range: #100..#139, 40 records, frames 0–9");
  });

  it("applies the document's filter (D8)", async () => {
    await exportWith(f, 'hexp r.txt -filter "$8070-$8072" -noheader');
    const lines = rows(f.files.get("r.txt"));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/ 8070 /);
    expect(f.output.join("\n")).toContain("Exported 40 records (frames 0–9, 3 lines) to r.txt");
  });

  it("reads in pages of 8,192 records and reports progress (D11, T9)", async () => {
    f = fake({ oldest: 1, newest: 20000 });
    await exportWith(f, "hexp r.txt -noheader");
    const reads = f.emu.getHistoryRecords.mock.calls.filter(([, count]) => count > 2);
    expect(reads).toEqual([
      [1, 8192],
      [8193, 8192],
      [16385, 3616]
    ]);
    expect(f.output.some((l) => /^Exporting\.\.\. 16,384 of 20,000 records$/.test(l))).toBe(true);
    expect(rows(f.files.get("r.txt"))).toHaveLength(20000);
  });

  it("fails rather than writing a trace with a hole in it (D11)", async () => {
    f = fake();
    f.emu.getHistoryRecords.mockImplementation(async (from: number, count: number) => ({
      info: {} as any,
      firstSequence: from,
      records: new Uint8Array(Math.min(count, 2) * HISTORY_RECORD_SIZE),
      gone: count > 2
    }));
    const result = await exportWith(f, "hexp r.txt");
    expect(result.success).toBe(false);
    expect(result.finalMessage).toMatch(/overwritten while reading/);
    expect(f.files.size).toBe(0);
  });

  it("asks for the interrupt spans only with -nointerrupts", async () => {
    await exportWith(f, "hexp r.txt");
    expect(f.context.emuApi.getHistoryServiceSpans).not.toHaveBeenCalled();
    await exportWith(f, "hexp r.txt -f -nointerrupts");
    expect(f.context.emuApi.getHistoryServiceSpans).toHaveBeenCalledTimes(1);
    expect(f.files.get("r.txt")).toContain("interrupt service dropped, with markers");
  });
});

describe("history (D14: the exporter writes its lines)", () => {
  it("prints the viewer's rows unchanged", async () => {
    const f = fake();
    await new HistoryCommand().execute(f.context, { count: 2 });
    expect(f.output).toEqual([
      "40 of 65,536 recorded",
      "     −2      20  808A     23           inc hl                                      HL=008B",
      "     −1      30  808B     23           inc hl                                      HL=008C"
    ]);
  });
});
