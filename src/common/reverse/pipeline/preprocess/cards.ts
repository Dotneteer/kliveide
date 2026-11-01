import type { RomAnalysis, RoutineAnalysis } from "./analyse";
import type { Reg, RegisterFacts } from "./registers";

/*
 * Stage 14's text outputs (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §4.1, §4.3): the routine cards the
 * AI reads instead of the listing, the page overview, the open questions, and the machine-readable
 * facts. Facts only (D7): no suggested names, synopses or purposes.
 */

export type CardFile = { name: string; text: string };

/** One range file per range: its routines' cards in bottom-up order (callees first). */
export function renderCardFiles(analysis: RomAnalysis): CardFile[] {
  const byStart = new Map(analysis.routines.map((r) => [r.routine.start, r]));
  return analysis.ranges.map((range, i) => {
    const name = `range-${String(i + 1).padStart(2, "0")}.txt`;
    const header = [
      `# ${analysis.image.name} page ${analysis.bankId}, range ${i + 1} of ${analysis.ranges.length}: ${range.length} routine(s)`,
      `# Cards are in bottom-up order: a routine's callees come before it. Facts only; the names, synopses`,
      `# and comments are yours to write (.ann). Write feedback lines when a card misses or gets a fact wrong.`,
      ""
    ];
    return { name, text: `${[...header, ...range.map((start) => renderCard(analysis, byStart.get(start)!))].join("\n")}\n` };
  });
}

/** One routine's card. */
export function renderCard(analysis: RomAnalysis, item: RoutineAnalysis): string {
  const { routine } = item;
  const origin = analysis.decoded.origin;
  const name = (offset: number) => analysis.labels.get(offset);
  const at = (offset: number) => `$${hex(offset)}${name(offset) ? ` ${name(offset)}` : ""}`;
  const run = origin ? ` (run $${hex(origin + routine.start)})` : "";
  const lines: string[] = [];
  lines.push(`== $${hex(routine.start)}${routine.label ? ` ${routine.label}` : ""}${run}  ${routine.kind}, ${routine.rows.filter((r) => !r.data).length} instruction(s), ${routine.end - routine.start + 1} byte(s)`);

  // --- Callers are listed once, from the call graph; the evidence adds only what has no caller row
  const entries = routine.evidence.filter((e) => !["label", "call", "rst", "jump", "table", "profile"].includes(e.source));
  const callers = routine.callers.map((c) => (c.how === "profile" ? "profile run" : `${c.how} $${hex(c.from)}`));
  lines.push(`   in from:  ${[...entries.map((e) => (e.note ? `${e.source} (${e.note})` : e.source)), ...callers].join("; ") || "—"}`);
  const calls = routine.calls.map((c) => (c.target !== undefined ? at(c.target) : `$${hex(c.address ?? 0)} (outside the page)`));
  lines.push(`   calls:    ${unique(calls).join(", ") || "—"}`);
  const jumps = routine.jumpsOut.map((j) => (j.target !== undefined ? at(j.target) : `$${hex(j.address ?? 0)} (outside the page)`));
  if (jumps.length || routine.fallsThrough) {
    lines.push(`   leaves:   ${[...unique(jumps), ...(routine.fallsThrough ? ["falls through into the next routine"] : [])].join(", ")}`);
  }
  if (item.registers) lines.push(...registerLines(item.registers));
  const memory = item.memory;
  const ram = [
    memory.reads.length ? `reads ${memory.reads.map(address(analysis)).join(", ")}` : "",
    memory.writes.length ? `writes ${memory.writes.map(address(analysis)).join(", ")}` : ""
  ].filter(Boolean);
  if (ram.length) lines.push(`   memory:   ${ram.join("; ")}`);
  const io = [
    memory.portsIn.length ? `in ${memory.portsIn.map(port).join(", ")}` : "",
    memory.portsOut.length ? `out ${memory.portsOut.map(port).join(", ")}` : "",
    memory.nextRegs.length ? `nextreg ${memory.nextRegs.map((r) => `$${hex2(r)}`).join(", ")}` : ""
  ].filter(Boolean);
  if (io.length) lines.push(`   I/O:      ${io.join("; ")}`);
  const coverage = item.coverage;
  lines.push(
    `   coverage: ${coverage.profiled ? (coverage.executed ? `ran (${coverage.executed} of ${coverage.rows} instructions)` : "never ran in the profile") : "no profile"}`
  );
  if (coverage.dataReadInCode.length) lines.push(`   note:     ${coverage.dataReadInCode.length} byte(s) of this code were read as data and never fetched`);

  lines.push("   ---");
  for (const row of routine.rows) {
    const bytes = row.bytes.map((b) => hex2(b)).join(" ");
    const addr = origin ? `@${hex(origin + row.offset)} ` : "";
    const text = nameOperands(analysis, row.text, row.branch?.target);
    const decoder = row.comment ? `  ; ${row.comment}` : "";
    const comment = item.comments.get(row.offset);
    lines.push(`   ${hex(row.offset)} ${addr}${bytes.padEnd(12)} ${text}${decoder}${comment ? `  ;; ${comment.replace(/\n/g, " / ")}` : ""}`);
  }
  // --- Hidden entries into this routine's bytes: what the CPU runs when it jumps there
  const hidden = analysis.routineMap.midInstructionTargets.filter((t) => t.target >= routine.start && t.target <= routine.end);
  for (const target of [...new Map(hidden.map((h) => [h.target, h])).values()]) {
    const froms = hidden.filter((h) => h.target === target.target).map((h) => `$${hex(h.from)}`);
    lines.push(`   hidden entry $${hex(target.target)} (from ${froms.join(", ")}), inside an instruction above:`);
    let offset: number | undefined = target.target;
    for (let i = 0; offset !== undefined && i < 16; i++) {
      const row = analysis.decoded.hidden.get(offset);
      if (!row) {
        if (analysis.decoded.at.has(offset)) lines.push(`     ... then in step with $${hex(offset)} above`);
        break;
      }
      lines.push(`     ${hex(row.offset)} ${row.bytes.map((b) => hex2(b)).join(" ").padEnd(12)} ${nameOperands(analysis, row.text, row.branch?.target)}`);
      const stops = row.branch && !row.branch.condition && ["jp", "jr", "ret", "jp-indirect"].includes(row.branch.kind);
      offset = stops ? undefined : row.offset + row.length;
    }
  }
  lines.push("   ---");
  if (item.synopsis !== undefined) {
    lines.push("   synopsis (in the sidecar):");
    for (const line of item.synopsis.split("\n")) lines.push(`     ${line}`);
  }
  const work = item.work;
  const needed = [
    work.label ? "a label" : "",
    work.synopsis ? "a synopsis" : "",
    work.contractLines.length ? `the synopsis's ${work.contractLines.join(" ")} line(s)` : "",
    work.failureExitWithoutError ? "an Error: line (one return sets carry or zero, another clears it)" : "",
    work.uncommented ? `${work.uncommented} uncommented instruction(s)` : "",
    work.unknownFacts ? `${work.unknownFacts} register fact(s) to settle` : ""
  ].filter(Boolean);
  lines.push(`   needed:   ${needed.join("; ") || "nothing"}`);
  lines.push("");
  return lines.join("\n");
}

