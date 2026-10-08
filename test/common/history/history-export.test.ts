import { describe, expect, it } from "vitest";
import { HistoryKind, type HistoryRecord } from "@common/history/historyRecord";
import {
  collectTrace,
  defaultTraceOptions,
  exportTrace,
  formatHistoryRow,
  historyExportCommandText,
  parseTraceColumns,
  traceCsvColumnNames,
  traceFormatOfName,
  traceHeaderLines,
  TRACE_COLUMNS,
  VIEWER_TRACE_COLUMNS,
  type TraceExportOptions,
  type TraceMeta,
  type TraceResolvers
} from "@common/history/historyExport";
import { csvCell, csvRow } from "@common/history/csv";
import { historyContextDecoder } from "@common/history/contexts";
import type { HistoryServiceSpan } from "@common/history/serviceSpans";

/* `.plans/TRACE_EXPORT_PLAN.md` §6: the pure exporter against hand-built records */

type RecordInit = Partial<Omit<HistoryRecord, "regs">> & { regs?: Partial<HistoryRecord["regs"]> };

function record(init: RecordInit = {}): HistoryRecord {
  const { regs, ...rest } = init;
  return {
    sequence: 1,
    frame: 0,
    frameTact: 0,
    kind: HistoryKind.Instruction,
    repeat: 1,
    intPending: false,
    bytesTruncated: false,
    bytes: [0, 0, 0, 0],
    context: new Uint8Array(16),
    ...rest,
    regs: {
      pc: 0x8000,
      af: 0,
      bc: 0,
      de: 0,
      hl: 0,
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
      interruptMode: 0,
      ...regs
    }
  };
}

/** Consecutive records from `first` on */
function run(first: number, frame: number, inits: RecordInit[]): HistoryRecord[] {
  return inits.map((init, i) => record({ sequence: first + i, frame, ...init }));
}

/** A tiny disassembler for the fixtures: by the first byte */
const OPCODES: Record<number, [string, number]> = {
  0x21: ["ld hl,$8001", 3],
  0x23: ["inc hl", 1],
  0x00: ["nop", 1],
  0xc9: ["ret", 1],
  0xfb: ["ei", 1],
  0xcd: ["call $9000", 3]
};

const resolvers = (extra: Partial<TraceResolvers> = {}): TraceResolvers => ({
  instruction: async (r) => {
    const op = OPCODES[r.bytes[0]];
    return op ? { text: op[0], length: op[1] } : undefined;
  },
  ...extra
});

async function exportLines(
  records: HistoryRecord[] | HistoryRecord[][],
  options: Partial<TraceExportOptions> = {},
  meta: Partial<TraceMeta> = {},
  spans: HistoryServiceSpan[] = [],
  res: TraceResolvers = resolvers()
): Promise<string[]> {
  const pages = Array.isArray(records[0]) ? (records as HistoryRecord[][]) : [records as HistoryRecord[]];
  const flat = pages.flat();
  const lines: string[] = [];
  for await (const line of exportTrace(
    pages,
    { newestSequence: flat[flat.length - 1]?.sequence ?? 0, ...meta },
    spans,
    { ...defaultTraceOptions(options.format ?? "text"), header: false, ...options },
    res
  )) {
    lines.push(line);
  }
  return lines;
}

