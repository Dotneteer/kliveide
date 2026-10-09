import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { connectConditionSupport } from "@emu/machines/conditionStore";

import { createSp48Session } from "../harness/sp48";
import { createSp128Session } from "../harness/sp128";
import { createSession as createNextSession } from "../harness/zxnext";
import { createZ88Session, Z88_FLAT_RAM_LAYOUT } from "../harness/z88";
import { createZx81Session } from "../harness/zx81";

/*
 * What running with the debugger costs on every core, against a plain Run - the D14 budgets of
 * `.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md` (§10.6-§10.8 hold the measurements). `npm run test:perf`; not
 * part of the regular tiers, because a timing ratio on a shared runner is noise.
 *
 * Each bound is the budget plus the ~3% the plan measured as noise between identical builds (T10). The
 * bounds are guards: a debug path that fell back to running instruction by instruction in TypeScript
 * costs 2x and more, far over any of them. The Z88's budgets are the plan's recorded exceptions: its frame
 * is so short that the stop table copied on every entry (~10 µs) shows as 0.3x.
 *
 * The workload is a loop in RAM: a block copy, a CALL/RET, a port read and an arithmetic loop (the ZX81
 * runs its ROM at the BASIC prompt instead). Execution history has its own guard
 * (`history/history-cores.perf.test.ts`).
 */

type Mode = "run" | "debug" | "execPoint" | "access" | "cond";

/**
 * D14 budget + noise; the Z88's are its recorded exceptions. The project start's budget (1.05x) gets
 * 5% rather than 3%: it measures 1.01-1.07x, a whole frame of a short run whose fixed costs show.
 */
const BOUNDS: Record<string, Partial<Record<Mode, number>>> = {
  default: { debug: 1.18, execPoint: 1.1, access: 1.33, cond: 1.33 },
  z88: { debug: 1.45, execPoint: 1.35, access: 1.5, cond: 1.5 }
};

const NEVER = 0x7000;

type Machine = {
  pc: number;
  sp: number;
  executionContext: {
    debugStepMode: DebugStepMode;
    frameTerminationMode: FrameTerminationMode;
    terminationPoint?: number;
    debugSupport?: DebugSupport;
  };
  executeMachineFrame(): FrameTerminationMode;
  wasmV2Runtime?: { exports: Record<string, (...args: number[]) => number> };
};

/** The loop, and the address of its hottest instruction (the inner `add a,b`, 32 passes a round) */
function mixedProgram(port: number, di: boolean): { code: number[]; hot: number } {
  const code: number[] = [];
  const at = () => 0x8000 + code.length;
  const w = (v: number) => code.push(v & 0xff, (v >> 8) & 0xff);
  code.push(di ? 0xf3 : 0xfb);
  const start = at();
  code.push(0x21); w(0xa000); // ld hl,$a000
  code.push(0x11); w(0xa100); // ld de,$a100
  code.push(0x01); w(0x0040); // ld bc,$40
  code.push(0xed, 0xb0); // ldir
  code.push(0xcd); const callAt = code.length; w(0); // call sub
  code.push(0x01); w(port); // ld bc,port
  code.push(0xed, 0x78); // in a,(c)
  code.push(0x06, 0x20); // ld b,$20
  const hot = at();
  code.push(0x80); // add a,b
  code.push(0x10, (hot - (at() + 2)) & 0xff); // djnz
  code.push(0x18, (start - (at() + 2)) & 0xff); // jr start
  const sub = at();
  code[callAt] = sub & 0xff;
  code[callAt + 1] = sub >> 8;
  code.push(0xe5, 0x7e, 0x3c, 0x77, 0xe1, 0xc9); // push hl; ld a,(hl); inc a; ld (hl),a; pop hl; ret
  return { code, hot };
}

type Setup = { machine: Machine; prefix?: string; port: number; di: boolean; frames: number };