function registerLines(facts: RegisterFacts): string[] {
  const lines: string[] = [];
  lines.push(`   inputs:   ${regList(facts.inputs) || "none"} (read before written)`);
  if (facts.returns) {
    lines.push(`   changes:  ${regList(facts.changes) || "none"}`);
    lines.push(`   keeps:    ${regList(facts.keeps.filter((r) => !r.endsWith("'"))) || "none"}`);
    if (facts.moved.length) lines.push(`   moved:    ${facts.moved.map((m) => `${m.reg} = entry ${m.from}`).join(", ")}`);
  } else {
    lines.push("   returns:  no return is reachable");
  }
  const exits = facts.exits.map((e) => {
    const known = [
      e.known.carry !== undefined ? `carry ${e.known.carry}` : "",
      e.known.zero !== undefined ? `zero ${e.known.zero}` : "",
      e.known.a !== undefined ? `A = $${hex2(e.known.a)}` : ""
    ].filter(Boolean);
    return `$${hex(e.offset)} ${e.kind}${e.condition ? ` ${e.condition}` : ""}${known.length ? ` (${known.join(", ")})` : ""}`;
  });
  if (exits.length) lines.push(`   exits:    ${exits.join("; ")}`);
  for (const u of facts.unknowns) lines.push(`   unknown:  $${hex(u.offset)} ${u.reason}`);
  return lines;
}

/** Registers as the D10 lines write them: pairs where both halves are there, alternates last. */
export function regList(regs: readonly Reg[]): string {
  const set = new Set(regs);
  const out: string[] = [];
  const pairs: [string, Reg, Reg][] = [
    ["AF", "A", "F"],
    ["BC", "B", "C"],
    ["DE", "D", "E"],
    ["HL", "H", "L"],
    ["IX", "IXH", "IXL"],
    ["IY", "IYH", "IYL"],
    ["AF'", "A'", "F'"],
    ["BC'", "B'", "C'"],
    ["DE'", "D'", "E'"],
    ["HL'", "H'", "L'"]
  ];
  for (const [pair, hi, lo] of pairs) {
    if (set.has(hi) && set.has(lo)) out.push(pair);
    else {
      if (set.has(hi)) out.push(hi);
      if (set.has(lo)) out.push(lo);
    }
  }
  return out.join(", ");
}

