import { PF_EXECUTED } from "@common/profile/profileTypes";
import type { RomLevelReport } from "@common/roms/romAnnotationTools";
import type { RomAnalysis } from "../preprocess/analyse";
import type { CompileResult } from "./compile";
import type { LintItem } from "./lint";

/*
 * The postprocessor's two reports (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §6.1, D11, P7):
 *
 * - `problems.md`: what the AI must fix, each item with the fix ("add a label at $3688: called from
 *   $3891, ran in the profile");
 * - `feedback.md`: what the run says about the *tools*, from the `feedback` lines and from signals the
 *   AI does not have to report, grouped by preprocessor stage, each with a proposed change for the
 *   session to review with the project author (accepted ones go to `pipeline-backlog.md`).
 */

export type ProblemReportInputs = {
  page: number;
  files: string[];
  result: CompileResult;
  level: RomLevelReport;
  lint: LintItem[];
  /** The compiled page's analysis: callers and coverage for the unlabelled targets. */
  analysis: RomAnalysis;
  flags?: readonly number[];
};

export function renderProblems(inputs: ProblemReportInputs): string[] {
  const { result, level, lint, analysis } = inputs;
  const at = (p: { file?: string; line?: number }) => (p.file ? `${p.file}${p.line ? `:${p.line}` : ""}: ` : "");
  const lines = [`## Page ${inputs.page}`, "", `Files: ${inputs.files.join(", ")}`, ""];
  lines.push(
    `Level ${level.level}: ${level.instructions} instructions, ${level.unlabelledTargets.length} unlabelled target(s), ` +
      `${level.labelsWithoutSynopsis.length} label(s) without a synopsis, ${level.misplacedLabels.length} misplaced label(s).`,
    ""
  );
  /** A section's first 200 items: a new ROM has hundreds of unlabelled targets. */
  const section = (title: string, items: string[]) => {
    if (!items.length) return;
    lines.push(`### ${title}`, "", ...items.slice(0, 200).map((i) => `- ${i}`));
    if (items.length > 200) lines.push(`- ... and ${items.length - 200} more`);
    lines.push("");
  };
  section("Errors (nothing was written)", result.problems.filter((p) => p.severity === "error").map((p) => `${at(p)}${p.message}`));
  section("Problems", lint.filter((l) => l.severity === "problem").map((l) => `$${hex(l.offset)} ${l.message}: ${l.fix}`));

  // --- The level's to-do list, with what the analysis knows about each item
  const callers = new Map<number, string[]>();
  for (const row of analysis.decoded.rows) {
    const t = row.branch?.target;
    if (t !== undefined) callers.set(t, [...(callers.get(t) ?? []), `${row.branch!.kind} $${hex(row.offset)}`]);
  }
  section(
    "Unlabelled targets",
    level.unlabelledTargets.map((t) => {
      const ran = inputs.flags ? (inputs.flags[t] & PF_EXECUTED ? ", ran in the profile" : ", never ran in the profile") : "";
      return `$${hex(t)}: add a label (named by ${(callers.get(t) ?? ["?"]).slice(0, 3).join(", ")}${ran})`;
    })
  );
  const kindOf = new Map(analysis.routines.map((r) => [r.routine.label, r.routine.kind]));
  section("Labels without a synopsis", level.labelsWithoutSynopsis.map((name) => `${name}: write a synopsis (${kindOf.get(name) ?? "label"}${kindOf.get(name) === "subroutine" ? ", with the D10 lines" : ""})`));
  section("Misplaced labels", level.misplacedLabels.map((name) => `${name}: move it to an instruction start in a code region, or make its bytes code`));
  section("Questions to settle", [
    ...lint.filter((l) => l.severity === "question").map((l) => `$${hex(l.offset)} ${l.message}: ${l.fix}`),
    ...result.questions.map((q) => `$${hex(q.offset)} ${q.text} (${q.file}:${q.line}): settle with a run, then write an Observed: line`)
  ]);
  section("Warnings", result.problems.filter((p) => p.severity === "warning").map((p) => `${at(p)}${p.message}`));
  section("Numbers named", result.swaps.map((s) => `$${hex(s.offset)}: ${s.swaps.join(", ")}`));
  section(
    "Base entries changed",
    result.changes.map((c) => `$${hex(c.offset)} ${c.what}: ${JSON.stringify(c.before ?? "")} -> ${JSON.stringify(c.after ?? "(deleted)")} (${c.file}:${c.line})`)
  );
  return lines;
}

