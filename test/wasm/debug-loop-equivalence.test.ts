import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { connectConditionSupport } from "@emu/machines/conditionStore";
import { wasmDebugLoopOptions } from "@emu/machines/wasmDebugLoop";
import { createSp48Session } from "../harness/sp48";
import { createSp128Session } from "../harness/sp128";
import { createSession as createNextSession } from "../harness/zxnext";
import { createZ88Session, Z88_FLAT_RAM_LAYOUT } from "../harness/z88";
import { createZx81Session } from "../harness/zx81";

/**
 * The debugger's in-core loop decides exactly as the instruction-by-instruction loop does
 * (`.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md` Phases 4a and 4b, T6).
 *
 * Each machine runs the same program twice, with the same breakpoints, through a sequence of continues,
 * step-overs and step-outs: once as the IDE runs it (in the core wherever it can), once instruction by
 * instruction (`wasmDebugLoopOptions.inCore = false`). Every stop must be the same: PC, registers and
 * T-states. The breakpoints: an execution breakpoint with a condition and one with a hit-count rule
 * (Phase 4a), and memory-read, memory-write and port-read breakpoints, one of them with a hit-count rule
 * (Phase 4b).
 */

type Machine = {
  pc: number;
  bc: number;
  af: number;
  sp: number;
  tacts: number;
  executionContext: {
    debugStepMode: DebugStepMode;
    frameTerminationMode: FrameTerminationMode;
    debugSupport?: DebugSupport;
  };
  executeMachineFrame(): FrameTerminationMode;
  markStepOutAddress(): void;
  wasmV2Runtime?: { exports: Record<string, (...args: number[]) => number> };
};

/**
 * A loop that calls a routine ten times, then counts its rounds and reads a port; `di` keeps it off
 * interrupt handlers
 */
function program(base: number, counter: number, di: boolean, port: number) {
  const code: number[] = [];
  const at = () => base + code.length;
  const word = (v: number) => code.push(v & 0xff, (v >> 8) & 0xff);
  code.push(di ? 0xf3 : 0xfb);
  const start = at();
  code.push(0x06, 0x0a); // ld b,10
  const loop = at();
  code.push(0xcd);
  const callAt = code.length;
  word(0); // call sub
  code.push(0x10, (loop - (at() + 2)) & 0xff); // djnz loop
  code.push(0x2a); word(counter); // ld hl,(counter)
  code.push(0x23); // inc hl
  code.push(0x22); word(counter); // ld (counter),hl
  code.push(0x01); word(port); // ld bc,port
  code.push(0xed, 0x78); // in a,(c)
  code.push(0x18, (start - (at() + 2)) & 0xff); // jr start
  const sub = at();
  code[callAt] = sub & 0xff;
  code[callAt + 1] = sub >> 8;
  code.push(0xc5, 0x78, 0x87, 0xc1, 0xc9); // push bc; ld a,b; add a,a; pop bc; ret
  return { code, start, loop, sub, entry: base };
}

type Setup = { machine: Machine; prefix: string; base: number; counter: number; di: boolean; port: number };

const MACHINES: Record<string, () => Promise<Setup>> = {
  sp48: async () => {
    const s = await createSp48Session();
    s.bootToBasic();
    return { machine: s.machine as unknown as Machine, prefix: "sp48", base: 0x8000, counter: 0x9000, di: false, port: 0x7ffe };
  },
  sp128: async () => {
    const s = await createSp128Session("sp128");
    s.runFrames(150);
    return { machine: s.machine as unknown as Machine, prefix: "sp128", base: 0x8000, counter: 0x9000, di: false, port: 0x7ffe };
  },
  spp3e: async () => {
    const s = await createSp128Session("nofdd");
    s.runFrames(150);
    return { machine: s.machine as unknown as Machine, prefix: "spp3e", base: 0x8000, counter: 0x9000, di: false, port: 0x7ffe };
  },
  zxnext: async () => {
    const s = await createNextSession();
    return { machine: s.machine as unknown as Machine, prefix: "zxnext", base: 0x8000, counter: 0x9000, di: true, port: 0x7ffe };
  },
  z88: async () => {
    const s = await createZ88Session({ audioSampleRate: 44100 });
    const x = (s.machine as unknown as Machine).wasmV2Runtime!.exports;
    x.z88SetCom(Z88_FLAT_RAM_LAYOUT.COM);
    [Z88_FLAT_RAM_LAYOUT.SR0, Z88_FLAT_RAM_LAYOUT.SR1, Z88_FLAT_RAM_LAYOUT.SR2, Z88_FLAT_RAM_LAYOUT.SR3].forEach((b, i) =>
      x.z88SetSr(i, b)
    );
    return { machine: s.machine as unknown as Machine, prefix: "z88", base: 0x8000, counter: 0x9000, di: true, port: 0xffb2 };
  },
  zx81: async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    return { machine: s.machine as unknown as Machine, prefix: "zx8081", base: 0x6000, counter: 0x6200, di: true, port: 0xfffe };
  }
};

