import { describe, expect, it } from "vitest";

import type { NavigationEntry, NavigationReason } from "@renderer/abstractions/NavigationLocation";
import { NavigationHistory } from "@renderer/appIde/navigation/NavigationHistory";

/** A text location; `doc:line` reads well in expectations. */
function at(doc: string, line: number, reason: NavigationReason = "definition"): NavigationEntry {
  return {
    documentId: doc,
    documentType: "CodeEditor",
    title: doc,
    locator: { kind: "text", line, column: 1 },
    reason,
    time: 0
  };
}

/** Same-document lines within 10 of each other are one place, as the text adapter says. */
function history(limit?: number): NavigationHistory {
  return new NavigationHistory((a, b) => {
    if (a.locator.kind !== "text" || b.locator.kind !== "text") return false;
    return Math.abs(a.locator.line - b.locator.line) <= 10;
  }, limit);
}

function shape(h: NavigationHistory): string[] {
  return h.entries.map((e, i) => {
    const line = e.locator.kind === "text" ? e.locator.line : "?";
    return `${i === h.index ? ">" : ""}${e.documentId}:${line}`;
  });
}

describe("NavigationHistory.record", () => {
  it("records both ends of the first jump", () => {
    const h = history();
    h.record(at("main", 5), at("utils", 28));
    expect(shape(h)).toEqual(["main:5", ">utils:28"]);
  });

  it("does not add an entry for a jump to where the user already is", () => {
    const h = history();
    h.record(at("main", 5), at("utils", 28));
    h.record(at("utils", 28), at("utils", 31));
    expect(shape(h)).toEqual(["main:5", ">utils:31"]);
  });

  it("replaces the current entry with where the user left it, in the same document", () => {
    // --- Arrived at utils:28, scrolled down to utils:80, then jumped: Back must return to 80.
    const h = history();
    h.record(at("main", 5), at("utils", 28));
    h.record(at("utils", 80), at("input", 6));
    expect(shape(h)).toEqual(["main:5", "utils:80", ">input:6"]);
  });

  it("keeps the current entry's reason when replacing it with the location left", () => {
    const h = history();
    h.record(at("main", 5), at("utils", 28, "outputLink"));
    h.record(at("utils", 80, "definition"), at("input", 6, "definition"));
    expect(h.entries[1].reason).toBe("outputLink");
  });

  it("pushes the location left when it is in a document the history never saw arrive", () => {
    // --- The debugger paused in `lib` (not recorded), then Go to Definition from there.
    const h = history();
    h.record(at("main", 5), at("utils", 28));
    h.record(at("lib", 40), at("utils", 51));
    expect(shape(h)).toEqual(["main:5", "utils:28", "lib:40", ">utils:51"]);
  });

  it("records only the location left when the target does not take part", () => {
    const h = history();
    h.record(at("main", 5), undefined);
    expect(shape(h)).toEqual([">main:5"]);
  });

  it("records only the location arrived at when the origin does not take part", () => {
    const h = history();
    h.record(undefined, at("main", 5));
    expect(shape(h)).toEqual([">main:5"]);
  });

  it("forks: a new jump drops the entries ahead of the current one", () => {
    const h = history();
    h.record(at("main", 5), at("utils", 28));
    h.record(at("utils", 28), at("input", 6));
    h.moveTo(0);
    h.record(at("main", 5), at("lib", 1));
    expect(shape(h)).toEqual(["main:5", ">lib:1"]);
  });

  it("drops the oldest entries beyond the limit", () => {
    const h = history(3);
    h.record(at("a", 1), at("b", 1));
    h.record(at("b", 1), at("c", 1));
    h.record(at("c", 1), at("d", 1));
    expect(shape(h)).toEqual(["b:1", "c:1", ">d:1"]);
  });
});

