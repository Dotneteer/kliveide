import { describe, expect, it, vi } from "vitest";

import {
  OutputPaneBuffer,
  TRUNCATION_NOTICE
} from "@renderer/appIde/ToolArea/OutputPaneBuffer";
import { CompositeOutputBuffer } from "@renderer/appIde/ToolArea/CompositeOutputBuffer";

/**
 * The console buffer had no tests at all, which is how an unenforced line cap, a never-fired
 * composite event and a per-span notification storm all survived in it.
 *
 * Change notification is coalesced, and in the `node` project there is no `requestAnimationFrame`,
 * so the buffer falls back to a macrotask. `tick()` waits for it; `flushChanges()` forces it.
 */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const textOf = (buffer: OutputPaneBuffer) =>
  buffer.getContents().map((line) => line.spans.map((s) => s.text).join(""));

describe("OutputPaneBuffer text fidelity", () => {
  it("stores real spaces, not non-breaking spaces", () => {
    const buffer = new OutputPaneBuffer();
    buffer.writeLine("a   b");

    // --- The substitution used to reach the clipboard: `getBufferText()` reads these strings, so
    // --- "Copy to clipboard" produced U+00A0 that pasted into a shell as invisible characters.
    expect(buffer.getBufferText()).toBe("a   b\n");
    expect(buffer.getBufferText()).not.toContain("\xa0");
    expect(textOf(buffer)).toEqual(["a   b"]);
  });

  it("drops the trailing line the cursor sits on, so no phantom blank row is rendered", () => {
    const buffer = new OutputPaneBuffer();
    buffer.writeLine("one");
    buffer.writeLine("two");

    expect(textOf(buffer)).toEqual(["one", "two"]);
  });

  it("keeps an explicitly blank line", () => {
    const buffer = new OutputPaneBuffer();
    buffer.writeLine("one");
    buffer.writeLine();
    buffer.writeLine("three");

    // --- The blank line is real content and must survive; only the *trailing* empty line goes.
    expect(textOf(buffer)).toEqual(["one", "", "three"]);
  });

  it("shows a partial line before it is terminated", () => {
    const buffer = new OutputPaneBuffer();
    buffer.write("in progress");

    expect(textOf(buffer)).toEqual(["in progress"]);
  });
});

describe("OutputPaneBuffer limits", () => {
  it("enforces the line length cap and says that it did", () => {
    const buffer = new OutputPaneBuffer(100, 10);
    buffer.write("0123456789ABCDEF");

    const [line] = textOf(buffer);
    expect(line).toBe(`0123456789${TRUNCATION_NOTICE}`);
  });

  it("drops the rest of an over-long line without repeating the notice", () => {
    const buffer = new OutputPaneBuffer(100, 10);
    buffer.write("0123456789ABC");
    buffer.write("more");
    buffer.write("and more");

    expect(textOf(buffer)[0]).toBe(`0123456789${TRUNCATION_NOTICE}`);
  });

  it("starts counting afresh on the next line", () => {
    const buffer = new OutputPaneBuffer(100, 10);
    buffer.writeLine("0123456789ABC");
    buffer.write("short");

    expect(textOf(buffer)[1]).toBe("short");
  });

  it("keeps the buffered-line cap without shifting one line at a time", () => {
    const buffer = new OutputPaneBuffer(10);
    for (let i = 0; i < 1000; i++) buffer.writeLine(`line ${i}`);

    const lines = textOf(buffer);
    // --- Trimming happens in blocks, so the count sits between the cap and the cap plus slack.
    expect(lines.length).toBeGreaterThanOrEqual(10);
    expect(lines.length).toBeLessThanOrEqual(10 + 256);
    // --- Whatever the exact count, the newest line is always kept and the oldest are gone.
    expect(lines[lines.length - 1]).toBe("line 999");
    expect(lines).not.toContain("line 0");
  });
});

