import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";
import { latencies } from "@renderer/features/interrupts/timelineModel";
import {
  eventCpuSpeed,
  NEXT_INT_SRC_NMI_MULTIFACE,
  NextIntEventFlag,
  NextIntEventKind,
  NextIntSource
} from "@common/zxnext/interrupts/interruptState";

/*
 * The interrupt debugging views' data (`dev/plans/NEXT_INTERRUPTS_DEBUGGING_PLAN.md`): the Interrupts
 * panel's snapshot (§3.2), the event ring (§4.1) and the interrupt-stop watch (§5), on the real core.
 *
 * Hardware (`dev/vendor/next-fpga/3.02.01/src`), the facts the views report:
 * - zxnext.vhd ~1884-1955, device/im2_device.vhd: a device moves S_0 -> S_REQ -> S_ACK -> S_ISR and back
 *   to S_0 only on a RETI (ED 4D) with the CPU in IM 2; RETN (ED 45) releases nothing. A device out of
 *   S_0 holds every device below it. Vector = $C0 bits 7-5 & index & '0' (ULA index 11 -> $B6 with $A0).
 * - ~1968-1995: in pulse mode a request starts a 32/36-cycle /INT pulse; a CPU with interrupts disabled
 *   for the whole pulse never sees it (the status bit still latches).
 * - `$20` raises unqualified requests (bit 0 CTC 0, bit 6 ULA, bit 7 line) that ignore the enables.
 */

const HANDLER = 0x9000;
const TABLE = 0xbe00;

/** A program: hardware IM2 mode ($C0 = $A1), I = $BE, the ULA's vector $B6 -> HANDLER, `main` then a loop */
async function im2Session(handler: string, main = "        ei", c0 = 0xa1): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(` .org $8000\n di\n jr $`);
  await s.loadCode(
    `
        .org $8000
Start:  di
        ld a,$be
        ld i,a
        im 2
        nextreg $c0,$${c0.toString(16)}
        nextreg $c4,$01         ; the ULA's interrupt only
${main}
Main:   nop
        jr Main

        .org $${HANDLER.toString(16)}
Handler:
${handler}
`,
    { entry: "Start" }
  );
  s.pokeWord(TABLE + 0xb6, HANDLER);
  return s;
}

describe("interrupt debugging: the Interrupts panel's snapshot", () => {
  it("shows the ULA in service, its vector, its handler word and the CPU's IM 2", async () => {
    // --- The handler never returns: the ULA stays in S_ISR (im2_device ~124)
    const s = await im2Session("        di\n        jr $");
    s.runFrames(2);
    const st = s.interruptState();
    expect(st.hwIm2Mode).toBe(true);
    expect(st.vectorBase).toBe(0xa0);
    expect(st.lastVector).toBe(0xb6);
    expect(st.cpu.im).toBe(2);
    expect(st.cpu.i).toBe(0xbe);
    expect(st.interruptDepth).toBe(1);
    const ula = st.sources[NextIntSource.Ula];
    expect(ula).toMatchObject({ enabled: true, pending: true, inService: true, handler: HANDLER });
    // --- $C8 reads status OR pending (im2_peripheral o_int_status)
    expect(ula.status).toBe(true);
    expect(st.sources[NextIntSource.Line].inService).toBe(false);
    expect(st.sources[NextIntSource.Line].enabled).toBe(false);
  });

  it("is read without side effects: a session that reads it every frame stays byte-identical", async () => {
    const handler = "        ei\n        reti";
    const a = await im2Session(handler);
    const b = await im2Session(handler);
    for (let f = 0; f < 5; f++) {
      a.runFrames(1);
      b.runFrames(1);
      for (let k = 0; k < 3; k++) b.interruptState();
    }
    expect(a.memoryDifferences(b)).toEqual([]);
  });

  it("shows a source stuck in service when its handler ended with RETN", async () => {
    // --- RETN ends no service (im2_control: only ED 4D is RETI): the ULA stays in S_ISR, no frame left
    const s = await im2Session("        ei\n        retn");
    s.runFrames(3);
    const st = s.interruptState();
    expect(st.sources[NextIntSource.Ula].inService).toBe(true);
    expect(st.interruptDepth).toBe(0);
  });

  it("reports pulse mode with the NMI idle", async () => {
    const s = await im2Session("        ei\n        reti", "        ei", 0x00);
    s.runFrames(1);
    const st = s.interruptState();
    expect(st.hwIm2Mode).toBe(false);
    expect(st.nmi.state).toBe("idle");
    expect(st.pulseLength === 32 || st.pulseLength === 36).toBe(true);
  });
});