/** A minimal RFC 4180 reader, to read CSV output back cell by cell */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" && text[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** A short 48K-style run: two instructions, a HALT, an interrupt and its service */
function program(frame = 120, first = 1000): HistoryRecord[] {
  return run(first, frame, [
    { frameTact: 100, bytes: [0x21, 0x01, 0x80, 0x00], regs: { pc: 0x8000 } },
    { frameTact: 110, bytes: [0x23, 0, 0, 0], regs: { pc: 0x8003, hl: 0x8001 } },
    { frameTact: 116, kind: HistoryKind.Halt, repeat: 1203, bytes: [0x76, 0, 0, 0], regs: { pc: 0x8004, hl: 0x8002 } },
    { frameTact: 4, frame: frame + 1, kind: HistoryKind.Int, regs: { pc: 0x8005, hl: 0x8002, interruptMode: 1, sp: 0xfffe } },
    { frameTact: 17, frame: frame + 1, bytes: [0xfb, 0, 0, 0], regs: { pc: 0x0038, hl: 0x8002, sp: 0xfffc } },
    { frameTact: 21, frame: frame + 1, bytes: [0xc9, 0, 0, 0], regs: { pc: 0x0039, hl: 0x8002, sp: 0xfffc, iff1: true } },
    { frameTact: 31, frame: frame + 1, bytes: [0x00, 0, 0, 0], regs: { pc: 0x8005, hl: 0x8002, sp: 0xfffe, iff1: true } }
  ]);
}

const SERVICE: HistoryServiceSpan = { first: 1003, last: 1005, kind: HistoryKind.Int, instructions: 2 };

describe("trace export: text", () => {
  it("writes the diff-friendly default columns, relative to the range's first frame", async () => {
    expect(await exportLines(program())).toEqual([
      "     0     100  8000     21 01 80     ld hl,$8001             HL=8001",
      "     0     110  8003     23           inc hl                  HL=8002",
      "     0     116  8004     76           HALT ×*",
      "     1       4  — IM 1 interrupt —",
      "     1      17  0038     FB           ei",
      "     1      21  0039     C9           ret                     SP=FFFE",
      "     1      31  8005     00           nop"
    ]);
  });

  it("writes the same lines for two runs that start at different frames and sequences (T1)", async () => {
    expect(await exportLines(program(120, 1000))).toEqual(await exportLines(program(5000, 77777)));
  });

  it("writes absolute frame and sequence numbers with -absolute (D3)", async () => {
    const lines = await exportLines(program(), { columns: ["seq", "frame", "instr"], absolute: true });
    expect(lines[0]).toBe("    1000     120  ld hl,$8001");
    expect(lines[3]).toBe("    1003     121  — IM 1 interrupt —");
    const relative = await exportLines(program(), { columns: ["seq", "frame", "instr"] });
    expect(relative[0]).toBe("       0       0  ld hl,$8001");
    expect(relative[6]).toBe("       6       1  nop");
  });

  it("writes the repeat counts with -repeats (D6)", async () => {
    const lines = await exportLines(program(), { repeats: true });
    expect(lines[2]).toBe("     0     116  8004     76           HALT ×1,203");
  });

  it("masks a ZX81 display run and a Next DMA hold's T-states (T2)", async () => {
    const context = new Uint8Array(16);
    context.set([0x00, 0x40, 0x00, 0xc0]);
    const records = run(1, 0, [
      { kind: HistoryKind.ForcedNop, repeat: 32, regs: { pc: 0xc000 } },
      { kind: HistoryKind.DmaHold, repeat: 3072, context }
    ]);
    expect(await exportLines(records, { columns: ["instr"] }, { machineId: "zxnext" })).toEqual([
      "Display NOPs ×*",
      "— DMA held the bus ($4000 → $C000, 0 left) —"
    ]);
    expect(await exportLines(records, { columns: ["instr"], repeats: true }, { machineId: "zxnext" })).toEqual([
      "Display NOPs ×32",
      "— DMA held the bus for 3,072 T ($4000 → $C000, 0 left) —"
    ]);
  });

  it("writes every column with -columns all", async () => {
    const lines = await exportLines(
      [record({ sequence: 5, frame: 3, frameTact: 9, bytes: [0x23, 0, 0, 0], regs: { pc: 0x8003, hl: 0x8001, ir: 0x3f12, iff1: true, interruptMode: 1 } })],
      { columns: TRACE_COLUMNS },
      { afterLast: record({ regs: { hl: 0x8002 } }).regs },
      [],
      resolvers({ source: () => "main.asm:12", describeContext: () => "Slots 0:R0" })
    );
    expect(lines).toEqual([
      "       0       −1       0       9  8003     23           inc hl                  main.asm:12         HL=8002                   " +
        "0000 0000 0000 8001 0000 0000 0000 0000 0000 0000 FFFE 3F 12 0000  1 0 1  Slots 0:R0"
    ]);
  });

  it("writes the bytes it has and ? for a truncated instruction (T8)", async () => {
    const lines = await exportLines([record({ bytesTruncated: true, bytes: [0xdd, 0xcb, 0x05, 0x00] })], {
      columns: ["bytes", "instr"]
    });
    expect(lines).toEqual(["DD CB 05 00  ?"]);
  });

  it("prefixes 128K addresses with their partition label (T5)", async () => {
    const decoder = historyContextDecoder("sp128")!;
    const context = new Uint8Array(16);
    context.set([0, 2, 5, 0], 8);
    const labels: Record<number, string> = { 0: "00", 2: "02", 5: "05" };
    const lines = await exportLines(
      [record({ context, bytes: [0x00, 0, 0, 0], regs: { pc: 0x4000 } })],
      { columns: ["addr", "instr"] },
      { machineId: "sp128" },
      [],
      resolvers({ partitionLabel: (r) => labels[decoder.partitionFor(r.context, r.regs.pc)!] })
    );
    expect(lines).toEqual(["02:4000  nop"]);
  });

  it("follows the 'after' state across page boundaries", async () => {
    const records = program();
    expect(await exportLines([records.slice(0, 1), records.slice(1, 5), records.slice(5)])).toEqual(
      await exportLines(records)
    );
  });

  it("writes only the filter's rows; a row's changes still come from the next record (D8)", async () => {
    const lines = await exportLines(program(), {}, {}, [], resolvers({ include: (r) => r.regs.pc === 0x8000 }));
    expect(lines).toEqual(["     0     100  8000     21 01 80     ld hl,$8001             HL=8001"]);
  });
});

