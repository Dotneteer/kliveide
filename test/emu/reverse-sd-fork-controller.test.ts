import { describe, expect, it } from "vitest";

import type { RequestMessage } from "@messaging/messages-core";
import createAppStore from "@state/store";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { comparePositions } from "@emu/machines/reverse/timelinePosition";
import { createSession, MemorySdCard, SD_SECTOR_BYTES } from "../harness/zxnext";
import { InMemorySdMessenger } from "../harness/zxnext/script/sd-card";

/*
 * The Next's SD card in a reverse-debugging timeline (`.plans/REVERSE_DEBUGGING_PLAN.md` D14, T3,
 * Phase 6), on the real Next through the machine controller. A program reads one sector and writes
 * another on every pass, through the SPI ports, so the card's host image changes all the time:
 *
 * - stops right after the instruction that hands the core's SD command to the host leave it pending,
 *   and resuming answers it before anything runs (T3), so the replays below - fast frames - meet
 *   every answer where it was journaled;
 * - a replay run through the past never asks the host: reads come from the journal (with the bytes
 *   the card held *then*, though the host image has moved on), writes are not repeated;
 * - Take over here writes the discarded future's sectors back: the host image is, byte for byte,
 *   what it was at the fork point; the run then goes on live from there.
 */

/** The card the program uses: sectors 0-7 hold the writes, the rest stay as they were */
const SECTORS = 64;
const INITIAL = 0xee;

/**
 * Pass k (the counter at $9000, 1, 2, ...): reads sector (k+1) & 7 into $A000 - the one pass k+1
 * overwrites - then fills sector k & 7 with k
 */
const PROGRAM = `
      .org $8000
Main:
      ld bc,$00e7
      ld a,$02
      out (c),a           ; card 0 selected
      ld c,$eb            ; BC = $00EB: the SPI data port from here on
Loop:
      ld hl,$9000
      inc (hl)
      ld a,(hl)
      inc a
      and 7
      ld e,a
      ld a,$51            ; CMD17: read a block
      call Command
WaitToken:
      in a,(c)
      cp $fe
      jr nz,WaitToken
      ld hl,$a000
      ld de,512
ReadData:
      in a,(c)
      ld (hl),a
      inc hl
      dec de
      ld a,d
      or e
      jr nz,ReadData
      in a,(c)            ; the CRC
      in a,(c)
      ld a,($9000)
      and 7
      ld e,a
      ld a,$58            ; CMD24: write a block
      call Command
      in a,(c)            ; R1
      ld a,$fe
      out (c),a           ; the data token
      ld a,($9000)
      ld d,a
      ld hl,512
WriteData:
      out (c),d
      dec hl
      ld a,h
      or l
      jr nz,WriteData
      out (c),d           ; the CRC: the second byte hands the write to the host
      out (c),d
WriteHandedOff:
WaitAck:
      in a,(c)
      cp $05
      jr nz,WaitAck
      jr Loop

; --- Sends command A with sector E: the sixth byte hands a read to the host
Command:
      out (c),a
      xor a
      out (c),a
      out (c),a
      out (c),a
      out (c),e
      ld a,$ff
      out (c),a
CmdEnd:
      ret
`;

/** The SD card, and an answer for every other call the controller makes (output, state) */
class SdTestMessenger extends InMemorySdMessenger {
  override async sendMessage(message: RequestMessage): Promise<any> {
    const method = (message as unknown as { method?: string }).method;
    if (message.type === "ApiMethodRequest" && method && ["getSdCardInfo", "readSdCardSector", "writeSdCardSector"].includes(method)) {
      return super.sendMessage(message);
    }
    return { type: "ApiMethodResponse", result: undefined };
  }
}

/** The host image after pass k: sector s holds the last pass j <= k with j & 7 == s */
function expectedImage(k: number): Uint8Array {
  const image = new Uint8Array(SECTORS * SD_SECTOR_BYTES).fill(INITIAL);
  for (let s = 0; s < 8; s++) {
    let last = 0;
    for (let j = 1; j <= k; j++) if ((j & 7) === s) last = j;
    if (last) image.fill(last & 0xff, s * SD_SECTOR_BYTES, (s + 1) * SD_SECTOR_BYTES);
  }
  return image;
}

/** What pass k read: sector (k+1) & 7 as pass k-7 left it (or as it started) */
function expectedRead(k: number): number {
  return k >= 8 ? (k - 7) & 0xff : INITIAL;
}

function firstDifference(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return i;
  return -1;
}

