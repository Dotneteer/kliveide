import { describe, expect, it } from "vitest";
import { getDocumentTabLabels } from "@renderer/features/documents/DocumentTabs";
import type { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";

/**
 * What a tab is allowed to call a document.
 *
 * The regression these pin down: two open files named `klive.project` used to render as the full
 * absolute path of each, which `.titleText` then clipped from the *left* — so the tab read
 * `…iments/testprojects/next/klive.project` and the segment that actually told them apart was the
 * part that got cut. The rule is now "shortest run of parent folders that disambiguates".
 */

function doc(id: string, name: string, path?: string): ProjectDocumentState {
  return { id, name, path } as ProjectDocumentState;
}

describe("getDocumentTabLabels", () => {
  it("leaves an unambiguous name alone", () => {
    const labels = getDocumentTabLabels([
      doc("a", "io.asm", "/p/book/io.asm"),
      doc("b", "main.kz80.asm", "/p/book/main.kz80.asm")
    ]);

    expect(labels.get("a")).toBe("io.asm");
    expect(labels.get("b")).toBe("main.kz80.asm");
  });

  it("qualifies a shared name with one parent folder, not the absolute path", () => {
    const labels = getDocumentTabLabels([
      doc("root", "klive.project", "/Users/d/next/klive.project"),
      doc("nested", "klive.project", "/Users/d/next/screen-tests/klive.project")
    ]);

    expect(labels.get("root")).toBe("next/klive.project");
    expect(labels.get("nested")).toBe("screen-tests/klive.project");
  });

  it("goes deeper when the parent folder name is shared too", () => {
    const labels = getDocumentTabLabels([
      doc("a", "io.asm", "/p/src/utils/io.asm"),
      doc("b", "io.asm", "/p/test/utils/io.asm")
    ]);

    expect(labels.get("a")).toBe("src/utils/io.asm");
    expect(labels.get("b")).toBe("test/utils/io.asm");
  });

  it("qualifies only the group that is ambiguous", () => {
    const labels = getDocumentTabLabels([
      doc("a", "io.asm", "/p/one/io.asm"),
      doc("b", "io.asm", "/p/two/io.asm"),
      doc("c", "nr.asm", "/p/one/nr.asm")
    ]);

    expect(labels.get("a")).toBe("one/io.asm");
    expect(labels.get("b")).toBe("two/io.asm");
    expect(labels.get("c")).toBe("nr.asm");
  });

  it("stops as soon as the group is distinct rather than walking to the root", () => {
    const labels = getDocumentTabLabels([
      doc("a", "build.ksx", "/very/long/prefix/alpha/build.ksx"),
      doc("b", "build.ksx", "/very/long/prefix/beta/build.ksx")
    ]);

    expect(labels.get("a")).toBe("alpha/build.ksx");
    expect(labels.get("b")).toBe("beta/build.ksx");
  });

  it("qualifies Windows paths the same way", () => {
    const labels = getDocumentTabLabels([
      doc("a", "klive.project", "C:\\Projects\\next\\klive.project"),
      doc("b", "klive.project", "C:\\Projects\\next\\screen-tests\\klive.project")
    ]);

    expect(labels.get("a")).toBe("next/klive.project");
    expect(labels.get("b")).toBe("screen-tests/klive.project");
  });

  it("falls back to the bare name when a document in the group has no path", () => {
    // --- Virtual documents (the machine views, the memory dump) have no file behind them, so there
    // --- is nothing to qualify them with. Better an ambiguous name than a half-qualified group.
    const labels = getDocumentTabLabels([
      doc("virtual", "Memory"),
      doc("file", "Memory", "/p/Memory")
    ]);

    expect(labels.get("virtual")).toBe("Memory");
    expect(labels.get("file")).toBe("Memory");
  });

  it("handles a single open document", () => {
    const labels = getDocumentTabLabels([doc("a", "io.asm", "/p/io.asm")]);
    expect(labels.get("a")).toBe("io.asm");
  });

  it("returns an empty map for no documents", () => {
    expect(getDocumentTabLabels([]).size).toBe(0);
  });
});
