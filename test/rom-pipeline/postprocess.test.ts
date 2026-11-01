import { describe, expect, it } from "vitest";

import { compileAnnotations } from "@common/reverse/pipeline/postprocess/compile";
import { lint, parseRegisters } from "@common/reverse/pipeline/postprocess/lint";
import { newRomSidecar } from "@common/reverse/pipeline/postprocess/newSidecar";
import { feedbackSignals, problemKeys, renderFeedback, renderProblems } from "@common/reverse/pipeline/postprocess/report";
import { dropKeptMarks, nameNumbers, wrapSynopsis } from "@common/reverse/pipeline/postprocess/textPass";
import { imageFromRomPage } from "@common/reverse/pipeline/image/romImage";
import { analyseRomPage } from "@common/reverse/pipeline/preprocess/analyse";

/*
 * The postprocessor's P7 passes (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §5, §6, D10, D11): the text
 * pass, the lint with its D10 checks, the problem list and the feedback signals.
 */

describe("the text pass", () => {
  it("wraps long lines only, keeping a step's hanging indent", () => {
    const step = `1. ${"word ".repeat(30).trim()}`;
    const wrapped = wrapSynopsis(`Short line.\n${step}`).split("\n");
    expect(wrapped[0]).toBe("Short line.");
    expect(wrapped.every((l) => l.length <= 92)).toBe(true);
    expect(wrapped[2].startsWith("   word")).toBe(true);
    expect(wrapSynopsis("A\nB")).toBe("A\nB");
  });

  it("reflows a paragraph rather than leaving a word alone on a line (EXDOS's FAT_ENTRY_ADDR)", () => {
    const long = `${"word ".repeat(18)}is the`;
    const wrapped = wrapSynopsis(`${long}\nFAT's first sector.\nEntry: DE = the cluster.`).split("\n");
    expect(wrapped.some((l) => l.trim() === "the")).toBe(false);
    expect(wrapped.at(-1)).toBe("Entry: DE = the cluster.");
    expect(wrapped.every((l) => l.length <= 92)).toBe(true);
    // --- A stored text with a word left alone is mended too
    expect(wrapSynopsis(`${"x ".repeat(42)}is\nthe\nFAT's first.`)).not.toMatch(/\nthe\n/);
  });

  it("names labelled offsets, except kept numbers and the offset form, and drops the marks", () => {
    const labels = new Map([[0x0b40, "SEG1_SERVICE"]]);
    const named = nameNumbers("Jumps to $0B40; $0B40! stays; offset $0B40 stays; $8000 is RAM", labels);
    expect(named.text).toBe("Jumps to SEG1_SERVICE; $0B40! stays; offset $0B40 stays; $8000 is RAM");
    expect(named.swaps).toEqual(["$0B40 -> SEG1_SERVICE"]);
    expect(dropKeptMarks(named.text)).toBe("Jumps to SEG1_SERVICE; $0B40 stays; offset $0B40 stays; $8000 is RAM");
  });

  it("runs on text a file changes, never on text already in the sidecar", () => {
    const base = newRomSidecar("t.rom", [{ page: 0, bytes: new Uint8Array(0x20), origin: 0 }]);
    const long = "x ".repeat(60).trim();
    base.banks["0"].lineAnnotations = { "0": { synopsis: long } };
    base.banks["0"].localLabels = [{ name: "START", value: 0 }];
    base.provenance = { "0:0:label": "observed", "0:0:line": "observed" };
    const compile = (synopsis: string) =>
      compileAnnotations({ base, page: 0, rom: "t.rom", cpu: "z80", pageSize: 0x20, ann: [{ fileName: "a.ann", text: `rom t.rom page 0 cpu z80\n@0000\n  ${synopsis}\n` }] });
    expect(compile(long).sidecar.banks["0"].lineAnnotations["0"].synopsis).toBe(long);
    expect(compile(`${long} more`).sidecar.banks["0"].lineAnnotations["0"].synopsis).toContain("\n");
  });
});

describe("parseRegisters", () => {
  it("reads pairs, halves, primes, the alternates and none", () => {
    expect([...parseRegisters("AF, BC, AF'.")!]).toEqual(["A", "F", "B", "C", "A'", "F'"]);
    expect([...parseRegisters("A, F, C; page 1")!]).toEqual(["A", "F", "C"]);
    expect(parseRegisters("all alternates")!.size).toBe(8);
    expect(parseRegisters("none.")!.size).toBe(0);
    expect(parseRegisters("the other register set")).toBeUndefined();
  });
});