describe("trace export: interrupt service (D7)", () => {
  it("keeps the service by default", async () => {
    expect(await exportLines(program(), { columns: ["instr"] }, {}, [SERVICE])).toHaveLength(7);
  });

  it("drops the span and leaves a marker", async () => {
    expect(await exportLines(program(), { columns: ["frame", "instr"], interrupts: "dropWithMarkers" }, {}, [SERVICE])).toEqual([
      "     0  ld hl,$8001",
      "     0  inc hl",
      "     0  HALT ×*",
      "     1  … interrupt service, 2 instructions …",
      "     1  nop"
    ]);
  });

  it("drops the span without a marker with -nomarkers", async () => {
    expect(await exportLines(program(), { columns: ["instr"], interrupts: "drop" }, {}, [SERVICE])).toEqual([
      "ld hl,$8001",
      "inc hl",
      "HALT ×*",
      "nop"
    ]);
  });

  it("drops a service still running at the range's end from its INT on", async () => {
    const records = program().slice(0, 5);
    expect(await exportLines(records, { columns: ["instr"], interrupts: "dropWithMarkers" }, {}, [])).toEqual([
      "ld hl,$8001",
      "inc hl",
      "HALT ×*",
      "… interrupt service, 1 instruction, unfinished …"
    ]);
    // --- A span whose end is past the range is cut at the range's end too
    expect(await exportLines(records, { columns: ["instr"], interrupts: "drop" }, {}, [SERVICE])).toEqual([
      "ld hl,$8001",
      "inc hl",
      "HALT ×*"
    ]);
  });

  it("drops the rest of a span that began before the range", async () => {
    const records = program().slice(4);
    expect(await exportLines(records, { columns: ["instr"], interrupts: "dropWithMarkers" }, {}, [SERVICE])).toEqual([
      "… interrupt service, 2 instructions …",
      "nop"
    ]);
  });

  it("leaves the markers out of a filtered trace", async () => {
    const lines = await exportLines(
      program(),
      { columns: ["instr"], interrupts: "dropWithMarkers" },
      {},
      [SERVICE],
      resolvers({ include: () => true })
    );
    expect(lines).toEqual(["ld hl,$8001", "inc hl", "HALT ×*", "nop"]);
  });

  it("writes an NMI service's marker", async () => {
    const records = run(1, 0, [
      { kind: HistoryKind.Nmi },
      { bytes: [0xc9, 0, 0, 0], regs: { pc: 0x0066, sp: 0xfffc } },
      { bytes: [0x00, 0, 0, 0] }
    ]);
    const spans: HistoryServiceSpan[] = [{ first: 1, last: 2, kind: HistoryKind.Nmi, instructions: 1 }];
    expect(await exportLines(records, { columns: ["instr"], interrupts: "dropWithMarkers" }, {}, spans)).toEqual([
      "… NMI service, 1 instruction …",
      "nop"
    ]);
  });
});

