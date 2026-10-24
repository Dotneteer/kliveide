import { describe, expect, it } from "vitest";

import { formattedMdr, runBasic, screenLines, sp48WithInterface1 } from "./if1TestSupport";

/*
 * The Interface 1 across the core's own bookkeeping (`.plans/MICRODRIVE_PLAN.md` Phase 2.7-2.8):
 * the stubbed RS232, the tact counter's rebase with a drive running (every absolute tact the device
 * keeps moves with it), and a Klive state taken mid-transfer.
 */

describe("Interface 1 stubs", () => {
  it("RS232: a byte sent completes (the far end is always ready); a byte read finds none", async () => {
    const s = await sp48WithInterface1();
    runBasic(s, `10 OPEN #4;"b": PRINT #4;"x": LET a$=INKEY$#4: CLOSE #4: PRINT LEN a$`, 150);
    expect(screenLines(s)).toEqual(["0", "0 OK, 10:5"]);
  }, 60_000);
});

describe("Interface 1 and the machine's state", () => {
  it("the tact counter's rebase mid-CAT changes nothing", async () => {
    const run = async (rebase: boolean) => {
      const s = (await sp48WithInterface1()).insertCartridge(0, formattedMdr());
      runBasic(s, `10 CAT 1`, 40);
      expect(s.interface1().select).toBe(1);
      if (rebase) {
        for (let i = 0; i < 5; i++) s.testAdvanceTacts(0x30000000).runFrames(20);
      } else {
        s.runFrames(100);
      }
      s.runFrames(700);
      return screenLines(s);
    };
    const plain = await run(false);
    expect(plain).toEqual(["TEST", "127", "0 OK, 10:1"]);
    expect(await run(true)).toEqual(plain);
  }, 120_000);

  it("a state saved mid-SAVE * restores the transfer exactly", async () => {
    const s = (await sp48WithInterface1()).insertCartridge(0, formattedMdr());
    runBasic(s, `10 SAVE *"m";1;"screen" SCREEN$`, 120);
    expect(s.interface1().select).toBe(1);
    const state = s.saveState();
    s.runFrames(600);
    const first = { screen: screenLines(s), mdr: s.cartridge(0)!, tacts: s.tacts() };
    expect(first.screen.at(-1)).toBe("0 OK, 10:1");

    s.loadState(state);
    s.runFrames(600);
    expect(screenLines(s)).toEqual(first.screen);
    expect(s.cartridge(0)).toEqual(first.mdr);
    expect(s.tacts()).toBe(first.tacts);
  }, 120_000);
});
