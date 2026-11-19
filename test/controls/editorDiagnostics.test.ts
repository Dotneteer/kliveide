import { describe, expect, it } from "vitest";
import {
  backgroundBuildMessages,
  closestSymbol,
  countProblems,
  fileErrorCount,
  groupLineHints,
  hintParts,
  setUndefinedSymbolRanges,
  undefinedSymbolsOnLine
} from "@renderer/features/editor/monaco/editorDiagnostics";

describe("editor diagnostics: line hints", () => {
  it("groups by line, errors first, each message once", () => {
    const hints = groupLineHints([
      { lineNo: 13, message: "w", isWarning: true },
      { lineNo: 11, message: "a", code: "Z0605", isWarning: false },
      { lineNo: 13, message: "e1", code: "Z0402", isWarning: false },
      { lineNo: 13, message: "e1", code: "Z0402", isWarning: false },
      { lineNo: 13, message: "e2", code: "Z0605", isWarning: false }
    ]);
    expect(hints.map((h) => h.lineNo)).toEqual([11, 13]);
    expect(hints[1].messages.map((m) => m.message)).toEqual(["e1", "e2", "w"]);
    expect(hints[1].isWarning).toBe(false);
  });

  it("a line with only warnings is a warning line", () => {
    const [hint] = groupLineHints([{ lineNo: 3, message: "w", isWarning: true }]);
    expect(hint.isWarning).toBe(true);
  });

  it("shows the first message, then its code and how many more", () => {
    const [hint] = groupLineHints([
      { lineNo: 1, message: "first", code: "Z0402", isWarning: false },
      { lineNo: 1, message: "second", code: "Z0605", isWarning: false },
      { lineNo: 1, message: "third", isWarning: true }
    ]);
    expect(hintParts(hint)).toEqual({ message: "first", detail: "Z0402  +2" });
  });

  it("has no detail for a single message without a code", () => {
    const [hint] = groupLineHints([{ lineNo: 1, message: "only", isWarning: false }]);
    expect(hintParts(hint)).toEqual({ message: "only", detail: "" });
  });
});

describe("editor diagnostics: counts", () => {
  it("counts errors and warnings", () => {
    expect(countProblems([{}, { isWarning: true }, { isWarning: false }])).toEqual({ errors: 2, warnings: 1 });
  });

  it("counts a file's errors by its project path, not its warnings", () => {
    const errors = [
      { filename: "/p/code/main.kz80.asm", isWarning: false },
      { filename: "/p/code/main.kz80.asm", isWarning: true },
      { filename: "/p/code/other.kz80.asm" }
    ];
    expect(fileErrorCount(errors, "code/main.kz80.asm")).toBe(1);
    expect(fileErrorCount(errors, undefined)).toBe(0);
    expect(fileErrorCount(undefined, "code/main.kz80.asm")).toBe(0);
  });
});

describe("editor diagnostics: background build messages", () => {
  const errors = [{ filename: "/p/a.kz80.asm" }];
  const compilation = { backgroundResult: { errors } };

  it("gives the messages while background compilation is on", () => {
    expect(
      backgroundBuildMessages({ globalSettings: { editorOptions: { allowBackgroundCompile: true } }, compilation })
    ).toBe(errors);
  });

  it("gives none while it is off", () => {
    expect(
      backgroundBuildMessages({ globalSettings: { editorOptions: { allowBackgroundCompile: false } }, compilation })
    ).toBeUndefined();
  });
});

describe("editor diagnostics: did you mean", () => {
  it("suggests the closest known symbol, case-insensitively", () => {
    expect(closestSymbol("Lop", ["Start", "Loop", "Colour"])).toBe("Loop");
    expect(closestSymbol("colur", ["Start", "Loop", "Colour"])).toBe("Colour");
  });

  it("counts two swapped letters as one edit", () => {
    expect(closestSymbol("Dleay", ["Delay", "Loop"])).toBe("Delay");
  });

  it("suggests nothing for an unrelated or exact name", () => {
    expect(closestSymbol("Far", ["Start", "Loop", "Colour"])).toBeUndefined();
    expect(closestSymbol("loop", ["Loop", "Lop"])).toBeUndefined();
    expect(closestSymbol("", ["Loop"])).toBeUndefined();
  });

  it("allows more edits for longer names", () => {
    expect(closestSymbol("ScreenBufer", ["ScreenBuffer"])).toBe("ScreenBuffer");
    expect(closestSymbol("Ab", ["Xy"])).toBeUndefined();
  });

  it("keeps the undefined symbols per model and line", () => {
    const model = {};
    setUndefinedSymbolRanges(model, [
      { lineNo: 11, startColumn: 14, endColumn: 17 },
      { lineNo: 13, startColumn: 17, endColumn: 20 }
    ]);
    expect(undefinedSymbolsOnLine(model, 13)).toEqual([{ lineNo: 13, startColumn: 17, endColumn: 20 }]);
    expect(undefinedSymbolsOnLine({}, 13)).toEqual([]);
  });
});