describe("interrupt debugging: the event ring", () => {
  it("records nothing until it is switched on", async () => {
    const s = await im2Session("        ei\n        reti");
    s.runFrames(2);
    expect(s.interruptEvents()).toEqual([]);
  });

  it("records the ULA's request, acknowledge, RETI and return in order", async () => {
    const s = await im2Session("        ei\n        reti");
    s.recordInterrupts(true);
    s.runFrames(3);
    const ev = s.interruptEvents().filter(e => e.source === NextIntSource.Ula);
    const kinds = ev.map(e => e.kind);
    const req = kinds.indexOf(NextIntEventKind.Request);
    expect(req).toBeGreaterThanOrEqual(0);
    expect(kinds.slice(req, req + 4)).toEqual([
      NextIntEventKind.Request,
      NextIntEventKind.Acknowledge,
      NextIntEventKind.Reti,
      NextIntEventKind.End
    ]);
    const ack = ev[req + 1];
    expect(ack.vector).toBe(0xb6);
    expect(ack.flags & NextIntEventFlag.Pulse).toBe(0);
    // --- The interrupted address is the main loop's
    expect(ack.pc).toBeGreaterThanOrEqual(s.symbol("Main"));
    expect(ack.pc).toBeLessThanOrEqual(s.symbol("Main") + 2);
    expect(ack.frame).toBe(ev[req].frame);
    expect(ack.pos28).toBeGreaterThan(ev[req].pos28);
    // --- One request per frame
    expect(ev.filter(e => e.kind === NextIntEventKind.Request).length).toBeGreaterThanOrEqual(2);
  });

  it("records a RETN in a maskable handler, and no RETI", async () => {
    const s = await im2Session("        ei\n        retn");
    s.recordInterrupts(true);
    s.runFrames(3);
    const ev = s.interruptEvents();
    expect(ev.some(e => e.kind === NextIntEventKind.RetnInService && e.source === NextIntSource.Ula)).toBe(true);
    expect(ev.some(e => e.kind === NextIntEventKind.Reti)).toBe(false);
  });

  it("records a pulse lost under DI in pulse mode", async () => {
    // --- ~1968-1995: the pulse lasts 32/36 cycles; DI for the whole frame misses it
    const s = await im2Session("        ei\n        reti", "        di", 0x00);
    s.recordInterrupts(true);
    s.runFrames(2);
    const ev = s.interruptEvents().filter(e => e.source === NextIntSource.Ula);
    expect(ev.some(e => e.kind === NextIntEventKind.Request && (e.flags & NextIntEventFlag.Pulse) !== 0)).toBe(true);
    expect(ev.some(e => e.kind === NextIntEventKind.Lost)).toBe(true);
    expect(ev.some(e => e.kind === NextIntEventKind.Acknowledge)).toBe(false);
  });

  it("names the source of a pulse-mode acknowledge", async () => {
    // --- IM 2 in pulse mode reads its pointer at I * 256 + $FF
    const s = await im2Session("        ei\n        reti", "        ei", 0x00);
    s.pokeWord(TABLE + 0xff, HANDLER);
    s.recordInterrupts(true);
    s.runFrames(2);
    const ack = s.interruptEvents().find(e => e.kind === NextIntEventKind.Acknowledge);
    expect(ack).toBeDefined();
    expect(ack!.source).toBe(NextIntSource.Ula);
    expect(ack!.flags & NextIntEventFlag.Pulse).toBe(NextIntEventFlag.Pulse);
    expect(ack!.vector).toBe(0xff);
  });

  it("marks a NextReg $20 request as software", async () => {
    const s = await im2Session("        ei\n        reti", "        nextreg $20,$40\n        ei");
    s.recordInterrupts(true);
    s.step(10);
    const req = s.interruptEvents().find(e => e.kind === NextIntEventKind.Request);
    expect(req).toMatchObject({ source: NextIntSource.Ula });
    expect(req!.flags & NextIntEventFlag.Software).toBe(NextIntEventFlag.Software);
  });

  it("records the CPU's speed, so a latency is in the CPU's own T-states at 3.5 and 28 MHz alike", async () => {
    // --- The IM 2 acknowledge is 19 T plus the end of the running instruction (NOP / JR: up to 12 T);
    // --- at 28 MHz a memory read waits a clock (sram_wait_n, zxnext.vhd@3.02.04 ~3466-3475), so the
    // --- vector read and the instruction run a few T longer. In 3.5 MHz T-states it would be about 4.
    for (const speed of [0, 3]) {
      const s = await im2Session("        ei\n        reti", `        nextreg $07,${speed}\n        ei`);
      s.recordInterrupts(true);
      s.runFrames(3);
      const ev = s.interruptEvents();
      const lat = [...latencies(ev, { totalHc: 456, totalVc: 311 }).values()];
      expect(lat.length).toBeGreaterThanOrEqual(2);
      for (const l of lat) {
        expect(l, `speed ${speed}`).toBeGreaterThanOrEqual(19);
        expect(l, `speed ${speed}`).toBeLessThanOrEqual(19 + 12 + 8);
      }
      const ack = ev.find((e) => e.kind === NextIntEventKind.Acknowledge)!;
      expect(eventCpuSpeed(ack)).toBe(speed);
    }
  });

  it("keeps counting past its capacity and holds the newest records", async () => {
    const s = await im2Session("        ei\n        reti");
    s.recordInterrupts(true);
    s.runFrames(2);
    const all = s.interruptEvents();
    const since = s.interruptEvents(all.length - 1);
    expect(since.length).toBe(1);
    expect(since[0]).toEqual(all[all.length - 1]);
    s.clearInterruptEvents();
    expect(s.interruptEvents()).toEqual([]);
  });

  it("records an NMI with its device", async () => {
    // --- $06 bit 3 allows the Multiface NMI; $02 bit 3 raises it (zxnext.vhd ~3820-3840)
    const s = await im2Session(
      "        ei\n        reti",
      "        nextreg $06,$08\n        nextreg $02,$08\n        ei"
    );
    s.recordInterrupts(true);
    s.step(20);
    const nmi = s.interruptEvents().find(e => e.kind === NextIntEventKind.Nmi);
    expect(nmi).toBeDefined();
    expect(nmi!.source).toBe(NEXT_INT_SRC_NMI_MULTIFACE);
  });
});