/** A page with one subroutine: PUSH BC; LD B,5; POP BC; XOR A; RET, called from $0010. */
async function pageWith(synopsis: string, comment?: string) {
  const bytes = new Uint8Array(0x40).fill(0xc9);
  bytes.set([0xc5, 0x06, 0x05, 0xc1, 0xaf, 0xc9], 0x20);
  bytes.set([0xcd, 0x20, 0x00], 0x10);
  const sidecar = newRomSidecar("t.rom", [{ page: 0, bytes, origin: 0 }]);
  const ann = [
    "rom t.rom page 0 cpu z80",
    "@0020 SAVE_AND_CLEAR",
    ...synopsis.split("\n").map((l) => `  ${l}`),
    ...(comment ? [`  .0021 ${comment}`] : []),
    "feedback pattern 0020 A test pattern"
  ].join("\n");
  const result = compileAnnotations({ base: sidecar, page: 0, rom: "t.rom", cpu: "z80", pageSize: 0x40, ann: [{ fileName: "a.ann", text: ann }] });
  const analysis = await analyseRomPage({ image: imageFromRomPage(bytes, { name: "t.rom" }), bankId: "0", sidecar: result.sidecar });
  return { result, analysis };
}

describe("lint", () => {
  it("checks the D10 lines: present, in order, and against the register facts", async () => {
    const { result, analysis } = await pageWith("Clears A.\nExit: A = 0.\nChanges: AF, BC.\nEntry: none.");
    const items = lint({ analysis, touched: result.touched });
    const problems = items.filter((i) => i.severity === "problem").map((i) => i.rule);
    expect(problems).toContain("contract-order");
    // --- BC comes back through PUSH BC / POP BC: a definite contradiction
    expect(items.find((i) => i.rule === "contract-changes")?.message).toMatch(/names B, but every return keeps it/);
  });

  it("asks rather than accuses where the facts are only 'may change'", async () => {
    // --- A in Keeps: the facts say it may change: a question, not a problem
    const kept = await pageWith("Clears A.\nEntry: none.\nExit: A = 0.\nChanges: F.\nKeeps: A, BC.");
    const keptItems = lint({ analysis: kept.analysis, touched: kept.result.touched });
    expect(keptItems.filter((i) => i.severity === "problem")).toEqual([]);
    expect(keptItems.map((i) => i.rule)).toEqual(["contract-keeps"]);
    // --- A in neither list: a question too
    const unlisted = await pageWith("Clears A.\nEntry: none.\nExit: A = 0.\nChanges: F.");
    expect(lint({ analysis: unlisted.analysis, touched: unlisted.result.touched }).map((i) => [i.severity, i.rule])).toEqual([["question", "contract-unlisted"]]);
  });

  it("checks comments, label length and clashes with other sidecars' labels", async () => {
    const { result, analysis } = await pageWith("Clears A.\nEntry: none.\nExit: A = 0.\nChanges: AF.", "Probably the counter, kept here for the loop that follows it later on.");
    const items = lint({
      analysis,
      touched: result.touched,
      otherLabels: new Map([["SAVE_AND_CLEAR", [{ sidecar: "sp48.rom.dis", offset: 0x1234 }]]])
    });
    expect(items.map((i) => i.rule)).toEqual(expect.arrayContaining(["comment-length", "comment-stop", "hedge", "label-clash"]));
  });
});

describe("the reports", () => {
  it("give every problem its fix, and the level's to-do list with callers", async () => {
    const { result, analysis } = await pageWith("Clears A.\nExit: A = 0.\nChanges: AF, BC.");
    const items = lint({ analysis, touched: result.touched });
    const level = { level: 1 as const, unlabelledTargets: [0x10], midInstructionTargets: [], labelsWithoutSynopsis: [], misplacedLabels: [], instructions: 10 };
    const text = renderProblems({ page: 0, files: ["a.ann"], result, level, lint: items, analysis }).join("\n");
    expect(text).toMatch(/\$0020 the synopsis has no Entry: line \(D10\): add "Entry: \.\.\."/);
    expect(text).toMatch(/\$0010: add a label/);
  });

  it("gather the feedback signals by stage, asked and measured", async () => {
    const { result, analysis } = await pageWith("Clears A.\nEntry: none.\nExit: A = 0.\nChanges: AF, BC.");
    const items = lint({ analysis, touched: result.touched });
    const level = { level: 2 as const, unlabelledTargets: [], midInstructionTargets: [], labelsWithoutSynopsis: [], misplacedLabels: [], instructions: 10 };
    const keys = problemKeys(items, level);
    const signals = feedbackSignals({
      result,
      lint: items,
      analysis,
      listingRequests: [{ page: 0, from: 0x20, to: 0x30, why: "the card had no RAM names" }],
      proposals: [],
      history: [
        { at: "1", keys },
        { at: "2", keys },
        { at: "3", keys }
      ]
    });
    expect(signals.map((s) => `${s.stage}: ${s.title}`)).toEqual(
      expect.arrayContaining([
        "conventions: feedback pattern",
        "cards: listing requests",
        "register facts: Changes: lines that contradict a definite register fact",
        "postprocessor: problems that recur over compiles"
      ])
    );
    expect(renderFeedback("t.rom", 0, signals, 3)).toMatch(/^## register facts$/m);
  });
});
