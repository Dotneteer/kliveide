import { describe, expect, it } from "vitest";
import { Z80Cpu } from "@emu/z80/Z80Cpu";

/**
 * `iff1`, `iff2` and `interruptMode` must stay overridable by a subclass.
 *
 * `ZxNextWasmV2Machine` mirrors every Z80 register into the WASM core by overriding it with a
 * `get`/`set` pair that writes through to `super` and then calls `zxnextSetCpu*`. That works for
 * `sp`, `pc`, `a` and twenty-odd others because those are real accessors on `Z80Cpu`.
 *
 * These three were plain class fields. With `target: esnext`, `useDefineForClassFields` is on, so a
 * bare field is installed as an **own data property** on every instance while `Z80Cpu` constructs —
 * and an own data property shadows a prototype accessor permanently. `machine.iff1 = true` wrote to
 * the instance and the WASM core never heard about it, silently, for those three registers only.
 *
 * The type checker had been reporting this the whole time (TS2611 ×3, TS2855 ×6). Nobody saw it,
 * because `npm run build:check` was type-checking nothing.
 *
 * These tests fail on the pre-fix `Z80Cpu` — the first, third and fourth report zero setter calls
 * and an own `iff1` property — so they are a real guard, not a restatement of the implementation.
 */

/** The shape `ZxNextWasmV2Machine` uses, reduced to what the mechanism needs. */
class MirroringChild extends Z80Cpu {
  calls: [string, unknown][] = [];

  override get iff1(): boolean {
    return super.iff1;
  }
  override set iff1(value: boolean) {
    super.iff1 = value;
    this.calls.push(["setIff1", value]);
  }

  override get iff2(): boolean {
    return super.iff2;
  }
  override set iff2(value: boolean) {
    super.iff2 = value;
    this.calls.push(["setIff2", value]);
  }

  override get interruptMode(): number {
    return super.interruptMode;
  }
  override set interruptMode(value: number) {
    super.interruptMode = value;
    this.calls.push(["setIm", value]);
  }
}

describe("Z80Cpu interrupt-state mirroring", () => {
  it("lets a subclass intercept writes to iff1, iff2 and interruptMode", () => {
    const cpu = new MirroringChild();

    cpu.iff1 = true;
    cpu.iff2 = true;
    cpu.interruptMode = 2;

    expect(cpu.calls).toEqual([
      ["setIff1", true],
      ["setIff2", true],
      ["setIm", 2]
    ]);
  });

  it("reads the value back through super rather than returning undefined", () => {
    // --- The trap in the other direction: silencing TS2611 with a `declare` modifier removes the
    // --- own property but leaves nothing on Z80Cpu.prototype for `super.iff1` to reach, so the
    // --- getter yields undefined and the emulator breaks. Real accessors are what make this pass.
    const cpu = new MirroringChild();

    cpu.iff1 = true;
    cpu.iff2 = false;
    cpu.interruptMode = 1;

    expect(cpu.iff1).toBe(true);
    expect(cpu.iff2).toBe(false);
    expect(cpu.interruptMode).toBe(1);
  });

  it("installs no own data property that would shadow the subclass accessor", () => {
    const cpu = new MirroringChild();
    cpu.iff1 = true;

    expect(Object.getOwnPropertyDescriptor(cpu, "iff1")).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(cpu, "iff2")).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(cpu, "interruptMode")).toBeUndefined();
  });

  it("routes the interpreter's own writes through the subclass too", () => {
    // --- The case that matters in practice: it is not only external code that assigns these.
    // --- `reset()`, EI/DI, IM 0/1/2, RETN and NMI dispatch all write them from inside the core,
    // --- and each of those has to reach the WASM mirror as well.
    const cpu = new MirroringChild();
    cpu.calls.length = 0;

    cpu.reset();

    expect(cpu.calls.map(([name]) => name).sort()).toEqual(["setIff1", "setIff2", "setIm"]);
  });

  it("still behaves as a plain property for the base class on its own", () => {
    const cpu = new Z80Cpu();

    cpu.iff1 = true;
    cpu.iff2 = true;
    cpu.interruptMode = 2;
    expect([cpu.iff1, cpu.iff2, cpu.interruptMode]).toEqual([true, true, 2]);

    cpu.reset();
    expect([cpu.iff1, cpu.iff2, cpu.interruptMode]).toEqual([false, false, 0]);
  });
});
