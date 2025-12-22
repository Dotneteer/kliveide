import type { IZ80NCpu } from "@emu/abstractions/IZ80NCpu";

import { Z80Cpu, Z80Operation, parityTable, sz53Table, sz53pvTable } from "./Z80Cpu";
import { FlagsSetMask } from "@emu/abstractions/FlagSetMask";

export class Z80NCpu extends Z80Cpu implements IZ80NCpu {
  // --- Number of tacts in the current frame with 28MHz clock
  protected tactsInFrame28 = 0;

  readonly mergedOps: Z80Operation[];
  
  constructor() {
    super();
    this.mergedOps = [...super.getExtendedOpsTable()];
    Object.keys(z80NExtendedOps).forEach((key) => {
      const numKey = parseInt(key, 10);
      this.mergedOps[numKey] = z80NExtendedOps[numKey];
    });
  }

  /**
   * Override this method in derived classes to refine extended operations
   */
  getExtendedOpsTable(): Z80Operation[] {
    return this.mergedOps;
  }

  /**
   * Sets a TBBlue register value
   * @param _address Register address
   * @param _value Register value;
   */
  tbblueOut(_address: number, _value: number): void {
    // --- Override this method in derived classes
    this.tactPlusN(6);
  }

  /**
   * This method increments the current CPU tacts by N.
   * @param n Number of tact increments
   */
  tactPlusN(n: number): void {
    this.tacts += n;
    this.frameTacts += 2 * n / this.clockMultiplier;
    if (this.frameTacts >= this.tactsInFrame) {
      this.frames++;
      this.frameTacts -= this.tactsInFrame;
      this.frameCompleted = true;
    }
    this.currentFrameTact = Math.floor(this.frameTacts);
    this.onTactIncremented();
  }
}

/**
 * The jump table for extended instructions
 */
const z80NExtendedOps: Record<number, Z80Operation> = {
  0x23: swapnib,
  0x24: mirrorA,
  0x27: testN,
  0x28: bsla,
  0x29: bsra,
  0x2a: bsrl,
  0x2b: bsrf,
  0x2c: brlc,
  0x30: mulDE,
  0x31: addHLA,
  0x32: addDEA,
  0x33: addBCA,
  0x34: addHLNN,
  0x35: addDENN,
  0x36: addBCNN,
  0x8a: pushNN,
  0x90: outinb,
  0x91: nextregn,
  0x92: nextrega,
  0x93: pixeldn,
  0x94: pixelad,
  0x95: setae,
  0x98: jpc,
  0xa4: ldix,
  0xa5: ldws,
  0xac: lddx,
  0xb4: ldirx,
  0xb7: ldpirx,
  0xbc: lddrx
};

// 0x23: SWAPNIB
function swapnib(cpu: Z80NCpu) {
  const nLow = cpu.a & 0x0f;
  const nHigh = cpu.a & 0xf0;
  cpu.a = (nLow << 4) | (nHigh >>> 4);
}

// 0x24: MIRROR A
function mirrorA(cpu: Z80NCpu) {
  let oldA = cpu.a;
  let newA = 0x00;
  cpu: Z80NCpu;
  for (let i = 0; i < 8; i++) {
    newA = newA >> 1;
    if (oldA & 0x80) {
      newA = newA | 0x80;
    }
    oldA = oldA << 1;
  }
  cpu.a = newA;
}

// 0x27: TEST A
function testN(cpu: Z80NCpu) {
  const value = cpu.fetchCodeByte();
  const temp = cpu.a & value;
  cpu.f = FlagsSetMask.H | sz53pvTable[temp];
}

// 0x28: BSLA DE,B
function bsla(cpu: Z80NCpu) {
  const shAmount = cpu.b & 0x1f;
  if (!shAmount) return;
  if (shAmount >= 0x10) {
    cpu.de = 0;
  } else {
    cpu.de <<= shAmount;
  }
}

