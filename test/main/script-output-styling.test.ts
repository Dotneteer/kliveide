import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MessengerBase } from "@messaging/MessengerBase";

/**
 * Script output carries styling as an options bag that `sendScriptOutput` spreads over its own
 * defaults. That bag used to be typed `Record<string, any>`, and thirteen call sites filled it with
 * a `color` field — a name nothing downstream reads, since `displayOutput` takes `foreground`. The
 * spread therefore contributed nothing and the hardcoded `foreground: "cyan"` default won every
 * time, so a failed script looked exactly like a successful one in the Script Output pane.
 *
 * The narrowed `ScriptOutputOptions` type makes a stray `color` a compile error, but the project
 * config that would report it is not the one CI runs. These assertions are the actual guard: they
 * fail at runtime if a style option ever stops reaching the pane.
 */

const displayOutput = vi.fn().mockResolvedValue(undefined);

vi.mock("@common/messaging/IdeApi", () => ({
  createIdeApi: () => ({ displayOutput })
}));

const { sendScriptOutput, concludeScript } = await import("@common/ksx/script-runner");

const send = (text: string, options?: any) =>
  sendScriptOutput({} as MessengerBase, text, options);

/** The single specification handed to `displayOutput`. */
const sent = () => {
  expect(displayOutput).toHaveBeenCalledTimes(1);
  return displayOutput.mock.calls[0][0];
};

beforeEach(() => displayOutput.mockClear());

describe("script output styling", () => {
  it("defaults to cyan when the caller asks for no colour", async () => {
    await send("Starting script myScript.ksx...");
    expect(sent()).toMatchObject({ text: "Starting script myScript.ksx...", foreground: "cyan" });
  });

  it("lets a caller override the default colour", async () => {
    await send("Script started", { foreground: "green" });
    expect(sent().foreground).toBe("green");
  });

  it.each(["green", "red", "yellow", "bright-red"] as const)(
    "forwards %s to the output pane",
    async (foreground) => {
      await send("message", { foreground });
      expect(sent().foreground).toBe(foreground);
    }
  );

  it("writes to the scripting pane, one line per message", async () => {
    await send("Script started", { foreground: "green" });
    expect(sent()).toMatchObject({ pane: "scripting", writeLine: true });
  });

  it("ignores an unknown style key rather than letting it mask the default", async () => {
    // --- The exact shape of the original bug: `color` is not a field `displayOutput` reads, so a
    // --- caller passing it must not end up with a silently different colour than they asked for.
    await send("Script started", { color: "green" });
    expect(sent().foreground).toBe("cyan");
    expect(sent()).not.toHaveProperty("foreground", "green");
  });
});

/**
 * `sendScriptOutput` was never the broken half — the call sites were, and a test of the transport
 * alone would have stayed green throughout the bug. These drive `concludeScript`, the shared
 * conclusion path behind both the main-process and emulator runners, and assert on the options it
 * actually emits.
 */
describe("concludeScript styling", () => {
  const outputFn = vi.fn().mockResolvedValue(undefined);

  const run = async (execTask: Promise<void>, cancelled = false) => {
    outputFn.mockClear();
    const script = {
      id: 7,
      scriptFileName: "myScript.ksx",
      status: "running",
      runsInEmu: false,
      startTime: new Date()
    };
    concludeScript(
      { dispatch: vi.fn(), getState: vi.fn() } as any,
      execTask,
      { cancellationToken: { cancelled } } as any,
      () => [],
      script as any,
      outputFn,
      vi.fn()
    );
    // --- `concludeScript` deliberately does not await its own async body.
    await new Promise((r) => setTimeout(r, 0));
    return outputFn.mock.calls;
  };

  it("reports a completed script in green", async () => {
    const calls = await run(Promise.resolve());
    expect(calls[0][0]).toContain("completed");
    expect(calls[0][1]).toEqual({ foreground: "green" });
  });

  it("reports a cancelled script in yellow", async () => {
    const calls = await run(Promise.resolve(), true);
    expect(calls[0][1]).toEqual({ foreground: "yellow" });
  });

  it("reports a failed script in red, and its error in bright red", async () => {
    // --- `concludeScript` rethrows from inside an async IIFE that nothing awaits, so a failing
    // --- script always surfaces as an unhandled rejection — in production as much as here. The
    // --- listener keeps that pre-existing behaviour from failing this run; it is not the subject
    // --- of the test, which is the two colours below.
    const swallow = () => {};
    process.on("unhandledRejection", swallow);
    try {
      const calls = await run(Promise.reject(new Error("boom")));
      expect(calls[0][0]).toContain("failed");
      expect(calls[0][1]).toEqual({ foreground: "red" });
      expect(calls[1][1]).toEqual({ foreground: "bright-red" });
    } finally {
      process.off("unhandledRejection", swallow);
    }
  });
});