describe("trace export: the viewer's text (D14)", () => {
  it("formats a row exactly as the history command and Copy rows always have", () => {
    const r = record({ sequence: 9, frameTact: 4321, bytes: [0x21, 0x01, 0x80, 0], regs: { pc: 0x8003 } });
    expect(
      formatHistoryRow({ record: r, step: -2, instruction: "ld hl,$8001", length: 3, source: "main.asm:7", changes: "HL=8001", partitionLabel: "R0" })
    ).toBe("     −2    4321  R0:8003  21 01 80     ld hl,$8001             main.asm:7          HL=8001");
    expect(formatHistoryRow({ record: record({ kind: HistoryKind.Int, frameTact: 12, regs: { interruptMode: 2 }, bytes: [0xff, 0, 0, 0] }), step: -1 })).toBe(
      "     −1      12  — IM 2 interrupt, vector $FF —"
    );
    expect(formatHistoryRow({ record: record({ kind: HistoryKind.Halt, repeat: 1203, bytes: [0x76, 0, 0, 0] }), step: -1 })).toBe(
      "     −1       0  8000     76           HALT ×1,203"
    );
  });

  it("gives the exporter's viewer columns the same lines as formatHistoryRow", async () => {
    const records = program();
    const newest = records[records.length - 1].sequence;
    const lines = await exportLines(records, { columns: VIEWER_TRACE_COLUMNS, repeats: true });
    const expected = await Promise.all(
      records.map(async (r) => {
        const op = OPCODES[r.bytes[0]];
        const next = records[records.indexOf(r) + 1];
        const changes =
          r.kind === HistoryKind.Instruction && next
            ? (await exportLines([r, next], { columns: ["changes"] }))[0]
            : undefined;
        return formatHistoryRow({
          record: r,
          step: r.sequence - newest - 1,
          instruction: r.kind === HistoryKind.Instruction ? op?.[0] : undefined,
          length: r.kind === HistoryKind.Instruction ? op?.[1] : undefined,
          changes: changes || undefined
        });
      })
    );
    expect(lines).toEqual(expected);
  });
});