// 0x29: BSRA DE,B
function bsra(cpu: Z80NCpu) {
  const shAmount = cpu.b & 0x1f;
  const isDeNeg = (1 << 15) & cpu.de; // extract top bit
  if (!shAmount) return;
  if (shAmount >= 15) {
    cpu.de = isDeNeg ? 0xffff : 0x0000;
  } else {
    let de_bottom_part = cpu.de >> shAmount;
    let de_upper_part = 0; // 0 for positive/zero values
    if (isDeNeg) {
      // negative values have to fill vacant top bits with ones
      de_upper_part = 0xffff << (15 - shAmount);
    }
    cpu.de = de_upper_part | de_bottom_part;
  }
}

// 0x2A: BSRL DE,B
function bsrl(cpu: Z80NCpu) {
  const shAmount = cpu.b & 31;
  if (!shAmount) return;
  if (shAmount >= 16) {
    cpu.de = 0;
  } else {
    cpu.de >>>= shAmount;
  }
}

// 0x2B: BSRF DE,B
function bsrf(cpu: Z80NCpu) {
  const shAmount = cpu.b & 31;
  if (!shAmount) return;
  if (shAmount >= 16) {
    cpu.de = 0xffff;
  } else {
    const deBottom = cpu.de >> shAmount;
    const deUpper = 0xffff << (16 - shAmount);
    cpu.de = deUpper | deBottom;
  }
}

// 0x2C: BRLC DE,B
function brlc(cpu: Z80NCpu) {
  const rolls = cpu.b & 15;
  if (0 < rolls) {
    const deUpper = cpu.de << rolls;
    const deBottom = cpu.de >> (16 - rolls);
    cpu.de = deUpper | deBottom;
  }
}

// 0x30: MUL D,E
function mulDE(cpu: Z80NCpu) {
  cpu.de = cpu.d * cpu.e;
}

// 0x31: ADD HL,A
function addHLA(cpu: Z80NCpu) {
  cpu.hl = cpu.hl + cpu.a;
}

// 0x32: ADD DE,A
function addDEA(cpu: Z80NCpu) {
  cpu.de = cpu.de + cpu.a;
}

// 0x33: ADD BC,A
function addBCA(cpu: Z80NCpu) {
  cpu.bc = cpu.bc + cpu.a;
}

// 0x34: ADD HL,NNNN
function addHLNN(cpu: Z80NCpu) {
  let opVal = cpu.fetchCodeByte() + (cpu.fetchCodeByte() << 8);
  cpu.hl += opVal;
  cpu.tactPlusN(2);
}

// 0x35: ADD DE,NNNN
function addDENN(cpu: Z80NCpu) {
  let opVal = cpu.fetchCodeByte() + (cpu.fetchCodeByte() << 8);
  cpu.de += opVal;
  cpu.tactPlusN(2);
}

// 0x36: ADD BC,NNNN
function addBCNN(cpu: Z80NCpu) {
  let opVal = cpu.fetchCodeByte() + (cpu.fetchCodeByte() << 8);
  cpu.bc += opVal;
  cpu.tactPlusN(2);
}

// 0x8a: PUSH NNNN
function pushNN(cpu: Z80NCpu) {
  cpu.sp--;
  cpu.writeMemory(cpu.sp, cpu.fetchCodeByte());
  cpu.sp--;
  cpu.writeMemory(cpu.sp, cpu.fetchCodeByte());
  cpu.tactPlus3();
}

// 0x90: OUTINB
function outinb(cpu: Z80NCpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  const tmp = cpu.readMemory(cpu.hl);
  cpu.wz = cpu.bc + 1;
  cpu.writePort(cpu.bc, tmp);
  cpu.hl++;
  const tmp2 = (tmp + cpu.l) & 0xff;
  cpu.f =
    ((tmp & 0x80) !== 0 ? FlagsSetMask.N : 0) |
    (tmp2 < tmp ? FlagsSetMask.H | FlagsSetMask.C : 0) |
    (parityTable[(tmp2 & 0x07) ^ cpu.b] !== 0 ? FlagsSetMask.PV : 0) |
    sz53Table[cpu.b];
}

// 0x91: NEXTREG NN,NN
function nextregn(cpu: Z80NCpu) {
  const register = cpu.fetchCodeByte();
  const value = cpu.fetchCodeByte();
  cpu.tbblueOut(register, value);
}