async function waitFor(done: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 400_000; i++) {
    if (done()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

describe("Reverse debugging and the Next's SD card (Phase 6)", () => {
  it("replays SD traffic from the journal and restores the host image on a fork", async () => {
    const s = await createSession();
    const program = await s.loadCode(PROGRAM);
    s.poke(0x9000, 0);
    const card = new MemorySdCard(new Uint8Array(SECTORS * SD_SECTOR_BYTES).fill(INITIAL));
    const messenger = new SdTestMessenger(card);
    const controller = new MachineController(createAppStore("test-reverse-sd"), messenger, s.machine as any);
    const debugSupport = s.attachDebugSupport();
    controller.debugSupport = debugSupport;
    controller.state = MachineControllerState.Paused;
    const paused = () => controller.state === MachineControllerState.Paused;
    const pass = () => s.peek(0x9000);
    const readBuffer = () => Array.from(s.peekBytes(0xa000, SD_SECTOR_BYTES));
    const debugRun = async () => {
      await controller.startDebug();
      await waitFor(paused, "a stop");
    };
    /** Continues to the loop's nth hit from now */
    const runLoops = async (n: number) => {
      const bp = { address: program.symbol("Loop"), exec: true, hitCount: n };
      debugSupport.resetHitCounts();
      debugSupport.addBreakpoint(bp);
      await debugRun();
      debugSupport.removeBreakpoint(bp);
    };

    // --- Stops right after the instruction that hands a command to the host: it stays pending, and
    // --- the next run answers it before running anything (T3)
    const cmdEnd = { address: program.symbol("CmdEnd"), exec: true };
    const writeHandedOff = { address: program.symbol("WriteHandedOff"), exec: true };
    debugSupport.addBreakpoint(cmdEnd);
    debugSupport.addBreakpoint(writeHandedOff);
    const pending: string[] = [];
    for (let i = 0; i < 9; i++) {
      await debugRun();
      expect([program.symbol("CmdEnd"), program.symbol("WriteHandedOff")]).toContain(s.machine.pc);
      const command = s.machine.getFrameCommand()?.command;
      if (command) pending.push(command);
    }
    // --- Three passes: each a read and a write left pending (the CMD24 stop at CmdEnd has none yet)
    expect(pending).toEqual(["sd-read", "sd-write", "sd-read", "sd-write", "sd-read", "sd-write"]);
    debugSupport.removeBreakpoint(writeHandedOff);
    debugSupport.removeBreakpoint(cmdEnd);
    const timeline = controller.timeline!;
    expect(timeline).toBeDefined();

    // --- Forward: passes with keyframes on the way
    await runLoops(5);
    const forkPass = pass();
    const forkPoint = timeline.position;
    expect(Array.from(card.image)).toEqual(Array.from(expectedImage(forkPass)));
    await runLoops(150);
    const presentPass = pass();
    const present = timeline.position;
    expect(card.image).toEqual(expectedImage(presentPass));
    expect(timeline.store.keyframes.filter((k) => comparePositions(k.seed.position, forkPoint) > 0).length).toBeGreaterThanOrEqual(2);
    expect(timeline.sdUndo.length).toBe(presentPass);
    const imageAtPresent = card.image.slice();

    // --- Into the past and a replay run toward the present: the host is never asked
    const callsBefore = { ...messenger.calls };
    timeline.replayTo(forkPoint);
    expect(pass()).toBe(forkPass);
    expect(readBuffer().every((b) => b === expectedRead(forkPass))).toBe(true);
    await runLoops(40);
    expect(timeline.mode).toBe("navigating");
    const takeOverPass = pass();
    expect(takeOverPass).toBe(forkPass + 40);
    // --- What the pass read is the sector as it was then - the host holds later writes by now
    expect(readBuffer().every((b) => b === expectedRead(takeOverPass))).toBe(true);
    expect(messenger.calls).toEqual(callsBefore);
    expect(card.image).toEqual(imageAtPresent);
    expect(controller.forkPreview()).toEqual({ sdWrites: presentPass - takeOverPass, hostFiles: [] });

    // --- Take over here: the future's writes are undone, newest first
    expect(await controller.takeOverHere()).toBe(true);
    expect(timeline.mode).toBe("live");
    const forked = card.image;
    expect(firstDifference(forked, expectedImage(takeOverPass))).toBe(-1);
    expect(messenger.calls.writeSdCardSector - (callsBefore.writeSdCardSector ?? 0)).toBe(presentPass - takeOverPass);
    expect(timeline.sdUndo.length).toBe(takeOverPass);

    // --- Live from the fork point: the run goes on as if the old future had never happened
    await runLoops(12);
    expect(pass()).toBe(takeOverPass + 12);
    expect(card.image).toEqual(expectedImage(takeOverPass + 12));
    expect(readBuffer().every((b) => b === expectedRead(takeOverPass + 12))).toBe(true);

    // --- ...and the new future replays too: back over the fork point, then a fork further back
    timeline.replayTo(forkPoint);
    expect(pass()).toBe(forkPass);
    expect(await controller.takeOverHere()).toBe(true);
    expect(card.image).toEqual(expectedImage(forkPass));
    expect(comparePositions(timeline.position, present)).toBeLessThan(0);

    // --- In the past without a cursor (no ring holds the point), an edit or new media still returns
    // --- to the present first: in the past the muted journal would drop them (D12)
    await runLoops(30);
    const latest = pass();
    const imageNow = card.image.slice();
    timeline.replayTo(forkPoint);
    expect(controller.historyCursor.sequence).toBeUndefined();
    controller.clearHistoryCursor();
    expect(timeline.mode).toBe("live");
    expect(pass()).toBe(latest);
    expect(card.image).toEqual(imageNow);
    await controller.stop();
  }, 600_000);
});