describe("OutputPaneBuffer change notification", () => {
  it("coalesces a burst of writes into a single notification", async () => {
    const buffer = new OutputPaneBuffer();
    const handler = vi.fn();
    buffer.contentsChanged.on(handler);

    for (let i = 0; i < 500; i++) buffer.write(`span ${i}`);

    // --- Nothing synchronous: this used to fire 500 times, each answered with an O(n) copy and a
    // --- React commit. A 64K disassembly writes ~80,000 spans.
    expect(handler).not.toHaveBeenCalled();
    await tick();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("notifies again for a later burst", async () => {
    const buffer = new OutputPaneBuffer();
    const handler = vi.fn();
    buffer.contentsChanged.on(handler);

    buffer.write("first");
    await tick();
    buffer.write("second");
    await tick();

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("advances the revision on every change, not once per notification", () => {
    const buffer = new OutputPaneBuffer();
    const before = buffer.revision;

    buffer.write("a");
    buffer.write("b");
    buffer.write("c");

    // --- Reads are never delayed by the coalescing: only the notification is batched.
    expect(buffer.revision).toBe(before + 3);
  });

  it("flushChanges fires a pending notification immediately", () => {
    const buffer = new OutputPaneBuffer();
    const handler = vi.fn();
    buffer.contentsChanged.on(handler);

    buffer.write("a");
    buffer.flushChanges();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("flushChanges does nothing when no change is pending", async () => {
    const buffer = new OutputPaneBuffer();
    const handler = vi.fn();
    buffer.contentsChanged.on(handler);

    buffer.flushChanges();
    await tick();

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("OutputPaneBuffer snapshots", () => {
  it("returns the same array instance until the contents change", () => {
    const buffer = new OutputPaneBuffer();
    buffer.writeLine("one");

    const first = buffer.getContents();
    expect(buffer.getContents()).toBe(first);

    buffer.writeLine("two");
    expect(buffer.getContents()).not.toBe(first);
  });

  it("does not mutate a snapshot already handed out", () => {
    const buffer = new OutputPaneBuffer();
    buffer.writeLine("one");
    const first = buffer.getContents();

    buffer.writeLine("two");

    // --- The consumer stopped defensively copying, so a stale snapshot must stay stale rather
    // --- than silently growing under it.
    expect(first).toHaveLength(1);
  });
});

describe("OutputPaneBuffer style interning", () => {
  it("gives spans that paint identically the same style id", () => {
    const buffer = new OutputPaneBuffer();
    buffer.color("red");
    buffer.write("a");
    buffer.write("b");

    const [spanA, spanB] = buffer.getContents()[0].spans;
    expect(spanA.styleId).toBeTypeOf("number");
    expect(spanA.styleId).toBe(spanB.styleId);
  });

  it("gives spans that paint differently different style ids", () => {
    const buffer = new OutputPaneBuffer();
    buffer.color("red");
    buffer.write("a");
    buffer.color("green");
    buffer.write("b");
    buffer.resetStyle();
    buffer.bold(true);
    buffer.write("c");

    const ids = buffer.getContents()[0].spans.map((s) => s.styleId);
    expect(new Set(ids).size).toBe(3);
  });

  it("marks an actionable span as underlined, as the renderer expects", () => {
    const buffer = new OutputPaneBuffer();
    buffer.write("main.asm", { type: "@navigate" }, true);

    const [span] = buffer.getContents()[0].spans;
    expect(span.isUnderline).toBe(true);
    expect(span.actionable).toBe(true);
  });
});

describe("CompositeOutputBuffer", () => {
  it("reports its own writes", () => {
    const composite = new CompositeOutputBuffer([new OutputPaneBuffer(), new OutputPaneBuffer()]);
    const handler = vi.fn();
    composite.contentsChanged.on(handler);

    composite.writeLine("to both");

    // --- This event was a `LiteEvent` that nothing ever fired, so a panel bound directly to a
    // --- composite never updated at all.
    expect(handler).toHaveBeenCalledTimes(1);
    expect(composite.revision).toBe(1);
  });

  it("fans writes out to every child", () => {
    const one = new OutputPaneBuffer();
    const two = new OutputPaneBuffer();
    new CompositeOutputBuffer([one, two]).writeLine("shared");

    expect(textOf(one)).toEqual(["shared"]);
    expect(textOf(two)).toEqual(["shared"]);
  });

  it("flushes its children", () => {
    const child = new OutputPaneBuffer();
    const childHandler = vi.fn();
    child.contentsChanged.on(childHandler);

    const composite = new CompositeOutputBuffer([child]);
    composite.write("x");
    composite.flushChanges();

    expect(childHandler).toHaveBeenCalledTimes(1);
  });
});

/**
 * Line severity.
 *
 * The buffer carried colour and nothing else, so a panel that wanted to mark, count or filter
 * diagnostics had only the hue to go on — and hue is chosen for contrast, shared by unrelated
 * things, and unanswerable to "which of these are errors". These pin the separate channel.
 */
describe("OutputPaneBuffer severity", () => {
  const severitiesOf = (buffer: OutputPaneBuffer) =>
    buffer.getContents().map((line) => line.severity);

  it("leaves lines unmarked by default", () => {
    const buffer = new OutputPaneBuffer();
    buffer.writeLine("Start compiling");
    buffer.writeLine("Done");
    expect(severitiesOf(buffer)).toEqual([undefined, undefined]);
  });

  it("marks the lines written while it is set", () => {
    const buffer = new OutputPaneBuffer();
    buffer.writeLine("Start compiling");
    buffer.severity("error");
    buffer.writeLine("Z0201: Cannot find include file");
    expect(severitiesOf(buffer)).toEqual([undefined, "error"]);
  });

  it("marks a whole line assembled from several spans", () => {
    // --- The real shape: a bold code, the message, then a clickable file reference. All of them
    // --- belong to one diagnostic, and the severity is a property of the line they make up.
    const buffer = new OutputPaneBuffer();
    buffer.severity("error");
    buffer.write("Z0101: ");
    buffer.write("Register A expected");
    buffer.write(" - ");
    buffer.writeLine("io.asm(24,5)", { type: "@navigate" }, true);
    expect(severitiesOf(buffer)).toEqual(["error"]);
    expect(buffer.getContents()[0].spans).toHaveLength(4);
  });

  it("applies to a line already in progress", () => {
    // --- A writer that composes the message before it knows the severity sets it late; the line it
    // --- is part-way through is still the line it means.
    const buffer = new OutputPaneBuffer();
    buffer.write("Z0201: ");
    buffer.severity("warning");
    buffer.writeLine("Unused symbol");
    expect(severitiesOf(buffer)).toEqual(["warning"]);
  });

  it("is cleared by resetStyle, like every other write-state setting", () => {
    const buffer = new OutputPaneBuffer();
    buffer.severity("error");
    buffer.writeLine("Z0201: Cannot find include file");
    buffer.resetStyle();
    buffer.writeLine("Compilation failed with 1 error.");
    expect(severitiesOf(buffer)).toEqual(["error", undefined]);
  });

  it("is saved and restored by pushStyle / popStyle", () => {
    const buffer = new OutputPaneBuffer();
    buffer.severity("error");
    buffer.pushStyle();
    buffer.severity("warning");
    buffer.writeLine("a warning");
    buffer.popStyle();
    buffer.writeLine("back to the error");
    expect(severitiesOf(buffer)).toEqual(["warning", "error"]);
  });

  it("survives the getContents snapshot being reused", () => {
    // --- `getContents()` hands out a cached array until the revision moves. Marking a line has to
    // --- move it, or the panel renders the severity it saw before the mark.
    const buffer = new OutputPaneBuffer();
    buffer.write("Z0101: Register A expected");
    expect(buffer.getContents()[0].severity).toBeUndefined();
    buffer.severity("error");
    expect(buffer.getContents()[0].severity).toBe("error");
  });

  it("is forwarded by a composite buffer to every member", () => {
    const a = new OutputPaneBuffer();
    const b = new OutputPaneBuffer();
    const composite = new CompositeOutputBuffer([a, b]);
    composite.severity("warning");
    composite.writeLine("Z0002: A line cannot start with this token");
    expect(severitiesOf(a)).toEqual(["warning"]);
    expect(severitiesOf(b)).toEqual(["warning"]);
  });

  it("clears with the buffer", () => {
    const buffer = new OutputPaneBuffer();
    buffer.severity("error");
    buffer.writeLine("Z0201: Cannot find include file");
    buffer.clear();
    buffer.resetStyle();
    buffer.writeLine("Start compiling");
    expect(severitiesOf(buffer)).toEqual([undefined]);
  });
});