describe("trace export: header (D9)", () => {
  const meta: TraceMeta = {
    machineId: "sp48",
    newestSequence: 1006,
    appVersion: "0.52.0",
    machineName: "ZX Spectrum 48K",
    range: { first: 1000, last: 1006, firstFrame: 120, lastFrame: 121 },
    tactUnit: "T-states",
    mainFile: "main.asm"
  };

  it("starts a text trace with ; comment lines naming the machine, range, columns and options", async () => {
    const lines = await exportLines(program(), { header: true }, meta);
    const header = lines.filter((l) => l.startsWith(";"));
    expect(header).toEqual([
      "; Klive IDE 0.52.0 execution trace",
      "; Machine: ZX Spectrum 48K",
      "; Range: #1000..#1006, 7 records, frames 0–1",
      "; Columns: frame tact addr bytes instr changes",
      "; Time: frame and seq relative to the range's first record (frame 120, #1000); tact is the position in the frame, in T-states",
      "; Options: repeat counts masked (×*); interrupt service kept",
      "; Main file: main.asm (labels and source lines from its current compilation)"
    ]);
    expect(lines.slice(header.length)).toEqual(await exportLines(program(), {}, meta));
  });

  it("names the cursor's step, the filter, and the register order", () => {
    const lines = traceHeaderLines(
      { ...meta, cursorStep: -12, filter: "$8000-$80FF" },
      { ...defaultTraceOptions("text"), columns: TRACE_COLUMNS, absolute: true, interrupts: "dropWithMarkers" }
    );
    expect(lines).toContain("Range: #1000..#1006, 7 records, frames 120–121");
    expect(lines).toContain("Filter: $8000-$80FF");
    expect(lines).toContain("History cursor: step −12 (the trace covers the present's history)");
    expect(lines).toContain("regs: AF BC DE HL AF' BC' DE' HL' IX IY SP I R WZ, before the instruction");
    expect(lines).toContain("flags: IFF1 IFF2 IM");
    expect(lines.join("\n")).toMatch(/interrupt service dropped, with markers/);
  });

  it("holds no export time: two exports of the same run are byte-identical", async () => {
    const one = await collectTrace(exportTrace([program()], meta, [], defaultTraceOptions("text"), resolvers()), { format: "text", bom: false });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const two = await collectTrace(exportTrace([program()], meta, [], defaultTraceOptions("text"), resolvers()), { format: "text", bom: false });
    expect(one.text).toBe(two.text);
    expect(one.text.endsWith("\n")).toBe(true);
    expect(one.text).not.toMatch(/\r/);
    expect(one.lines).toBe(7 + 7);
  });
});