type Stop = { action: string; pc: number; bc: number; af: number; sp: number; tacts: number; decision?: number };

/** Runs a debugger action to its stop, as the controller does */
function debug(m: Machine, action: "continue" | "stepOver" | "stepOut"): void {
  const ctx = m.executionContext;
  if (action === "stepOut") m.markStepOutAddress();
  ctx.frameTerminationMode = FrameTerminationMode.DebugEvent;
  ctx.debugStepMode =
    action === "continue" ? DebugStepMode.StopAtBreakpoint : action === "stepOver" ? DebugStepMode.StepOver : DebugStepMode.StepOut;
  try {
    for (let frames = 0; m.executeMachineFrame() !== FrameTerminationMode.DebugEvent; frames++) {
      if (frames > 200) throw new Error(`no stop after 200 frames (${action}, PC $${m.pc.toString(16)})`);
    }
  } finally {
    ctx.frameTerminationMode = FrameTerminationMode.Normal;
    ctx.debugStepMode = DebugStepMode.NoDebug;
  }
}

async function stops(id: string, inCore: boolean): Promise<Stop[]> {
  const { machine: m, prefix, base, counter, di, port } = await MACHINES[id]();
  const w = m.wasmV2Runtime!.exports;
  const p = program(base, counter, di, port);
  p.code.forEach((v, i) => w[`${prefix}WriteMemory`](base + i, v));
  w[`${prefix}WriteMemory`](counter, 0);
  w[`${prefix}WriteMemory`](counter + 1, 0);
  m.pc = p.entry;
  m.sp = base - 0x100;

  const ds = new DebugSupport(undefined, []);
  connectConditionSupport(ds, m as never);
  m.executionContext.debugSupport = ds;
  // --- Once per round: the routine's call with B = 3
  ds.addBreakpoint({ address: p.sub, exec: true, condition: "B == 3" });
  // --- Every third time the outer loop starts
  ds.addBreakpoint({ address: p.start, exec: true, hitMode: "every", hitCount: 3 });
  // --- Every other read of the round counter, every write of its high byte, the port's every read
  ds.addBreakpoint({ address: counter, memoryRead: true, hitMode: "every", hitCount: 2 });
  ds.addBreakpoint({ address: counter + 1, memoryWrite: true });
  ds.addBreakpoint({ address: port, ioRead: true });

  wasmDebugLoopOptions.inCore = inCore;
  const out: Stop[] = [];
  // --- `decision`: the stop policy's last decision point, which an access stop reports as its instruction
  const record = (action: string) =>
    out.push({ action, pc: m.pc, bc: m.bc, af: m.af, sp: m.sp, tacts: m.tacts, decision: ds.lastDecisionPc });
  const actions: ("continue" | "stepOver" | "stepOut")[] = [
    "continue", "continue", "continue", "stepOver", "stepOver", "stepOut", "continue",
    "stepOver", "stepOver", "stepOver", "continue", "stepOut", "continue", "continue"
  ];
  try {
    for (const action of actions) {
      debug(m, action);
      record(action);
    }
  } finally {
    wasmDebugLoopOptions.inCore = true;
  }
  return out;
}

describe("debug loop: in the core = instruction by instruction", () => {
  for (const id of Object.keys(MACHINES)) {
    it(id, async () => {
      const inCore = await stops(id, true);
      const perInstruction = await stops(id, false);
      expect(inCore).toEqual(perInstruction);
      // --- The program reached both breakpoints and the steps moved
      expect(new Set(inCore.map((s) => s.pc)).size).toBeGreaterThan(3);
    });
  }
});