/** The instruction text with the page's labels on its branch target and on addresses that are labels. */
function nameOperands(analysis: RomAnalysis, text: string, target: number | undefined): string {
  const origin = analysis.decoded.origin;
  const names: string[] = [];
  const named = text.replace(/\$([0-9A-F]{4})\b/g, (match, digits) => {
    const offset = parseInt(digits, 16) - origin;
    const label = analysis.labels.get(offset);
    if (!label) return match;
    if (offset === target) return label;
    names.push(`${match} = ${label}`);
    return match;
  });
  return names.length ? `${named}  {${names.join(", ")}}` : named;
}

function address(analysis: RomAnalysis) {
  return (value: number) => {
    const offset = value - analysis.decoded.origin;
    const label = offset >= 0 && offset < analysis.decoded.size ? analysis.labels.get(offset) : undefined;
    return `$${hex(value)}${label ? ` ${label}` : ""}`;
  };
}

function port(value: number | "bc"): string {
  return value === "bc" ? "(C) with BC" : `$${hex2(value)}`;
}

/** The page at a glance: what the AI reads first (§7 step 1). */
export function renderOverview(analysis: RomAnalysis): string {
  const routines = analysis.routines;
  const count = (kind: string) => routines.filter((r) => r.routine.kind === kind).length;
  const work = routines.reduce((sum, r) => sum + r.work.weight, 0);
  const lines = [
    `# ${analysis.image.name} page ${analysis.bankId}`,
    "",
    `CPU ${analysis.image.cpu}; ROM kind ${analysis.image.romKind ?? "unknown"}; decoded at $${hex(analysis.decoded.origin)}; ${analysis.decoded.size} bytes.`,
    `${routines.length} routines: ${count("subroutine")} subroutines, ${count("jump-target")} jump targets, ${count("entry-point")} entry points, ${count("unreached")} unreached.`,
    `Work left (weight): ${work}, in ${analysis.ranges.length} range(s). Open questions: ${analysis.questions.length} (questions.md).`,
    "",
    "## Code regions",
    "",
    ...analysis.decoded.code.map((r) => `- $${hex(r.start)}-$${hex(r.end)}`),
    "",
    "## Routines",
    "",
    "| Offset | Label | Kind | Bytes | Callers | Work |",
    "|---|---|---|---|---|---|",
    ...routines.map(
      (r) =>
        `| $${hex(r.routine.start)} | ${r.routine.label ?? ""} | ${r.routine.kind} | ${r.routine.end - r.routine.start + 1} | ${r.routine.callers.length} | ${r.work.weight} |`
    ),
    "",
    "## Ranges",
    "",
    ...analysis.ranges.map((range, i) => `- range-${String(i + 1).padStart(2, "0")}.txt: ${range.length} routine(s), weight ${range.reduce((s, start) => s + (routines.find((r) => r.routine.start === start)?.work.weight ?? 0), 0)}`),
    ""
  ];
  return lines.join("\n");
}

export function renderQuestions(analysis: RomAnalysis): string {
  const lines = [`# ${analysis.image.name} page ${analysis.bankId}: open questions`, ""];
  if (!analysis.questions.length) lines.push("None.");
  for (const q of analysis.questions) lines.push(`- ${q}`);
  return `${lines.join("\n")}\n`;
}

/** Everything as JSON, without the decoded rows: for the postprocessor and the tests. */
export function factsJson(analysis: RomAnalysis): unknown {
  return {
    rom: analysis.image.name,
    page: Number(analysis.bankId),
    cpu: analysis.image.cpu,
    origin: analysis.decoded.origin,
    routines: analysis.routines.map((r) => ({
      start: r.routine.start,
      end: r.routine.end,
      label: r.routine.label,
      kind: r.routine.kind,
      evidence: r.routine.evidence,
      callers: r.routine.callers,
      calls: r.routine.calls,
      jumpsOut: r.routine.jumpsOut,
      fallsThrough: r.routine.fallsThrough,
      registers: r.registers,
      memory: r.memory,
      coverage: { ...r.coverage, dataReadInCode: r.coverage.dataReadInCode.length },
      work: r.work
    })),
    midInstructionTargets: analysis.routineMap.midInstructionTargets,
    ranges: analysis.ranges
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function hex(value: number): string {
  return value.toString(16).padStart(4, "0").toUpperCase();
}

function hex2(value: number): string {
  return value.toString(16).padStart(2, "0").toUpperCase();
}
