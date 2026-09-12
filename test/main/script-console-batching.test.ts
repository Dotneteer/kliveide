import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MessengerBase } from "@messaging/MessengerBase";

/**
 * Script output crosses IPC one operation at a time, and its style is *stateful* — a `color`
 * applies to the `write`s that follow it. So a single coloured line was `pushStyle`, `resetStyle`,
 * `color`, `write`, `write`, `writeLine`, `popStyle`: seven serial awaited round trips, each with
 * its own correlation entry and timeout, for one line of text.
 *
 * These assert the collapse to one message, and that the collapse did not reorder anything — which
 * would be worse than the cost it removes, since a `color` arriving after its `write` paints the
 * wrong text.
 */

const scriptOutput = vi.fn().mockResolvedValue(undefined);
const scriptOutputBatch = vi.fn().mockResolvedValue(undefined);

vi.mock("@common/messaging/IdeApi", () => ({
  createIdeApi: () => ({ scriptOutput, scriptOutputBatch })
}));

const { createScriptConsole } = await import("@main/ksx-runner/ScriptConsole");

const consoleFor = (id = 1) => createScriptConsole({} as MessengerBase, id);

/** The operation names of the single batch that was sent. */
const sentOperations = () => {
  expect(scriptOutputBatch).toHaveBeenCalledTimes(1);
  return scriptOutputBatch.mock.calls[0][1].map((o: any) => o.operation);
};

beforeEach(() => {
  scriptOutput.mockClear();
  scriptOutputBatch.mockClear();
});

describe("ScriptConsole batching", () => {
  it("sends a coloured line as one message instead of seven", async () => {
    await consoleFor().error("boom");

    expect(sentOperations()).toEqual([
      "pushStyle",
      "resetStyle",
      "color",
      "write",
      "write",
      "writeLine",
      "popStyle"
    ]);
  });

  it("keeps the operations in order, so style still precedes the text it colours", async () => {
    await consoleFor().error("boom");

    const ops = scriptOutputBatch.mock.calls[0][1];
    expect(ops[2]).toEqual({ operation: "color", args: ["red"] });
    expect(ops[3]).toEqual({ operation: "write", args: ["Error: "] });
    expect(ops[4]).toEqual({ operation: "write", args: ["boom"] });
  });

  it("uses each level's own colour", async () => {
    await consoleFor().warn("careful");
    expect(scriptOutputBatch.mock.calls[0][1][2]).toEqual({
      operation: "color",
      args: ["yellow"]
    });

    scriptOutputBatch.mockClear();
    await consoleFor().success("done");
    expect(scriptOutputBatch.mock.calls[0][1][2]).toEqual({
      operation: "color",
      args: ["green"]
    });
  });

  it("separates logged arguments with a space, in one batch", async () => {
    await consoleFor().log("a", "b");

    const ops = scriptOutputBatch.mock.calls[0][1];
    expect(ops.map((o: any) => o.operation)).toEqual(["write", "write", "write", "writeLine"]);
    expect(ops[1]).toEqual({ operation: "write", args: [" "] });
  });

  it("targets the script the console was created for", async () => {
    await consoleFor(42).log("x");

    expect(scriptOutputBatch.mock.calls[0][0]).toBe(42);
  });

  it("starts a new batch for a later line", async () => {
    const console = consoleFor();
    await console.log("first");
    await console.log("second");

    expect(scriptOutputBatch).toHaveBeenCalledTimes(2);
  });

  it("batches standalone calls made in the same turn", async () => {
    const console = consoleFor();

    // --- Not awaited individually: the point is that a caller driving the console directly gets
    // --- the same collapse as the composite helpers do.
    console.color("cyan");
    console.write("hello");
    await console.writeLine();

    expect(sentOperations()).toEqual(["color", "write", "writeLine"]);
  });

  it("falls back to a single send for another script's buffer", async () => {
    // --- A batch is addressed to one script id, so an operation aimed elsewhere cannot join it.
    await consoleFor(1).sendScriptOutput(2, "write", ["elsewhere"]);

    expect(scriptOutputBatch).not.toHaveBeenCalled();
    expect(scriptOutput).toHaveBeenCalledWith(2, "write", ["elsewhere"]);
  });

  it("resolves the awaited call only once its batch has been delivered", async () => {
    let deliver: () => void;
    scriptOutputBatch.mockImplementationOnce(
      () => new Promise<void>((resolve) => (deliver = resolve))
    );

    let done = false;
    const pending = consoleFor()
      .log("x")
      .then(() => {
        done = true;
      });

    await Promise.resolve();
    expect(done).toBe(false);

    deliver!();
    await pending;
    expect(done).toBe(true);
  });
});