// ------------------------------------------------------------------------------------------------
// Feedback (D11)

export type FeedbackStage = "cards" | "register facts" | "detectors" | "conventions" | "alignment" | "postprocessor";

export type FeedbackSignal = {
  stage: FeedbackStage;
  /** Where it comes from: `asked` (a feedback line) or `measured`. */
  source: "asked" | "measured";
  title: string;
  count: number;
  addresses: number[];
  details: string[];
  proposal: string;
};

export type FeedbackInputs = {
  result: CompileResult;
  lint: LintItem[];
  analysis: RomAnalysis;
  /** `listing` requests recorded by the CLI. */
  listingRequests: { page: number; from: number; to: number; why?: string }[];
  /** The proposals `prepare` made for the page (its facts.json), when there is one. */
  proposals?: { start: number; end: number; kind: string }[];
  /** Earlier compiles of the page: their problem keys, oldest first. */
  history: { at: string; keys: string[] }[];
};

const FEEDBACK_STAGE: Record<string, FeedbackStage> = { missing: "cards", wrong: "cards", pattern: "conventions", listing: "cards" };

export function feedbackSignals(inputs: FeedbackInputs): FeedbackSignal[] {
  const signals: FeedbackSignal[] = [];
  const { result, lint, analysis } = inputs;

  // --- Asked for: the feedback lines, by kind
  for (const kind of ["missing", "wrong", "pattern", "listing"]) {
    const lines = result.feedback.filter((f) => f.kind === kind);
    if (!lines.length) continue;
    signals.push({
      stage: FEEDBACK_STAGE[kind],
      source: "asked",
      title: `feedback ${kind}`,
      count: lines.length,
      addresses: lines.map((f) => f.from),
      details: lines.map((f) => `$${hex(f.from)}${f.to !== f.from ? `-$${hex(f.to)}` : ""}: ${f.text} (${f.file}:${f.line})`),
      proposal:
        kind === "missing"
          ? "add the fact to the cards (stage 9-11), or a convention that knows it"
          : kind === "wrong"
            ? "find the stage that produced the fact and add the case as a test"
            : kind === "pattern"
              ? "write it as a convention plug-in (conventions/), with its source (D4)"
              : "find what the card lacked that the listing gave"
    });
  }

  // --- Measured: listing requests
  if (inputs.listingRequests.length) {
    signals.push({
      stage: "cards",
      source: "measured",
      title: "listing requests",
      count: inputs.listingRequests.length,
      addresses: inputs.listingRequests.map((r) => r.from),
      details: inputs.listingRequests.map((r) => `$${hex(r.from)}-$${hex(r.to)}${r.why ? `: ${r.why}` : ""}`),
      proposal: "each is a card that was not enough: read the reason and add what was missing"
    });
  }

  // --- Measured: text that contradicts a definite fact (the AI or the pass is wrong)
  const contradictions = lint.filter((l) => l.rule === "contract-changes");
  if (contradictions.length) {
    signals.push({
      stage: "register facts",
      source: "measured",
      title: "Changes: lines that contradict a definite register fact",
      count: contradictions.length,
      addresses: contradictions.map((l) => l.offset),
      details: contradictions.map((l) => `$${hex(l.offset)}: ${l.message}`),
      proposal: "check the code: a pass error is a test case for registers.ts; an AI error needs the card to show the fact more plainly"
    });
  }

  // --- Measured: unknown register facts the AI settled in a synopsis
  const settled = analysis.routines.filter(
    (r) => result.touched.lines.has(r.routine.start) && r.registers?.unknowns.length && /^Changes:/m.test(r.synopsis ?? "")
  );
  if (settled.length) {
    const reasons = new Map<string, number[]>();
    for (const r of settled) {
      for (const u of r.registers!.unknowns) {
        const key = u.reason.replace(/\$[0-9A-F]{4}/g, (m) => (u.reason.startsWith("calls") ? m : "$xxxx"));
        reasons.set(key, [...(reasons.get(key) ?? []), r.routine.start]);
      }
    }
    signals.push({
      stage: "conventions",
      source: "measured",
      title: "unknown register facts the AI settled",
      count: settled.length,
      addresses: settled.map((r) => r.routine.start),
      details: [...reasons].sort((a, b) => b[1].length - a[1].length).map(([reason, at]) => `${at.length} x ${reason} (${at.slice(0, 4).map((o) => `$${hex(o)}`).join(", ")})`),
      proposal: "a call that recurs is a contract a convention plug-in can supply (the EXOS call is the model)"
    });
  }

  // --- Measured: data regions the AI declared that no detector proposed
  if (inputs.proposals) {
    const proposed = (start: number, end: number) => inputs.proposals!.some((p) => p.start <= start && end <= p.end);
    const missed = result.touched.regions.filter((r) => r.kind !== "code" && !proposed(r.start, r.end));
    if (missed.length) {
      signals.push({
        stage: "detectors",
        source: "measured",
        title: "data regions no detector proposed",
        count: missed.length,
        addresses: missed.map((r) => r.start),
        details: missed.map((r) => `${r.kind} $${hex(r.start)}-$${hex(r.end)}`),
        proposal: "look at what told the AI it was data; a recurring shape is a new detector (proposals.ts)"
      });
    }
  }

  // --- Measured: problems that came back round after round
  if (inputs.history.length >= 2) {
    const counts = new Map<string, number>();
    for (const round of inputs.history) for (const key of new Set(round.keys)) counts.set(key, (counts.get(key) ?? 0) + 1);
    const recurring = [...counts].filter(([, n]) => n >= 3);
    if (recurring.length) {
      signals.push({
        stage: "postprocessor",
        source: "measured",
        title: "problems that recur over compiles",
        count: recurring.length,
        addresses: [],
        details: recurring.map(([key, n]) => `${key}: in ${n} of ${inputs.history.length} compiles`),
        proposal: "a rule the AI keeps missing: say it in the helper brief, or make the postprocessor fix it itself"
      });
    }
  }
  return signals;
}

