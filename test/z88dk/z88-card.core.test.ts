import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { createZ88Session } from "../harness/z88";
import { CardIds } from "@emu/machines/z88/CardIds";
import {
  Z88_APP_SLOT,
  Z88_APP_START_DELAY_FRAMES,
  z88AppStartFlow,
  z88KeyCodeOfAppKey
} from "@emu/machines/z88/z88AppFlow";
import { Z88KeyCode } from "@emu/machines/z88/Z88KeyCode";
import { mapValue, parseZ88dkMap } from "@main/z88dk-integration/z88dk-map";
import { appKeyOf } from "@main/z88dk-integration/Z88dkCompiler";

/*
 * A z88dk application card on the real Z88 (`.plans/Z88DK_INTEGRATION_PLAN.md` §7): what
 * `z88AppStartFlow` does - the card into the application slot, a soft reset (the Z88's start), then
 * □ + the application's key once OZ is ready - reaches the program's `main`. Without the reset OZ
 * does not list the hot-plugged application (checked while the flow was designed).
 */

const FIXTURE = path.join(__dirname, "fixtures", "z88-app");

describe("z88dk application cards on the Z88", () => {
  it("starts the application with □ + its key after a soft reset", async () => {
    const s = await createZ88Session({ rom: "model" });
    s.runFrames(3000);
    const main = mapValue(parseZ88dkMap(fs.readFileSync(path.join(FIXTURE, "program.map"), "utf8")), "_main")!;
    const appKey = appKeyOf(path.join(FIXTURE, "main.c"));
    expect(appKey).toBe("K");

    s.flapOpen();
    await s.plugCard(Z88_APP_SLOT as 3, { cardType: CardIds.EPROMUV32, size: 32, file: path.join(FIXTURE, "program.epr") });
    s.flapClose();
    s.reset();
    s.runFrames(Z88_APP_START_DELAY_FRAMES);
    s.breakpoint(main);
    s.keyDown("Square", appKey);
    s.runFrames(5);
    s.keyUp("Square", appKey);
    expect(s.debug("continue", { maxFrames: 3000 })).toBe(main);
  }, 120_000);

  it("builds the flow the IDE runs: start, then the chord after the delay", () => {
    expect(z88AppStartFlow("k")).toEqual([
      { type: "Start" },
      { type: "QueueKey", primary: Z88KeyCode.Square, secondary: Z88KeyCode.K, delayFrames: Z88_APP_START_DELAY_FRAMES, wait: 0 }
    ]);
    expect(z88KeyCodeOfAppKey("1")).toBeUndefined();
    expect(() => z88AppStartFlow("?")).toThrow(/letter A-Z/);
  });
});
