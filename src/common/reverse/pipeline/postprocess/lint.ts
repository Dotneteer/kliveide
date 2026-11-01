import type { RomAnalysis, RoutineAnalysis } from "../preprocess/analyse";
import { REGS, type Reg } from "../preprocess/registers";

/*
 * The postprocessor's lint (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §6.2, P7): the house style the
 * sessions enforced by eye, as checks, each with the fix to make. It looks only at what the `.ann` files
 * set (`touched`), so a carried or finished sidecar's other entries do not drown the list.
 *
 * The D10 contract is checked against the register facts, which are conservative ("may change": a value
 * restored by arithmetic reads as changed). So only a **definite** contradiction is a problem (a
 * register in `Changes:` that every return keeps); the rest are questions for the AI to settle.
 */

export type LintItem = {
  severity: "problem" | "question";
  offset: number;
  /** The rule, for counting (`comment-length`, `contract-changes`). */
  rule: string;
  message: string;
  fix: string;
};

export type LintInputs = {
  analysis: RomAnalysis;
  /** The offsets whose label or line the files set. */
  touched: { labels: ReadonlySet<number>; lines: ReadonlySet<number> };
  /** Labels of other sidecars, by name, for clashes. */
  otherLabels?: ReadonlyMap<string, { sidecar: string; offset: number }[]>;
};

const CONTRACT_ORDER = ["Entry:", "Exit:", "Error:", "Changes:", "Keeps:", "Observed:"];
const REQUIRED = ["Entry:", "Exit:", "Changes:"];
const HEDGES = /\b(probably|presumably|unclear|maybe|perhaps|possibly|seems|might be|apparently)\b/i;
const MNEMONICS = /^(ld|add|adc|sub|sbc|and|or|xor|cp|inc|dec|push|pop|jp|jr|call|ret|rst|djnz|ex|exx|rl|rr|rlc|rrc|sla|sra|srl|bit|set|res|in|out|neg|cpl|scf|ccf|halt|di|ei|im)\b/i;

export function lint(inputs: LintInputs): LintItem[] {
  const { analysis, touched } = inputs;
  const items: LintItem[] = [];
  const add = (severity: LintItem["severity"], offset: number, rule: string, message: string, fix: string) =>
    items.push({ severity, offset, rule, message, fix });
  const routineAt = new Map(analysis.routines.map((r) => [r.routine.start, r]));
  const rowAt = analysis.decoded.at;

  // --- Labels
  for (const offset of touched.labels) {
    const name = analysis.labels.get(offset);
    if (!name) continue;
    if (name.length > 16) add("problem", offset, "label-length", `${name} has ${name.length} characters`, "shorten it to 16 characters or fewer");
    for (const other of inputs.otherLabels?.get(name) ?? []) {
      add("question", offset, "label-clash", `${name} is also a label in ${other.sidecar} ($${hex(other.offset)})`, "keep it only if it is the same job there; else name it after what this code does");
    }
  }

  // --- Lines
  for (const offset of touched.lines) {
    const routine = routineAt.get(offset);
    const synopsis = routine?.synopsis;
    const comment = commentAt(analysis, offset);
    if (comment !== undefined) {
      if (comment.length >= 70) add("problem", offset, "comment-length", `the comment has ${comment.length} characters`, "say it in under 70, or move the detail to the synopsis");
      if (/\.$/.test(comment) && !/\.\.\.$/.test(comment)) add("problem", offset, "comment-stop", "the comment ends with a full stop", "drop the full stop");
      const row = rowAt.get(offset);
      if (row && restates(comment, row.text)) add("problem", offset, "comment-restates", `the comment restates "${row.text}"`, "say what the value means, not what the instruction does");
      if (HEDGES.test(comment)) add("question", offset, "hedge", `the comment hedges: "${comment}"`, "settle it from the code or a run, or say what is not known and why");
    }
    if (synopsis !== undefined && HEDGES.test(synopsis)) {
      add("question", offset, "hedge", `the synopsis hedges ("${HEDGES.exec(synopsis)![0]}")`, "settle it from the code or a run (a question line), or say what is not known");
    }
    if (routine && synopsis !== undefined && routine.routine.kind === "subroutine") items.push(...contractItems(routine, synopsis));
  }
  return items.sort((a, b) => a.offset - b.offset || (a.severity === b.severity ? 0 : a.severity === "problem" ? -1 : 1));
}

function commentAt(analysis: RomAnalysis, offset: number): string | undefined {
  for (const r of analysis.routines) {
    if (offset >= r.routine.start && offset <= r.routine.end) return r.comments.get(offset);
  }
  return undefined;
}

/** Whether a comment only repeats its instruction: its mnemonic and operands. */
function restates(comment: string, instruction: string): boolean {
  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ").replace(/\$([0-9a-f]+)/g, "$1").trim();
  return norm(comment) === norm(instruction) || (MNEMONICS.test(comment) && norm(comment).startsWith(norm(instruction).split(",")[0]));
}