describe("trace export: CSV", () => {
  it("writes a header row, CRLF line ends and one cell per register (D1, D4)", async () => {
    const { text } = await collectTrace(
      exportTrace(
        [program()],
        { newestSequence: 1006, afterLast: record().regs },
        [],
        { ...defaultTraceOptions("csv"), columns: TRACE_COLUMNS, repeats: true },
        resolvers({ partitionLabel: () => "R0", source: (r) => (r.regs.pc === 0x8000 ? "main.asm:3" : undefined) })
      ),
      { format: "csv", bom: false }
    );
    expect(text.split("\r\n")).toHaveLength(9);
    const rows = parseCsv(text);
    const names = rows[0];
    expect(names).toEqual(traceCsvColumnNames(TRACE_COLUMNS));
    expect(names).toEqual([
      "seq", "step", "frame", "tact", "part", "addr", "bytes", "instr", "repeat", "source", "changes",
      "AF", "BC", "DE", "HL", "AF'", "BC'", "DE'", "HL'", "IX", "IY", "SP", "I", "R", "WZ",
      "IFF1", "IFF2", "IM", "ctx"
    ]);
    const cell = (row: number, name: string) => rows[row][names.indexOf(name)];
    expect(cell(1, "step")).toBe("-7");
    expect(cell(1, "part")).toBe("R0");
    expect(cell(1, "addr")).toBe("8000");
    expect(cell(1, "bytes")).toBe("21 01 80");
    expect(cell(1, "instr")).toBe("ld hl,$8001");
    expect(cell(1, "source")).toBe("main.asm:3");
    expect(cell(1, "changes")).toBe("HL=8001");
    expect(cell(1, "SP")).toBe("FFFE");
    // --- HALT: the count in its own column, not in the text
    expect(cell(3, "instr")).toBe("HALT");
    expect(cell(3, "repeat")).toBe("1203");
    // --- The interrupt: a separator text, no address
    expect(cell(4, "instr")).toBe("— IM 1 interrupt —");
    expect(cell(4, "addr")).toBe("");
    expect(cell(4, "IM")).toBe("1");
    expect(cell(6, "IFF1")).toBe("1");
  });

  it("leaves the repeat column empty unless -repeats (D6)", async () => {
    const rows = parseCsv((await exportLines(program(), { format: "csv", columns: ["instr"] })).join("\r\n"));
    expect(rows[3]).toEqual(["HALT", ""]);
  });

  it("writes numbers bare and text quoted, with ASCII minus (T7)", async () => {
    const lines = await exportLines(program(), { format: "csv", columns: ["step", "frame", "addr", "instr"] });
    expect(lines[0]).toBe('"step","frame","part","addr","instr","repeat"');
    expect(lines[1]).toBe('-7,0,,"8000","ld hl,$8001",');
  });

  it("guards cells a spreadsheet would run as a formula (T6)", async () => {
    const lines = await exportLines(
      [record({ bytes: [0x00, 0, 0, 0] })],
      { format: "csv", columns: ["instr", "source"] },
      {},
      [],
      resolvers({ instruction: async () => ({ text: "=CMD", length: 1 }), source: () => "+x.asm:1" })
    );
    expect(lines[1]).toBe(`"'=CMD",,"'+x.asm:1"`);
    expect(csvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
    expect(csvCell("-1+2")).toBe(`"'-1+2"`);
    expect(csvCell(-42, true)).toBe("-42");
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvRow([csvCell("a,b"), csvCell(1, true)])).toBe('"a,b",1');
  });

  it("writes markers in the instruction column", async () => {
    const rows = parseCsv(
      (await exportLines(program(), { format: "csv", columns: ["frame", "addr", "instr"], interrupts: "dropWithMarkers" }, {}, [SERVICE])).join("\r\n")
    );
    expect(rows[4]).toEqual(["1", "", "", "… interrupt service, 2 instructions …", ""]);
  });

  it("starts with a BOM only when asked (T7)", async () => {
    const lines = async () => exportTrace([program()], { newestSequence: 1006 }, [], defaultTraceOptions("csv"), resolvers());
    expect((await collectTrace(await lines(), { format: "csv", bom: false })).text.charCodeAt(0)).toBe(0x22);
    expect((await collectTrace(await lines(), { format: "csv", bom: true })).text.charCodeAt(0)).toBe(0xfeff);
  });

  it("has no metadata rows even with a header asked for (Q6)", async () => {
    const lines = await exportLines(program(), { format: "csv", header: true });
    expect(lines[0].startsWith('"frame"')).toBe(true);
    expect(lines).toHaveLength(8);
  });
});

describe("trace export: parsing", () => {
  it("picks the format from the extension (D1)", () => {
    expect(traceFormatOfName("run1.txt")).toBe("text");
    expect(traceFormatOfName("run1.LOG")).toBe("text");
    expect(traceFormatOfName("a/b/run.trace")).toBe("text");
    expect(traceFormatOfName("run.csv")).toBe("csv");
    expect(traceFormatOfName("run.bin")).toBeUndefined();
  });

  it("parses -columns into the canonical order (D2)", () => {
    expect(parseTraceColumns("default")).toEqual(["frame", "tact", "addr", "bytes", "instr", "changes"]);
    expect(parseTraceColumns("viewer")).toEqual(VIEWER_TRACE_COLUMNS);
    expect(parseTraceColumns("ALL")).toEqual(TRACE_COLUMNS);
    expect(parseTraceColumns("instr,addr,instr")).toEqual(["addr", "instr"]);
    expect(parseTraceColumns("addr,pc")).toMatch(/Unknown column 'pc'/);
    expect(parseTraceColumns(",")).toBe("No columns given");
  });

  it("builds the command line the menu and the document run", () => {
    expect(historyExportCommandText("/tmp/run 1.txt", { overwrite: true })).toBe('history-export "/tmp/run 1.txt" -f');
    expect(historyExportCommandText("t.csv", { from: 42, filter: ' $8000-$80FF ', noInterrupts: true })).toBe(
      'history-export "t.csv" -from #42 -filter "$8000-$80FF" -nointerrupts'
    );
  });
});
