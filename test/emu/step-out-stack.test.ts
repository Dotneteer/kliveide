import { describe, expect, it } from "vitest";
import { Z80Cpu } from "@emu/z80/Z80Cpu";

/**
 * The step-out shadow stack, tested on the interpreted CPU.
 *
 * The WASM cores carry a line-for-line port of this in `z80.c` (`pushToStepOutStack`,
 * `z80GetStepOutAddress`), so exercising the algorithm here covers the model both share. What it
 * cannot cover is the C transcription itself; that is checked by driving the machines in the app.
 *
 * Before this stack existed core-side, `markStepOutAddress` on a WASM machine always produced -1 —
 * the pushes below happen in TypeScript, which never runs when the CPU executes inside the core —
 * so `stepOutAddress === pc` could never be true and step-out had nothing to stop on.
 */
class TestCpu extends Z80Cpu {
  memory = new Uint8Array(0x10000);
  doReadMemory(address: number): number {
    return this.memory[address & 0xffff];
  }
  doWriteMemory(address: number, value: number): void {
    this.memory[address & 0xffff] = value;
  }
  doReadPort(): number {
    return 0xff;
  }
  doWritePort(): void {}
  delayMemoryRead(): void {}
  delayMemoryWrite(): void {}
  delayPortRead(): void {}
  delayPortWrite(): void {}
  delayAddressBusAccess(): void {}
}

function cpuWith(code: number[], start = 0x8000) {
  const cpu = new TestCpu();
  cpu.reset();
  code.forEach((b, i) => (cpu.memory[start + i] = b));
  cpu.pc = start;
  return cpu;
}

describe("step-out shadow stack", () => {
  it("has no target before anything has been called", () => {
    const cpu = cpuWith([0x00]);
    cpu.markStepOutAddress();
    expect(cpu.stepOutAddress).toBe(-1);
  });

  it("records the return address of a CALL", () => {
    // --- CALL $9000 at $8000 is three bytes, so the routine returns to $8003.
    const cpu = cpuWith([0xcd, 0x00, 0x90]);
    cpu.executeCpuCycle();
    expect(cpu.pc).toBe(0x9000);
    cpu.markStepOutAddress();
    expect(cpu.stepOutAddress).toBe(0x8003);
  });

  it("records the return address of an RST", () => {
    const cpu = cpuWith([0xdf]); // --- RST $18, one byte
    cpu.executeCpuCycle();
    expect(cpu.pc).toBe(0x0018);
    cpu.markStepOutAddress();
    expect(cpu.stepOutAddress).toBe(0x8001);
  });

  it("tracks the innermost call, which is what step-out is asked about", () => {
    const cpu = cpuWith([0xcd, 0x00, 0x90]);
    cpu.executeCpuCycle(); // --- into $9000
    cpu.memory[0x9000] = 0xcd; // --- CALL $A000 from inside
    cpu.memory[0x9001] = 0x00;
    cpu.memory[0x9002] = 0xa0;
    cpu.executeCpuCycle();
    expect(cpu.pc).toBe(0xa000);
    cpu.markStepOutAddress();
    // --- The inner routine returns to $9003, not to the outer $8003.
    expect(cpu.stepOutAddress).toBe(0x9003);
  });

  it("records an interrupt like a call, so stepping out of a handler returns to the interrupted instruction", () => {
    /*
     * An interrupt stacks a return address and the handler ends in RET/RETI/RETN, so the shadow
     * stack has to see it. Before it did, an interrupt arriving mid-step made step-out overshoot
     * the handler *and* the routine beneath it — observed on the 48K, which stepped out to $15FE
     * instead of the interrupted $15DE.
     */
    const cpu = cpuWith([0x00]);
    cpu.iff1 = true;
    cpu.interruptMode = 1;
    cpu.pushPC();
    cpu.markStepOutAddress();
    expect(cpu.stepOutAddress).toBe(0x8000);
  });

  it("keeps the most recent of many calls, and survives more than the buffer holds", () => {
    const cpu = cpuWith([0x00]);
    for (let i = 0; i < 300; i++) {
      cpu.pushToStepOutStack((0x1000 + i) & 0xffff);
    }
    cpu.markStepOutAddress();
    expect(cpu.stepOutAddress).toBe(0x1000 + 299);
  });

  it("forgets everything on reset", () => {
    const cpu = cpuWith([0xcd, 0x00, 0x90]);
    cpu.executeCpuCycle();
    cpu.reset();
    cpu.markStepOutAddress();
    expect(cpu.stepOutAddress).toBe(-1);
  });
});