describe("NavigationHistory back and forward", () => {
  function threeStops(): NavigationHistory {
    const h = history();
    h.record(at("main", 5), at("utils", 28));
    h.record(at("utils", 28), at("input", 6));
    return h;
  }

  it("goes back one entry from where the user is", () => {
    const h = threeStops();
    const target = h.prepareBack(at("input", 6));
    expect(target).toBe(1);
    h.moveTo(target);
    expect(shape(h)).toEqual(["main:5", ">utils:28", "input:6"]);
    expect(h.canGoForward()).toBe(true);
  });

  it("remembers where the user moved to before going back, for Forward", () => {
    const h = threeStops();
    const target = h.prepareBack(at("input", 30));
    h.moveTo(target);
    expect(shape(h)).toEqual(["main:5", ">utils:28", "input:30"]);
  });

  it("returns to the current entry first when the user is in another document", () => {
    // --- A debugger pause moved the view to `lib`, which the history did not record.
    const h = threeStops();
    expect(h.canGoBack(at("lib", 40))).toBe(true);
    expect(h.prepareBack(at("lib", 40))).toBe(2);
  });

  it("returns to the current entry first when the active document does not take part", () => {
    const h = threeStops();
    expect(h.prepareBack(undefined)).toBe(2);
  });

  it("has nowhere to go back to from the only entry, unless the user left it", () => {
    const h = history();
    h.record(undefined, at("main", 5));
    expect(h.canGoBack(at("main", 5))).toBe(false);
    expect(h.prepareBack(at("main", 5))).toBe(-1);
    expect(h.canGoBack(at("utils", 1))).toBe(true);
  });

  it("goes forward one entry, and has nowhere to go at the newest", () => {
    const h = threeStops();
    h.moveTo(h.prepareBack(at("input", 6)));
    const target = h.prepareForward(at("utils", 28));
    expect(target).toBe(2);
    h.moveTo(target);
    expect(h.canGoForward()).toBe(false);
    expect(h.prepareForward(at("input", 6))).toBe(-1);
  });

  it("reports nothing to do on an empty history", () => {
    const h = history();
    expect(h.canGoBack(undefined)).toBe(false);
    expect(h.canGoForward()).toBe(false);
    expect(h.prepareBack(at("main", 1))).toBe(-1);
    expect(h.prepareForward(at("main", 1))).toBe(-1);
  });
});

describe("NavigationHistory maintenance", () => {
  it("removes an entry and keeps the cursor on the same place", () => {
    const h = history();
    h.record(at("main", 5), at("utils", 28));
    h.record(at("utils", 28), at("input", 6));
    h.removeAt(0);
    expect(shape(h)).toEqual(["utils:28", ">input:6"]);
  });

  it("removes a deleted file's entries and merges the neighbours that become duplicates", () => {
    const h = history();
    h.record(at("main", 5), at("utils", 28));
    h.record(at("utils", 28), at("main", 7));
    h.removeWhere((e) => e.documentId === "utils");
    expect(shape(h)).toEqual([">main:5"]);
  });

  it("re-points a renamed file and documents under a renamed folder", () => {
    const h = history();
    h.record(at("/p/main.asm", 5), at("/p/lib/utils.asm", 28));
    h.rekey("/p/main.asm", "/p/start.asm", () => "start.asm");
    h.rekey("/p/lib", "/p/common");
    expect(h.entries.map((e) => e.documentId)).toEqual(["/p/start.asm", "/p/common/utils.asm"]);
    expect(h.entries[0].title).toBe("start.asm");
  });

  it("does not re-point a document whose path only starts with the renamed name", () => {
    const h = history();
    h.record(undefined, at("/p/lib2/a.asm", 1));
    h.rekey("/p/lib", "/p/common");
    expect(h.entries[0].documentId).toBe("/p/lib2/a.asm");
  });

  it("clears", () => {
    const h = history();
    h.record(at("main", 5), at("utils", 28));
    h.clear();
    expect(h.entries).toEqual([]);
    expect(h.index).toBe(-1);
  });
});