/** The D10 lines of a subroutine's synopsis, against its register facts. */
function contractItems(item: RoutineAnalysis, synopsis: string): LintItem[] {
  const offset = item.routine.start;
  const items: LintItem[] = [];
  const lines = synopsis.split("\n");
  const present = CONTRACT_ORDER.map((key) => ({ key, at: lines.findIndex((l) => l.startsWith(key)) })).filter((p) => p.at >= 0);
  for (const key of REQUIRED) {
    if (!present.some((p) => p.key === key)) {
      items.push({ severity: "problem", offset, rule: "contract-missing", message: `the synopsis has no ${key} line (D10)`, fix: `add "${key} ..." (none: "${key} none.")` });
    }
  }
  for (let i = 1; i < present.length; i++) {
    if (present[i].at < present[i - 1].at) {
      items.push({ severity: "problem", offset, rule: "contract-order", message: `${present[i].key} comes before ${present[i - 1].key}`, fix: `order the lines ${CONTRACT_ORDER.join(" ")}` });
    }
  }
  const facts = item.registers;
  if (!facts?.returns) return items;
  const line = (key: string) => {
    const at = lines.findIndex((l) => l.startsWith(key));
    if (at < 0) return undefined;
    // --- A line runs on over the lines below it that are not another contract line
    let text = lines[at].slice(key.length);
    for (let i = at + 1; i < lines.length && !CONTRACT_ORDER.some((k) => lines[i].startsWith(k)); i++) text += ` ${lines[i]}`;
    return text;
  };
  const changesText = line("Changes:");
  const keepsText = line("Keeps:");
  const changes = changesText === undefined ? undefined : parseRegisters(changesText);
  const keeps = keepsText === undefined ? undefined : parseRegisters(keepsText);
  const settled = facts.unknowns.length === 0;
  const moved = new Set(facts.moved.map((m) => m.reg));
  if (changes) {
    for (const reg of changes) {
      if (settled && facts.keeps.includes(reg)) {
        items.push({ severity: "problem", offset, rule: "contract-changes", message: `Changes: names ${reg}, but every return keeps it`, fix: `take ${reg} out of Changes:` });
      }
    }
    for (const reg of facts.changes) {
      if (!changes.has(reg) && !keeps?.has(reg) && !moved.has(reg)) {
        items.push({
          severity: "question",
          offset,
          rule: "contract-unlisted",
          message: `${reg} may change on some path (${settled ? "the facts" : "the facts, with unknowns"}) but Changes: does not name it`,
          fix: `add ${reg} to Changes:, or settle from the code that the value comes back`
        });
      }
    }
  }
  if (keeps) {
    for (const reg of keeps) {
      if (reg.endsWith("'")) items.push({ severity: "problem", offset, rule: "contract-keeps-alt", message: `Keeps: names ${reg}`, fix: "leave the alternates out of Keeps: (an alternate not in Changes: is kept)" });
      else if (facts.changes.includes(reg)) {
        items.push({ severity: "question", offset, rule: "contract-keeps", message: `Keeps: names ${reg}, which the facts say may change`, fix: "check that the value comes back (a restore by arithmetic the pass cannot see), else move it to Changes:" });
      }
    }
  }
  if (changes === undefined && changesText !== undefined) {
    items.push({ severity: "question", offset, rule: "contract-unread", message: "Changes: could not be read as registers", fix: 'write registers ("AF, BC, AF\'", "A, F, C", "all alternates", "none"), other state after a semicolon' });
  }
  return items;
}

const PAIRS: Record<string, Reg[]> = {
  AF: ["A", "F"],
  BC: ["B", "C"],
  DE: ["D", "E"],
  HL: ["H", "L"],
  IX: ["IXH", "IXL"],
  IY: ["IYH", "IYL"],
  "AF'": ["A'", "F'"],
  "BC'": ["B'", "C'"],
  "DE'": ["D'", "E'"],
  "HL'": ["H'", "L'"]
};

/**
 * The registers a `Changes:`/`Keeps:` line names (the part before a semicolon): pairs, halves, primes,
 * "all alternates", "none". Undefined when a word is not a register.
 */
export function parseRegisters(text: string): Set<Reg> | undefined {
  const head = text.split(";")[0].replace(/\.\s*$/, "").trim();
  const result = new Set<Reg>();
  if (/^none$/i.test(head) || head === "") return result;
  for (const raw of head.split(/,\s*|\s+and\s+/)) {
    const word = raw.trim().replace(/^the\s+/i, "");
    if (!word) continue;
    if (/^all alternates$|^alternate set$/i.test(word)) {
      for (const r of REGS) if (r.endsWith("'")) result.add(r);
      continue;
    }
    const upper = word.toUpperCase();
    if (PAIRS[upper]) PAIRS[upper].forEach((r) => result.add(r));
    else if ((REGS as readonly string[]).includes(upper)) result.add(upper as Reg);
    else if (/^(IXH|IXL|IYH|IYL)$/.test(upper)) result.add(upper as Reg);
    else return undefined;
  }
  return result;
}

function hex(value: number): string {
  return value.toString(16).padStart(4, "0").toUpperCase();
}