/*
 * Balance: a RET consumes the entry its CALL pushed.
 *
 * The stack was push-only to begin with, so `markStepOutAddress` could peek an entry belonging to a
 * call that had already returned. Step-out then waited for an address the program would never reach
 * again and ran on to the next real breakpoint — reported against ScrollNutter, where a routine is
 * reached once by `call` and again by `jp`.
 */
describe("step-out shadow stack, balanced against RET", () => {
  function ramAt(cpu: TestCpu, address: number, bytes: number[]) {
    bytes.forEach((b, i) => (cpu.memory[address + i] = b));
  }

  it("drops the entry when a routine returns", () => {
    const cpu = cpuWith([0xcd, 0x00, 0x90]); // --- CALL $9000, returns to $8003
    ramAt(cpu, 0x9000, [0xc9]); // --- RET
    cpu.executeCpuCycle();
    cpu.markStepOutAddress();
    expect(cpu.stepOutAddress).toBe(0x8003);

    cpu.executeCpuCycle(); // --- RET
    cpu.markStepOutAddress();
    expect(cpu.stepOutAddress).toBe(-1);
  });

  it("targets the outer routine once an inner call has returned", () => {
    // --- Step into a nested call, back out of it, then ask to step out of the routine holding it.
    const cpu = cpuWith([0xcd, 0x00, 0x90]); // --- $8000: CALL $9000 -> returns to $8003
    ramAt(cpu, 0x9000, [0xcd, 0x00, 0x91]); // --- $9000: CALL $9100 -> returns to $9003
    ramAt(cpu, 0x9100, [0xc9]); // --- $9100: RET
    ramAt(cpu, 0x9003, [0xc9]); // --- $9003: RET

    cpu.executeCpuCycle(); // --- CALL $9000
    cpu.executeCpuCycle(); // --- CALL $9100
    cpu.markStepOutAddress();
    expect(cpu.stepOutAddress).toBe(0x9003);

    cpu.executeCpuCycle(); // --- RET, back into the outer routine
    expect(cpu.pc).toBe(0x9003);

    // --- Was $9003 before the fix: the inner call's return address, already in the past.
    cpu.markStepOutAddress();
    expect(cpu.stepOutAddress).toBe(0x8003);
  });

  it("targets the caller's caller after a tail call", () => {
    /*
     * The ScrollNutter shape: `call InitPaletteRamp` and, further down the same routine,
     * `jp InitPaletteRamp`. The `jp` pushes nothing, so the routine's RET returns past its caller.
     */
    const cpu = cpuWith([0xcd, 0x00, 0x90]); // --- $8000: CALL $9000 -> returns to $8003
    ramAt(cpu, 0x9000, [0xcd, 0x00, 0x91]); // --- $9000: CALL $9100 -> returns to $9003
    ramAt(cpu, 0x9003, [0xc3, 0x00, 0x91]); // --- $9003: JP $9100 (tail call, pushes nothing)
    ramAt(cpu, 0x9100, [0xc9]); // --- $9100: RET

    cpu.executeCpuCycle(); // --- CALL $9000
    cpu.executeCpuCycle(); // --- CALL $9100, first entry
    cpu.markStepOutAddress();
    expect(cpu.stepOutAddress).toBe(0x9003);

    cpu.executeCpuCycle(); // --- RET -> $9003
    cpu.executeCpuCycle(); // --- JP $9100, second entry
    expect(cpu.pc).toBe(0x9100);

    // --- Was $9003 before the fix, an address the program never reaches again.
    cpu.markStepOutAddress();
    expect(cpu.stepOutAddress).toBe(0x8003);
  });

  it("does not consume an entry when a conditional RET is not taken", () => {
    // --- RET NZ with Z set falls through, so the routine has not returned.
    const cpu = cpuWith([0xcd, 0x00, 0x90]);
    ramAt(cpu, 0x9000, [0xc0]); // --- RET NZ
    cpu.executeCpuCycle(); // --- CALL $9000
    cpu.f |= 0x40; // --- set Z, so NZ is false
    cpu.executeCpuCycle(); // --- RET NZ, not taken
    expect(cpu.pc).toBe(0x9001);

    cpu.markStepOutAddress();
    expect(cpu.stepOutAddress).toBe(0x8003);
  });

  it("survives a RET with nothing pushed", () => {
    // --- Ordinary: the machine can be reset mid-routine, or ROM can return from a call made before
    // --- the debugger was watching. No target is the honest answer, and nothing underflows.
    const cpu = cpuWith([0xc9]); // --- RET
    cpu.executeCpuCycle();
    cpu.markStepOutAddress();
    expect(cpu.stepOutAddress).toBe(-1);

    // --- And the stack still works afterwards.
    cpu.pushToStepOutStack(0x1234);
    cpu.markStepOutAddress();
    expect(cpu.stepOutAddress).toBe(0x1234);
  });
});
