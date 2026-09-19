import { describe, expect, it } from "vitest";

import { createZ88Session, z88HarnessBackends } from "../harness/z88";

/*
 * The Z88 keyboard: the 8x8 matrix behind the Blink's KBD port ($B2), the key interrupt and snooze.
 *
 * Hardware (Blink documentation): reading $B2 selects the matrix rows whose address line A8-A15 is
 * low; a key pulls its column bit low. With INT.KWAIT set, a read with no key down snoozes the CPU
 * until a key is pressed (or an RTC/flap event wakes it). With INT.KEY set, a key press sets STA.KEY.
 *
 * Where the TypeScript oracle simplifies the hardware, the test says so: it pins the oracle so the
 * WASM core reproduces it (Step 0.3 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`).
 */
describe.each(z88HarnessBackends("memory", "cpu", "blink", "keyboard"))("Z88 keyboard (%s)", (backend) => {
  it.each([
    // --- A: code 43 = line 5 (A13), bit 3
    ["A", 0xdf, 0xf7],
    ["A", 0x00, 0xf7],
    ["A", 0xfe, 0xff],
    // --- Enter: code 6 = line 0 (A8), bit 6
    ["Enter", 0xfe, 0xbf],
    // --- ShiftR: code 63 = line 7 (A15), bit 7
    ["ShiftR", 0x7f, 0x7f],
    ["ShiftR", 0xbf, 0xff]
  ] as const)("KBD: key %s read with high byte $%s gives $%s", async (key, high, expected) => {
    const s = await createZ88Session({ backend });
    s.keyDown(key);
    expect(s.in((high << 8) | 0xb2)).toBe(expected);
    expect(s.snoozed).toBe(false);
  });

  it("KBD: several rows selected at once combine their columns", async () => {
    const s = await createZ88Session({ backend });
    s.keyDown("Enter", "A");
    // --- lines 0 and 5 selected
    expect(s.in(0xdeb2)).toBe(0xbf & 0xf7);
    // --- only line 5
    expect(s.in(0xdfb2)).toBe(0xf7);
    s.keyUp("A");
    expect(s.in(0xdeb2)).toBe(0xbf);
  });

  it("KBD: no key down reads $FF", async () => {
    const s = await createZ88Session({ backend });
    expect(s.in(0x00b2)).toBe(0xff);
  });

  it("with INT.KEY set, a key press sets STA.KEY; without it, it does not", async () => {
    const s = await createZ88Session({ backend });
    s.out(0xb1, 0x05); // INT = KEY | GINT
    s.keyDown("Q");
    expect(s.blinkState().STA & 0x04).toBe(0x04);

    const t = await createZ88Session({ backend });
    t.out(0xb1, 0x01); // INT = GINT
    t.keyDown("Q");
    expect(t.blinkState().STA & 0x04).toBe(0x00);
  });

  it("with INT.KWAIT set, reading $B2 with no key down snoozes the CPU; a key press wakes it", async () => {
    const s = await createZ88Session({ backend });
    s.out(0xb1, 0x81); // INT = KWAIT | GINT
    // --- The oracle answers the snoozing read with $FF at once (the hardware holds the read)
    expect(s.in(0x00b2)).toBe(0xff);
    expect(s.snoozed).toBe(true);
    s.keyDown("Space");
    expect(s.snoozed).toBe(false);
  });

  it("with INT.KWAIT set and a key down, reading $B2 does not snooze", async () => {
    const s = await createZ88Session({ backend });
    s.out(0xb1, 0x81);
    s.keyDown("Z");
    expect(s.in(0x00b2)).not.toBe(0xff);
    expect(s.snoozed).toBe(false);
  });

  it("a snoozed CPU does not execute: each step is a 16-tact pause at the same PC", async () => {
    const s = await createZ88Session({ backend });
    await s.loadCode(`
      .org $8000
      ld a,$81
      out ($b1),a         ; INT = KWAIT | GINT
      ld bc,$00b2
      in a,(c)            ; snoozes: no key down
after:
      ld ($9000),a
done:
      jr done
    `);
    s.runTo("after");
    s.step();
    expect(s.snoozed).toBe(true);
    const pc = s.registers().pc;
    expect(pc).toBe(s.symbol("after"));

    const t0 = s.tacts;
    s.step(3);
    expect(s.tacts - t0).toBe(48);
    expect(s.registers().pc).toBe(pc);

    s.runFrames(3);
    expect(s.snoozed).toBe(true);
    expect(s.registers().pc).toBe(pc);
    expect(s.peek(0x9000)).toBe(0x00);

    // --- A key wakes it; the IN already completed with $FF (oracle behaviour, see above)
    s.keyDown("Space");
    s.runTo("done");
    expect(s.snoozed).toBe(false);
    expect(s.peek(0x9000)).toBe(0xff);
  });

  it("the queued keystrokes of the IDE reach the matrix", async () => {
    const s = await createZ88Session({ backend });
    await s.loadCode(`
      .org $8000
loop: jr loop
    `);
    // --- Z88KeyCode.M = 33: line 4, bit 1; start after 1 frame, hold for 2
    s.machine.queueKeystroke(1, 2, 33);
    expect(s.blinkState().keyLines[4]).toBe(0x00);
    s.runFrames(2);
    expect(s.blinkState().keyLines[4]).toBe(0x02);
    s.runFrames(3);
    expect(s.blinkState().keyLines[4]).toBe(0x00);
    expect(s.machine.getKeyQueueLength()).toBe(0);
  });
});
