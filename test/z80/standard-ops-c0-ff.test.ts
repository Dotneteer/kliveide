import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { CpuApi } from "../../src/native/api";
import { TestZ80Machine } from "../../src/native/TestZ80Machine";
import { FlagsSetMask } from "../../src/native/cpu-helpers";
import { RunMode } from "../../src/native/RunMode";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: CpuApi;
let testMachine: TestZ80Machine;

describe("Standard ops c0-ff", () => {
  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, {
        imports: { trace: (arg: number) => console.log(arg) }
    });
    api = (wasm.instance.exports as unknown) as CpuApi;
    testMachine = new TestZ80Machine(api);
  });

  beforeEach(() => {
    testMachine.reset();
  });


  it("c0: ret nz #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0xb7, // OR A
        0xc0, // RET NZ
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x16);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(43);
  });

  it("c0: ret nz #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x00, // LD A,#00
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0xb7, // OR A
        0xc0, // RET NZ
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x24);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(54);
  });

  it("c1: pop bc", () => {
    let s = testMachine.initCode([
      0xe5, // PUSH HL
      0xc1, // POP BC
    ]);
    s.hl = 0x2352;
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.bc).toBe(0x2352);
    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(21);
  });

  it("c2: jp nz #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xb7, // OR A
        0xc2,
        0x07,
        0x00, // JP NZ,#0007
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0xaa);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0009);
    expect(s.tacts).toBe(32);
  });

  it("c2: jp nz #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x00, // LD A,#00
        0xb7, // OR A
        0xc2,
        0x07,
        0x00, // JP NZ,#0007
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0x00);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(25);
  });

  it("c3: jp", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xc3,
        0x06,
        0x00, // JP #0006
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0xaa);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0008);
    expect(s.tacts).toBe(28);
  });

  it("c4: call nz #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xb7, // OR A
        0xc4,
        0x07,
        0x00, // CALL NZ,#0007
        0x76, // HALT
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x24);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("fffe-ffff");

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(49);
  });

  it("c4: call nz #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x00, // LD A,#00
        0xb7, // OR A
        0xc4,
        0x07,
        0x00, // CALL NZ,#0007
        0x76, // HALT
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x00);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("fffe-ffff");

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(25);
  });

  it("c5: push bc", () => {
    let s = testMachine.initCode([
      0xc5, // PUSH BC
      0xe1, // POP HL
    ]);
    s.bc = 0x2352;
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.hl).toBe(0x2352);
    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(21);
  });

  it("c6: add a,N", () => {
    let s = testMachine.initCode([
      0xc6,
      0x24, // ADD A,#24
    ]);
    s.a = 0x12;
    s = testMachine.run(s);
    expect(s.a).toBe(0x36);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("");
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("c7: rst 00", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x12, // LD A,#12
        0xc7, // RST #00
      ],
      RunMode.OneInstruction
    );
    s.sp = 0x0000;
    testMachine.run(s);
    s = testMachine.run();
    const m = testMachine.memory;

    expect(s.a).toBe(0x12);
    expect(s.sp).toBe(0xfffe);
    expect(s.pc).toBe(0x0000);
    expect(m[0xfffe]).toBe(0x03);
    expect(m[0xffff]).toBe(0x00);
    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory("FFFE-FFFF");
    expect(s.tacts).toBe(18);
  });

  it("c8: ret z #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0xaf, // XOR A
        0xc8, // RET Z
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x00);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(43);
  });

  it("c8: ret z #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0xb7, // OR A
        0xc8, // RET Z
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x24);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(54);
  });

  it("c9: ret", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(38);
  });

  it("ca: jp z #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xaf, // XOR A
        0xca,
        0x07,
        0x00, // JP Z,#0007
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0xaa);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0009);
    expect(s.tacts).toBe(32);
  });

  it("ca: jp z #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xb7, // OR A
        0xca,
        0x07,
        0x00, // JP Z,#0007
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0x16);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(25);
  });

  it("cc: call z #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xaf, // XOR A
        0xcc,
        0x07,
        0x00, // CALL Z,#0007
        0x76, // HALT
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x24);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("fffe-ffff");

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(49);
  });

  it("cc: call z #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xb7, // OR A
        0xcc,
        0x07,
        0x00, // CALL Z,#0007
        0x76, // HALT
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x16);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("fffe-ffff");

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(25);
  });

  it("cd: call NN", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0x3e,
        0xa3, // LD A,#A3
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.a).toBe(0xa3);
    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(45);
  });

  it("ce: adc a,N #1", () => {
    let s = testMachine.initCode([
      0xce,
      0x24, // ADC A,#24
    ]);
    s.a = 0x12;
    s.f |= FlagsSetMask.C;
    s = testMachine.run(s);
    expect(s.a).toBe(0x37);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("");
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("ce: adc a,N #2", () => {
    let s = testMachine.initCode([
      0xce,
      0x24, // ADC A,#24
    ]);
    s.a = 0x12;
    s.f &= 0xfe;
    s = testMachine.run(s);
    expect(s.a).toBe(0x36);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("");
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("cf: rst 08", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x12, // LD A,#12
        0xcf, // RST #08
      ],
      RunMode.OneInstruction
    );
    s.sp = 0x0000;
    testMachine.run(s);
    s = testMachine.run();
    const m = testMachine.memory;

    expect(s.a).toBe(0x12);
    expect(s.sp).toBe(0xfffe);
    expect(s.pc).toBe(0x0008);
    expect(m[0xfffe]).toBe(0x03);
    expect(m[0xffff]).toBe(0x00);
    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory("FFFE-FFFF");
    expect(s.tacts).toBe(18);
  });

  it("d0: ret nc #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0xa7, // AND A
        0xd0, // RET NC
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x16);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(43);
  });

  it("d0: ret nc #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0x37, // SCF
        0xd0, // RET NC
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x24);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(54);
  });

  it("d1: pop de", () => {
    let s = testMachine.initCode([
      0xe5, // PUSH HL
      0xd1, // POP DE
    ]);
    s.hl = 0x2352;
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.de).toBe(0x2352);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(21);
  });

  it("d2: jp nc #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xa7, // AND A
        0xd2,
        0x07,
        0x00, // JP NC,#0007
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0xaa);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0009);
    expect(s.tacts).toBe(32);
  });

  it("d2: jp nc #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0x37, // SCF
        0xd2,
        0x07,
        0x00, // JP NC,#0007
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0x16);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(25);
  });

  it("d3: out (N),a", () => {
    let s = testMachine.initCode([
      0xd3,
      0x28, // OUT (#28),A
    ]);
    s.a = 0x16;
    s = testMachine.run(s);
    const log = testMachine.ioAccessLog;

    expect(log.length).toBe(1);
    expect(log[0].address).toBe(0x1628);
    expect(log[0].value).toBe(0x16);
    expect(log[0].isOutput).toBe(true);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(11);
  });

  it("d4: call nc #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xa7, // AND A
        0xd4,
        0x07,
        0x00, // CALL NC,#0007
        0x76, // HALT
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x24);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("fffe-ffff");

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(49);
  });

  it("d4: call nc #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0x37, // SCF
        0xd4,
        0x07,
        0x00, // CALL NC,#0007
        0x76, // HALT
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x16);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("fffe-ffff");

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(25);
  });

  it("d5: push de", () => {
    let s = testMachine.initCode([
      0xd5, // PUSH DE
      0xe1, // POP HL
    ]);
    s.de = 0x2352;
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.hl).toBe(0x2352);
    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(21);
  });

  it("d6: sub N", () => {
    let s = testMachine.initCode([
      0xd6,
      0x24, // SUB #24
    ]);
    s.a = 0x36;
    s.f |= FlagsSetMask.C;
    s = testMachine.run(s);
    expect(s.a).toBe(0x12);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("");
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("d7: rst 10", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x12, // LD A,#12
        0xd7, // RST #10
      ],
      RunMode.OneInstruction
    );
    s.sp = 0x0000;
    testMachine.run(s);
    s = testMachine.run();
    const m = testMachine.memory;

    expect(s.a).toBe(0x12);
    expect(s.sp).toBe(0xfffe);
    expect(s.pc).toBe(0x0010);
    expect(m[0xfffe]).toBe(0x03);
    expect(m[0xffff]).toBe(0x00);
    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory("FFFE-FFFF");
    expect(s.tacts).toBe(18);
  });

  it("d8: ret c #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0x37, // SCF
        0xd8, // RET C
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x16);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(43);
  });

  it("d8: ret c #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0xb7, // OR A
        0xd8, // RET C
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x24);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(54);
  });

  it("d9: exx", () => {
    let s = testMachine.initCode([
      0xd9, // EXX
    ]);
    s.bc = 0xabcd;
    s._bc_ = 0x2345;
    s.de = 0xbcde;
    s._de_ = 0x3456;
    s.hl = 0xcdef;
    s._hl_ = 0x4567;
    s = testMachine.run(s);

    expect(s.bc).toBe(0x2345);
    expect(s._bc_).toBe(0xabcd);
    expect(s.de).toBe(0x3456);
    expect(s._de_).toBe(0xbcde);
    expect(s.hl).toBe(0x4567);
    expect(s._hl_).toBe(0xcdef);
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("da: jp c #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0x37, // SCF
        0xda,
        0x07,
        0x00, // JP C,#0007
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0xaa);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0009);
    expect(s.tacts).toBe(32);
  });

  it("da: jp c #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xb7, // OR A
        0xda,
        0x07,
        0x00, // JP C,#0007
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0x16);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(25);
  });

  it("db: in a,(N)", () => {
    let s = testMachine.initCode([
      0xdb,
      0x34, // IN A,(#34)
    ]);
    s.a = 0x16;
    testMachine.initInput([0xd5]);
    s = testMachine.run(s);
    const log = testMachine.ioAccessLog;
    expect(s.a).toBe(0xd5);
    expect(log.length).toBe(1);
    expect(log[0].address).toBe(0x1634);
    expect(log[0].value).toBe(0xd5);
    expect(log[0].isOutput).toBe(false);
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(11);
  });

  it("dc: call c #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0x37, // SCF
        0xdc,
        0x07,
        0x00, // CALL C,#0007
        0x76, // HALT
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x24);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("fffe-ffff");

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(49);
  });

  it("dc: call c #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x16, // LD A,#16
        0xb7, // OR A
        0xdc,
        0x07,
        0x00, // CALL C,#0007
        0x76, // HALT
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x16);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("fffe-ffff");

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(25);
  });

  it("de: sbc a,N #1", () => {
    let s = testMachine.initCode([
      0xde,
      0x24, // SBC #24
    ]);
    s.a = 0x36;
    s.f |= FlagsSetMask.C;
    s = testMachine.run(s);
    expect(s.a).toBe(0x11);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("");
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("de: sbc a,N #2", () => {
    let s = testMachine.initCode([
      0xde,
      0x24, // SBC #24
    ]);
    s.a = 0x36;
    s.f &= 0xfe;
    s = testMachine.run(s);
    expect(s.a).toBe(0x12);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("");
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("df: rst 18", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x12, // LD A,#12
        0xdf, // RST #18
      ],
      RunMode.OneInstruction
    );
    s.sp = 0x0000;
    testMachine.run(s);
    s = testMachine.run();
    const m = testMachine.memory;

    expect(s.a).toBe(0x12);
    expect(s.sp).toBe(0xfffe);
    expect(s.pc).toBe(0x0018);
    expect(m[0xfffe]).toBe(0x03);
    expect(m[0xffff]).toBe(0x00);
    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory("FFFE-FFFF");
    expect(s.tacts).toBe(18);
  });

  it("e0: ret po #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x2a, // LD A,#2A
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0x87, // ADD A
        0xe0, // RET PO
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x54);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(43);
  });

  it("e0: ret po #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x88, // LD A,#88
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0x87, // ADD A
        0xe0, // RET PO
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x24);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(54);
  });

  it("e1: pop hl", () => {
    let s = testMachine.initCode([
      0xc5, // PUSH BC
      0xe1, // POP HL
    ]);
    s.bc = 0x2352;
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.hl).toBe(0x2352);
    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(21);
  });

  it("e2: jp po #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x2a, // LD A,#2A
        0x87, // ADD A
        0xe2,
        0x07,
        0x00, // JP PO,#0007
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0xaa);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0009);
    expect(s.tacts).toBe(32);
  });

  it("e2: jp po #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x88, // LD A,#88
        0x87, // ADD A
        0xe2,
        0x07,
        0x00, // JP PO,#0007
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0x10);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(25);
  });

  it("e4: call po #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x2a, // LD A,#2A
        0x87, // ADD A
        0xe4,
        0x07,
        0x00, // CALL PO,#0007
        0x76, // HALT
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x24);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("fffe-ffff");

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(49);
  });

  it("e3: ex (sp),hl", () => {
    let s = testMachine.initCode([
      0xe3, //EX (SP),HL
    ]);
    s.sp = 0x1000;
    s.hl = 0x1234;
    let m = testMachine.memory;
    m[0x1000] = 0x78;
    m[0x1001] = 0x56;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.hl).toBe(0x5678);
    expect(m[0x1000]).toBe(0x34);
    expect(m[0x1001]).toBe(0x12);
    testMachine.shouldKeepRegisters("SP, HL");
    testMachine.shouldKeepMemory("1000-1001");

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(19);
  });

  it("e4: call po #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x88, // LD A,#88
        0x87, // ADD A
        0xe4,
        0x07,
        0x00, // CALL PO,#0007
        0x76, // HALT
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x10);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("fffe-ffff");

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(25);
  });

  it("e5: push hl", () => {
    let s = testMachine.initCode([
      0xe5, // PUSH HL
      0xd1, // POP DE
    ]);
    s.hl = 0x2352;
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.de).toBe(0x2352);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(21);
  });

  it("e6: and N", () => {
    let s = testMachine.initCode([
      0xe6,
      0x23, // AND #23
    ]);
    s.a = 0x12;
    s.f |= FlagsSetMask.C;
    s = testMachine.run(s);
    expect(s.a).toBe(0x02);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("");
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("e7: rst 20", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x12, // LD A,#12
        0xe7, // RST #20
      ],
      RunMode.OneInstruction
    );
    s.sp = 0x0000;
    testMachine.run(s);
    s = testMachine.run();
    const m = testMachine.memory;

    expect(s.a).toBe(0x12);
    expect(s.sp).toBe(0xfffe);
    expect(s.pc).toBe(0x0020);
    expect(m[0xfffe]).toBe(0x03);
    expect(m[0xffff]).toBe(0x00);
    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory("FFFE-FFFF");
    expect(s.tacts).toBe(18);
  });

  it("e8: ret pe #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x88, // LD A,#88
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0x87, // ADD A
        0xe8, // RET PE
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x10);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(43);
  });

  it("e8: ret pe #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x2a, // LD A,#2A
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0x87, // ADD A
        0xe8, // RET PE
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x24);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(54);
  });

  it("e9: jp (hl)", () => {
    let s = testMachine.initCode([
      0xe9, // JP (HL)
    ]);
    s.hl = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x1000);
    expect(s.tacts).toBe(4);
  });

  it("ea: jp pe #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x03, // LD A,#03
        0xa7, // AND A
        0xea,
        0x07,
        0x00, // JP PE,#0007
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0xaa);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0009);
    expect(s.tacts).toBe(32);
  });

  it("ea: jp pe #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x10, // LD A,#10
        0xa7, // AND A
        0xea,
        0x07,
        0x00, // JP PE,#0007
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0x10);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(25);
  });

  it("eb: ex de,hl", () => {
    let s = testMachine.initCode([
      0xeb, // EX DE,HL
    ]);
    s.hl = 0x1234;
    s.de = 0x7856;
    s = testMachine.run(s);

    expect(s.de).toBe(0x1234);
    expect(s.hl).toBe(0x7856);
    testMachine.shouldKeepRegisters("HL, DE");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("ec: call pe #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x88, // LD A,#88
        0x87, // ADD A
        0xec,
        0x07,
        0x00, // CALL PE,#0007
        0x76, // HALT
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x24);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("fffe-ffff");

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(49);
  });

  it("ec: call pe #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x2a, // LD A,#2A
        0x87, // ADD A
        0xec,
        0x07,
        0x00, // CALL PE,#0007
        0x76, // HALT
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x54);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("fffe-ffff");

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(25);
  });

  it("ee: xor N", () => {
    let s = testMachine.initCode([
      0xee,
      0x23, // XOR #23
    ]);
    s.a = 0x12;
    s.f |= FlagsSetMask.C;
    s = testMachine.run(s);
    expect(s.a).toBe(0x31);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("");
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("ef: rst 28", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x12, // LD A,#12
        0xef, // RST #28
      ],
      RunMode.OneInstruction
    );
    s.sp = 0x0000;
    testMachine.run(s);
    s = testMachine.run();
    const m = testMachine.memory;

    expect(s.a).toBe(0x12);
    expect(s.sp).toBe(0xfffe);
    expect(s.pc).toBe(0x0028);
    expect(m[0xfffe]).toBe(0x03);
    expect(m[0xffff]).toBe(0x00);
    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory("FFFE-FFFF");
    expect(s.tacts).toBe(18);
  });

  it("f0: ret p #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x32, // LD A,#32
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0x87, // ADD A
        0xf0, // RET P
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x64);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(43);
  });

  it("f0: ret p #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0xc0, // LD A,#C0
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0x87, // ADD A
        0xf0, // RET P
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x24);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(54);
  });

  it("f1: pop af", () => {
    let s = testMachine.initCode([
      0xc5, // PUSH BC
      0xf1, // POP AF
    ]);
    s.bc = 0x2352;
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.af).toBe(0x2352);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(21);
  });

  it("f2: jp p #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x32, // LD A,#32
        0x87, // ADD A
        0xf2,
        0x07,
        0x00, // JP P,#0007
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0xaa);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0009);
    expect(s.tacts).toBe(32);
  });

  it("f2: jp p #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0xc0, // LD A,#C0
        0x87, // ADD A
        0xf2,
        0x07,
        0x00, // JP P,#0007
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0x80);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(25);
  });

  it("f3: di", () => {
    let s = testMachine.initCode([
      0xf3, // DI
    ]);
    s = testMachine.run();

    expect(s.iff1).toBeFalsy();
    expect(s.iff2).toBeFalsy();
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("f4: call p #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x32, // LD A,#32
        0x87, // ADD A
        0xf4,
        0x07,
        0x00, // CALL P,#0007
        0x76, // HALT
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x24);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("fffe-ffff");

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(49);
  });

  it("f4: call p #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0xc0, // LD A,#C0
        0x87, // ADD A
        0xf4,
        0x07,
        0x00, // CALL P,#000H
        0x76, // HALT
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x80);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("fffe-ffff");

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(25);
  });

  it("f5: push af", () => {
    let s = testMachine.initCode([
      0xf5, // PUSH AF
      0xd1, // POP DE
    ]);
    s.af = 0x2352;
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.de).toBe(0x2352);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(21);
  });

  it("f6: or N", () => {
    let s = testMachine.initCode([
      0xf6,
      0x23, // OR #23
    ]);
    s.a = 0x12;
    s.f |= FlagsSetMask.C;
    s = testMachine.run(s);
    expect(s.a).toBe(0x33);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("");
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("f8: ret m #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0xc0, // LD A,#C0
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0x87, // ADD A
        0xf8, // RET M
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x80);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(43);
  });

  it("f8: ret m #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x32, // LD A,#32
        0xcd,
        0x06,
        0x00, // CALL #0006
        0x76, // HALT
        0x87, // ADD A
        0xf8, // RET M
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x24);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("FFFE-FFFF");

    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(54);
  });

  it("f9: ld sp,hl", () => {
    let s = testMachine.initCode([
      0xf9, // LD SP,HL
    ]);
    s.hl = 0x1000;
    s = testMachine.run(s);

    expect(s.sp).toBe(0x1000);
    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });

  it("fa: jp m #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0xc0, // LD A,#C0
        0x87, // ADD A
        0xfa,
        0x07,
        0x00, // JP M,#0007
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0xaa);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0009);
    expect(s.tacts).toBe(32);
  });

  it("fa: jp m #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x32, // LD A,#32
        0x87, // ADD A
        0xfa,
        0x07,
        0x00, // JP M,#0007
        0x76, // HALT
        0x3e,
        0xaa, // LD A,#AA
        0x76, // HALT
      ],
      RunMode.UntilHalt
    );
    s = testMachine.run(s);
    expect(s.a).toBe(0x64);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(25);
  });

  it("fb: ei", () => {
    let s = testMachine.initCode([
      0xfb, // EI
    ]);
    s.hl = 0x1000;
    s = testMachine.run(s);

    expect(s.iff1).toBeTruthy();
    expect(s.iff2).toBeTruthy();
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("fc: call m #1", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0xc0, // LD A,#C0
        0x87, // ADD A
        0xfc,
        0x07,
        0x00, // CALL M,#0007
        0x76, // HALT
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x24);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("fffe-ffff");

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(49);
  });

  it("fc: call m #2", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x32, // LD A,#32
        0x87, // ADD A
        0xfc,
        0x07,
        0x00, // CALL M,#0007
        0x76, // HALT
        0x3e,
        0x24, // LD A,#24
        0xc9, // RET
      ],
      RunMode.UntilHalt
    );
    s.sp = 0x0000;
    s = testMachine.run(s);
    expect(s.a).toBe(0x64);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("fffe-ffff");

    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(25);
  });

  it("fe: cp N", () => {
    let s = testMachine.initCode([
      0xfe,
      0x24, // CP #24
    ]);
    s.a = 0x36;
    s.f |= FlagsSetMask.C;
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("");
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("ff: rst 38", () => {
    let s = testMachine.initCode(
      [
        0x3e,
        0x12, // LD A,#12
        0xff, // RST #38
      ],
      RunMode.OneInstruction
    );
    s.sp = 0x0000;
    testMachine.run(s);
    s = testMachine.run();
    const m = testMachine.memory;

    expect(s.a).toBe(0x12);
    expect(s.sp).toBe(0xfffe);
    expect(s.pc).toBe(0x0038);
    expect(m[0xfffe]).toBe(0x03);
    expect(m[0xffff]).toBe(0x00);
    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory("FFFE-FFFF");
    expect(s.tacts).toBe(18);
  });
});