const MACHINES: Record<string, () => Promise<Setup>> = {
  sp48: async () => {
    const s = await createSp48Session();
    s.bootToBasic();
    return { machine: s.machine as unknown as Machine, prefix: "sp48", port: 0x7ffe, di: false, frames: 20 };
  },
  sp128: async () => {
    const s = await createSp128Session("sp128");
    s.runFrames(150);
    return { machine: s.machine as unknown as Machine, prefix: "sp128", port: 0x7ffe, di: false, frames: 20 };
  },
  spp3e: async () => {
    const s = await createSp128Session("nofdd");
    s.runFrames(150);
    return { machine: s.machine as unknown as Machine, prefix: "spp3e", port: 0x7ffe, di: false, frames: 20 };
  },
  zxnext: async () => {
    const s = await createNextSession();
    return { machine: s.machine as unknown as Machine, prefix: "zxnext", port: 0x7ffe, di: true, frames: 10 };
  },
  z88: async () => {
    const s = await createZ88Session({ audioSampleRate: 44100 });
    const x = (s.machine as unknown as Machine).wasmV2Runtime!.exports;
    x.z88SetCom(Z88_FLAT_RAM_LAYOUT.COM);
    [Z88_FLAT_RAM_LAYOUT.SR0, Z88_FLAT_RAM_LAYOUT.SR1, Z88_FLAT_RAM_LAYOUT.SR2, Z88_FLAT_RAM_LAYOUT.SR3].forEach((b, i) =>
      x.z88SetSr(i, b)
    );
    return { machine: s.machine as unknown as Machine, prefix: "z88", port: 0xffb2, di: true, frames: 200 };
  },
  // --- The ROM at the BASIC prompt (SLOW mode), no RAM loop: no `cond` measurement
  zx81: async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    return { machine: s.machine as unknown as Machine, port: 0, di: true, frames: 20 };
  }
};

function setMode(m: Machine, mode: Mode, supports: Partial<Record<Mode, DebugSupport>>): void {
  const ctx = m.executionContext;
  ctx.debugSupport = supports[mode];
  if (mode === "run") {
    ctx.debugStepMode = DebugStepMode.NoDebug;
    ctx.frameTerminationMode = FrameTerminationMode.Normal;
  } else if (mode === "execPoint") {
    ctx.debugStepMode = DebugStepMode.NoDebug;
    ctx.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;
    ctx.terminationPoint = NEVER;
  } else {
    ctx.debugStepMode = DebugStepMode.StopAtBreakpoint;
    ctx.frameTerminationMode = FrameTerminationMode.DebugEvent;
  }
}

async function measure(id: string): Promise<Partial<Record<Mode, number>>> {
  const { machine: m, prefix, port, di, frames } = await MACHINES[id]();
  let hot: number | undefined;
  if (prefix) {
    const w = m.wasmV2Runtime!.exports;
    const program = mixedProgram(port, di);
    program.code.forEach((v, i) => w[`${prefix}WriteMemory`](0x8000 + i, v));
    m.pc = 0x8000;
    m.sp = 0xbff0;
    hot = program.hot;
  }
  const support = (setup?: (ds: DebugSupport) => void) => {
    const ds = new DebugSupport(undefined, []);
    connectConditionSupport(ds, m as never);
    ds.addBreakpoint({ address: NEVER, exec: true });
    setup?.(ds);
    return ds;
  };
  const supports: Partial<Record<Mode, DebugSupport>> = {
    debug: support(),
    access: support((ds) => {
      ds.addBreakpoint({ address: 0xbfff, memoryRead: true });
      ds.addBreakpoint({ address: 0x1234, ioWrite: true });
    }),
    ...(hot !== undefined
      ? { cond: support((ds) => ds.addBreakpoint({ address: hot, exec: true, condition: "B == 0" })) }
      : {})
  };
  const modes: Mode[] = ["run", "debug", "execPoint", "access", ...(hot !== undefined ? (["cond"] as Mode[]) : [])];
  const best: Partial<Record<Mode, number>> = {};
  for (const mode of modes) {
    setMode(m, mode, supports);
    for (let i = 0; i < 3; i++) m.executeMachineFrame();
  }
  for (let round = 0; round < 7; round++) {
    for (let i = 0; i < modes.length; i++) {
      const mode = modes[(i + round) % modes.length];
      setMode(m, mode, supports);
      const start = performance.now();
      for (let f = 0; f < frames; f++) {
        if (m.executeMachineFrame() !== FrameTerminationMode.Normal) throw new Error(`${id} ${mode}: a stop`);
      }
      best[mode] = Math.min(best[mode] ?? Infinity, performance.now() - start);
    }
  }
  setMode(m, "run", supports);
  const ratios: Partial<Record<Mode, number>> = {};
  for (const mode of modes) if (mode !== "run") ratios[mode] = best[mode]! / best.run!;
  process.stdout.write(
    `${id}: ${Object.entries(ratios)
      .map(([k, v]) => `${k} ${v!.toFixed(2)}x`)
      .join(", ")}\n`
  );
  return ratios;
}

describe("debugging costs a plain Run's time plus the D14 budgets", () => {
  for (const id of Object.keys(MACHINES)) {
    it(id, async () => {
      const ratios = await measure(id);
      const bounds = { ...BOUNDS.default, ...(BOUNDS[id] ?? {}) };
      for (const [mode, ratio] of Object.entries(ratios)) {
        expect(ratio, `${id} ${mode}`).toBeLessThan(bounds[mode as Mode]!);
      }
    });
  }
});