export function renderFeedback(rom: string, page: number, signals: FeedbackSignal[], rounds: number): string {
  const lines = [
    `# ${rom} page ${page}: feedback on the tools (D11)`,
    "",
    `${rounds} compile(s) so far. Review this with the project author; accepted proposals go to`,
    "`.ai/rom-annotations/pipeline-backlog.md` with the ROM and the evidence.",
    ""
  ];
  if (!signals.length) lines.push("No signals yet.");
  const stages: FeedbackStage[] = ["cards", "register facts", "detectors", "conventions", "alignment", "postprocessor"];
  for (const stage of stages) {
    const here = signals.filter((s) => s.stage === stage);
    if (!here.length) continue;
    lines.push(`## ${stage}`, "");
    for (const s of here) {
      lines.push(`### ${s.title} (${s.count}, ${s.source})`, "", `Proposal: ${s.proposal}`, "");
      for (const d of s.details.slice(0, 40)) lines.push(`- ${d}`);
      if (s.details.length > 40) lines.push(`- ... and ${s.details.length - 40} more`);
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}

/** The keys a compile's problems are counted by over rounds (rule and offset). */
export function problemKeys(lint: LintItem[], level: RomLevelReport): string[] {
  return [
    ...lint.filter((l) => l.severity === "problem").map((l) => `${l.rule} $${hex(l.offset)}`),
    ...level.unlabelledTargets.map((t) => `unlabelled $${hex(t)}`),
    ...level.labelsWithoutSynopsis.map((n) => `no-synopsis ${n}`)
  ];
}

function hex(value: number): string {
  return value.toString(16).padStart(4, "0").toUpperCase();
}
