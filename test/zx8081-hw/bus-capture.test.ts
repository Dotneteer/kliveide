import { describe, expect, it } from "vitest";

import { createZx81Session, type Zx81TestSession } from "../harness/zx81";

/**
 * The bus record after a fast frame (`.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md` Phase 1).
 *
 * A fast frame records the CPU's bus activity (the access log, the port event, the instruction's
 * start) only near its end, but the CPU panel of a machine paused from a plain Run reads them: they
 * must describe the frame's last instruction exactly as a debugger run, which records every
 * instruction, does. Two identical machines run the same frames, one through `zx8081ExecuteFrame` and
 * one through `zx8081ExecuteUntilStop`, and must agree after every frame.
 */

const NO_EXTRA_STOP = 0xffffffff;

type Exports = Record<string, (...args: number[]) => number> & { memory: WebAssembly.Memory };

function exportsOf(s: Zx81TestSession): Exports {
  return (s.machine as unknown as { wasmV2Runtime: { exports: Exports } }).wasmV2Runtime.exports;
}

function busRecord(x: Exports) {
  const count = x.zx8081GetAccessLogCount();
  const log = Array.from(new Uint32Array(x.memory.buffer, x.zx8081GetAccessLogPtr(), count));
  return {
    pc: x.zx8081GetCpuPc(),
    opStart: x.zx8081GetOpStartAddress(),
    log,
    port: [x.zx8081GetLastPortAddress(), x.zx8081GetLastPortValue(), x.zx8081GetLastPortIsWrite()]
  };
}

/*
 *   $6000  DI
 *   $6001  LD HL,($6100)
 *   $6004  INC HL
 *   $6005  LD ($6100),HL
 *   $6008  IN A,($FE)
 *   $600A  PUSH HL
 *   $600B  POP DE
 *   $600C  JR $6001
 */
const PROGRAM = [0xf3, 0x2a, 0x00, 0x61, 0x23, 0x22, 0x00, 0x61, 0xdb, 0xfe, 0xe5, 0xd1, 0x18, 0xf3];

async function twoMachines(withProgram: boolean): Promise<[Exports, Exports]> {
  const machines: Exports[] = [];
  for (let i = 0; i < 2; i++) {
    const s = await createZx81Session();
    s.bootToBasic();
    if (withProgram) {
      s.poke(0x6000, PROGRAM);
      s.machine.pc = 0x6000;
    }
    machines.push(exportsOf(s));
  }
  return [machines[0], machines[1]];
}

function runAndCompare(fast: Exports, debug: Exports, frames: number): void {
  for (let frame = 0; frame < frames; frame++) {
    fast.zx8081ExecuteFrame();
    do {
      debug.zx8081ExecuteUntilStop(NO_EXTRA_STOP, 0);
    } while (debug.zx8081GetFrameCompleted() === 0);
    expect(busRecord(fast), `after frame ${frame}`).toEqual(busRecord(debug));
  }
}

describe("ZX81 bus record after a fast frame", () => {
  it("matches a debugger run at the BASIC prompt (SLOW mode, the display file runs)", async () => {
    const [fast, debug] = await twoMachines(false);
    runAndCompare(fast, debug, 25);
  });

  it("matches a debugger run in a program that reads, writes and reads a port", async () => {
    const [fast, debug] = await twoMachines(true);
    runAndCompare(fast, debug, 25);
    // --- The program ran: its counter moved, and the last frame recorded data accesses
    expect(fast.zx8081ReadMemory(0x6100) | (fast.zx8081ReadMemory(0x6101) << 8)).toBeGreaterThan(0);
  });
});
