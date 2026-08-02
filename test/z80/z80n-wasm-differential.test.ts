import { describe, expect, it } from "vitest";
import { RunMode as TypeScriptRunMode, Z80TestMachine as TypeScriptMachine } from "./test-z80";
import { RunMode as WasmRunMode, Z80TestMachine as WasmMachine } from "./wasm-test-z80";

function setCommonState (ts: TypeScriptMachine, wasm: WasmMachine): void {
  ts.cpu.af = wasm.cpu.af = 0x1234;
  ts.cpu.bc = wasm.cpu.bc = 0x10cc;
  ts.cpu.de = wasm.cpu.de = 0x2345;
  ts.cpu.hl = wasm.cpu.hl = 0x3000;
  ts.cpu.ix = wasm.cpu.ix = 0x4100;
  ts.cpu.iy = wasm.cpu.iy = 0x4200;
  ts.cpu.sp = wasm.cpu.sp = 0x8000;
}

function snapshot (machine: TypeScriptMachine | WasmMachine) {
  const { cpu } = machine;

  return {
    af: cpu.af, bc: cpu.bc, de: cpu.de, hl: cpu.hl,
    ix: cpu.ix, iy: cpu.iy, ir: cpu.ir, wz: cpu.wz,
    pc: cpu.pc, sp: cpu.sp, tacts: cpu.tacts, frameTacts: cpu.frameTacts,
    prefix: cpu.prefix, halted: cpu.halted, iff1: cpu.iff1, iff2: cpu.iff2
  };
}

function memoryLog (machine: TypeScriptMachine | WasmMachine) {
  return machine.memoryAccessLog.map(entry => ({
    address: entry.address & 0xffff,
    value: entry.value & 0xff,
    isWrite: entry.isWrite
  }));
}

function ioLog (machine: TypeScriptMachine | WasmMachine) {
  return machine.ioAccessLog.map(entry => ({
    address: entry.address & 0xffff,
    value: entry.value & 0xff,
    isOutput: entry.isOutput
  }));
}

function tbBlueLog (machine: TypeScriptMachine | WasmMachine) {
  return machine.tbBlueAccessLog.map(entry => ({
    address: entry.address & 0xffff,
    value: entry.value & 0xff,
    isOutput: entry.isOutput
  }));
}

function expectMatch (ts: TypeScriptMachine, wasm: WasmMachine, label: string, compareMemoryLog = true): void {
  expect(snapshot(wasm), `${label} state`).toEqual(snapshot(ts));
  expect(Array.from(wasm.memory), `${label} memory`).toEqual(Array.from(ts.memory));
  if (compareMemoryLog) expect(memoryLog(wasm), `${label} memory log`).toEqual(memoryLog(ts));
  expect(ioLog(wasm), `${label} io log`).toEqual(ioLog(ts));
  expect(tbBlueLog(wasm), `${label} tbblue log`).toEqual(tbBlueLog(ts));
}

function runPair (
  program: number[],
  setup: (ts: TypeScriptMachine, wasm: WasmMachine) => void,
  label: string,
  mode = TypeScriptRunMode.UntilEnd,
  compareMemoryLog = false
): void {
  const ts = new TypeScriptMachine(mode, true);
  const wasm = new WasmMachine(mode, true);

  ts.initCode(program, 0x200, 0x200);
  wasm.initCode(program, 0x200, 0x200);
  setCommonState(ts, wasm);
  setup(ts, wasm);
  ts.run();
  wasm.run();
  expectMatch(ts, wasm, label, compareMemoryLog);
}

describe("Z80N WASM differential", () => {
  it("matches base Z80 instructions while in Z80N mode with frame-tact scaling", () => {
    runPair([
      0x3e, 0x11,       // LD A,11h
      0x06, 0x22,       // LD B,22h
      0x80,             // ADD A,B
      0xdd, 0x21, 0x34, 0x12, // LD IX,1234h
      0xfd, 0x7c        // LD A,IYH
    ], () => {}, "z80n base z80");
  });

  it("matches mixed Z80N ED operations, I/O streams, and TBBlue writes", () => {
    runPair([
      0xed, 0x23,       // SWAPNIB
      0xed, 0x24,       // MIRROR A
      0xed, 0x27, 0x0f, // TEST 0f
      0xed, 0x30,       // MUL D,E
      0xed, 0x34, 0x10, 0x00, // ADD HL,0010h
      0xed, 0x90,       // OUTINB
      0xed, 0x91, 0x13, 0xac, // NEXTREG 13,ac
      0xed, 0x92, 0x14, // NEXTREG 14,A
      0xed, 0x98        // JP (C)
    ], (ts, wasm) => {
      ts.cpu.a = wasm.cpu.a = 0x3c;
      ts.cpu.de = wasm.cpu.de = 0x0321;
      ts.cpu.hl = wasm.cpu.hl = 0x3000;
      ts.memory[0x3000] = wasm.memory[0x3000] = 0x29;
      ts.ioInputSequence.push(0x41);
      wasm.ioInputSequence.push(0x41);
    }, "z80n mixed ed");
  });

  it("matches Z80N block-repeat operations and prefix sequences", () => {
    runPair([
      0xed, 0xb4,       // LDIRX
      0xdd, 0xcb, 0x02, 0x06, // RLC (IX+2)
      0xfd, 0x86, 0xfe  // ADD A,(IY-2)
    ], (ts, wasm) => {
      ts.cpu.a = wasm.cpu.a = 0xa6;
      ts.cpu.bc = wasm.cpu.bc = 0x0002;
      ts.cpu.hl = wasm.cpu.hl = 0x3000;
      ts.cpu.de = wasm.cpu.de = 0x3100;
      ts.memory[0x3000] = wasm.memory[0x3000] = 0xa5;
      ts.memory[0x3001] = wasm.memory[0x3001] = 0xa6;
      ts.memory[0x4102] = wasm.memory[0x4102] = 0x81;
      ts.memory[0x41fe] = wasm.memory[0x41fe] = 0x22;
      ts.cpu.ix = wasm.cpu.ix = 0x4100;
      ts.cpu.iy = wasm.cpu.iy = 0x4200;
      ts.memory[0x41fe] = wasm.memory[0x41fe] = 0x11;
    }, "z80n repeat and prefix");
  });

  it("matches interrupt entry behavior in Z80N mode", () => {
    for (const signal of ["int", "nmi"] as const) {
      const ts = new TypeScriptMachine(TypeScriptRunMode.OneCycle, true);
      const wasm = new WasmMachine(WasmRunMode.OneCycle, true);

      ts.initCode([0x00], 0x500, 0x500);
      wasm.initCode([0x00], 0x500, 0x500);
      setCommonState(ts, wasm);
      ts.cpu.sp = wasm.cpu.sp = 0x9000;
      ts.cpu.interruptMode = wasm.cpu.interruptMode = 1;
      ts.cpu.iff1 = wasm.cpu.iff1 = true;
      if (signal === "int") ts.cpu.sigINT = wasm.cpu.sigINT = true;
      else ts.cpu.sigNMI = wasm.cpu.sigNMI = true;

      ts.run();
      wasm.run();
      expectMatch(ts, wasm, `z80n ${signal}`);
    }
  });
});