// 0x92: NEXTREG NN,A
function nextrega(cpu: Z80NCpu) {
  const register = cpu.fetchCodeByte();
  cpu.tbblueOut(register, cpu.a);
}

// 0x93: PIXELDN
function pixeldn(cpu: Z80NCpu) {
  const hl = cpu.hl;
  if ((hl & 0x0700) !== 0x0700) {
    cpu.h++;
  } else if ((hl & 0xe0) !== 0xe0) {
    cpu.hl = (hl & 0xf8ff) + 0x20;
  } else cpu.hl = (hl & 0xf81f) + 0x0800;
}

// 0x94: PIXELAD
function pixelad(cpu: Z80NCpu) {
  cpu.hl =
    0x4000 + ((cpu.d & 0xc0) << 5) + ((cpu.d & 0x07) << 8) + ((cpu.d & 0x38) << 2) + (cpu.e >> 3);
}

// 0x95: SETAE
function setae(cpu: Z80NCpu) {
  cpu.a = 0x80 >> (cpu.e & 7);
}

// 0x98: JP (C)
function jpc(cpu: Z80NCpu) {
  cpu.pc = cpu.wz = (cpu.pc & 0xc000) | (cpu.readPort(cpu.bc) << 6);
  cpu.tactPlusN(1);
}

// 0xA4: LDIX
function ldix(cpu: Z80NCpu) {
  let tmp = cpu.readMemory(cpu.hl);
  if (tmp !== cpu.a) {
    cpu.writeMemory(cpu.de, tmp);
  } else {
    cpu.tactPlus3();
  }
  cpu.tactPlus2WithAddress(cpu.de);
  cpu.bc--;
  cpu.de++;
  cpu.hl++;
}

// 0xA5: LDWS
function ldws(cpu: Z80NCpu) {
  const tmp = cpu.readMemory(cpu.hl);
  cpu.writeMemory(cpu.de, tmp);
  cpu.l++;
  cpu.d++;
}

// 0xAC: LDDX
function lddx(cpu: Z80NCpu) {
  let tmp = cpu.readMemory(cpu.hl);
  if (tmp !== cpu.a) {
    cpu.writeMemory(cpu.de, tmp);
  } else {
    cpu.tactPlus3();
  }
  cpu.tactPlus2WithAddress(cpu.de);
  cpu.bc--;
  cpu.de++;
  cpu.hl--;
}

// 0xB4: LDIRX
function ldirx(cpu: Z80NCpu) {
  let tmp = cpu.readMemory(cpu.hl);
  if (tmp !== cpu.a) {
    cpu.writeMemory(cpu.de, tmp);
  } else {
    cpu.tactPlus3();
  }
  cpu.tactPlus2WithAddress(cpu.de);
  cpu.bc--;
  if (cpu.bc) {
    cpu.tactPlus5WithAddress(cpu.de);
    cpu.pc -= 2;
  }
  cpu.de++;
  cpu.hl++;
}

// 0xB7: LDPIRX
function ldpirx(cpu: Z80NCpu) {
  const source_adr = (cpu.hl & ~0x07) | (cpu.e & 7);

  if (cpu.b || cpu.c !== 1) cpu.wz = cpu.pc;

  const tmp = cpu.readMemory(source_adr);
  if (tmp !== cpu.a) {
    cpu.writeMemory(cpu.de, tmp);
  } else {
    cpu.tactPlus3();
  }

  cpu.tactPlus2WithAddress(cpu.de);
  cpu.bc--;
  if (cpu.bc) {
    cpu.tactPlus5WithAddress(cpu.de);
    cpu.pc -= 2;
  }
  cpu.de++;
}

// 0xBC: LDDRX
function lddrx(cpu: Z80NCpu) {
  let tmp = cpu.readMemory(cpu.hl);
  if (tmp !== cpu.a) {
    cpu.writeMemory(cpu.de, tmp);
  } else {
    cpu.tactPlus3();
  }
  cpu.tactPlus2WithAddress(cpu.de);
  cpu.bc--;
  if (cpu.bc) {
    cpu.tactPlus5WithAddress(cpu.de);
    cpu.pc -= 2;
  }
  cpu.de++;
  cpu.hl--;
}