describe("interrupt debugging: the stop watch", () => {
  it("latches the first acknowledge of a watched source, without recording", async () => {
    const s = await im2Session("        ei\n        reti");
    s.watchInterrupts({ kinds: [NextIntEventKind.Acknowledge], ackSources: [NextIntSource.Ula] });
    s.runFrames(1);
    const hit = s.takeInterruptHit();
    expect(hit).toMatchObject({ kind: NextIntEventKind.Acknowledge, source: NextIntSource.Ula, vector: 0xb6 });
    expect(s.takeInterruptHit()).toBeUndefined();
    expect(s.interruptEvents()).toEqual([]);
  });

  it("does not latch an acknowledge of another source", async () => {
    const s = await im2Session("        ei\n        reti");
    s.watchInterrupts({ kinds: [NextIntEventKind.Acknowledge], ackSources: [NextIntSource.Line] });
    s.runFrames(2);
    expect(s.takeInterruptHit()).toBeUndefined();
  });

  it("latches a request that waited longer than the limit", async () => {
    // --- CTC 0 requested by $20 (unqualified) with interrupts disabled: it stays in S_REQ
    const s = await im2Session("        ei\n        reti", "        nextreg $20,$01\n        di");
    s.watchInterrupts({ kinds: [NextIntEventKind.Wait], waitLimit: 1000 });
    s.runFrames(1);
    const hit = s.takeInterruptHit();
    expect(hit).toMatchObject({ kind: NextIntEventKind.Wait, source: NextIntSource.Ctc0 });
  });

  it("disarms with no kinds", async () => {
    const s = await im2Session("        ei\n        reti");
    s.watchInterrupts({ kinds: [NextIntEventKind.Acknowledge], ackSources: [NextIntSource.Ula] });
    s.watchInterrupts();
    s.runFrames(2);
    expect(s.takeInterruptHit()).toBeUndefined();
  });
});
