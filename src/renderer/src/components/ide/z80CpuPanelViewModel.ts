import type { Z80CpuState } from "../../../../common/messaging/EmuApi";
import { toFlag, toHex8, toHex16 } from "./z80CpuPanelFormat";

export type Z80FlagView = {
  letter: string;
  active: boolean | undefined;
};

export type Z80RegisterRowView = {
  leftLabel: string;
  leftValue: string;
  rightLabel?: string;
  rightValue?: string;
};

export type Z80CpuPanelViewModel = {
  flags: Z80FlagView[];
  mainRegisters: Z80RegisterRowView[];
  memoryAndIo: Z80RegisterRowView[];
  interrupts: Z80RegisterRowView[];
};

const FLAG_BITS: Array<[string, number]> = [
  ["S", 7],
  ["Z", 6],
  ["5", 5],
  ["H", 4],
  ["3", 3],
  ["P", 2],
  ["N", 1],
  ["C", 0]
];

export const sampleZ80CpuState: Z80CpuState = {
  af: 0x01b5,
  bc: 0x0000,
  de: 0x0000,
  hl: 0x0000,
  ix: 0x0000,
  iy: 0x0000,
  pc: 0x0000,
  sp: 0xffff,
  af_: 0xffff,
  bc_: 0xffff,
  de_: 0xffff,
  hl_: 0xffff,
  i: 0x00,
  r: 0x00,
  wz: 0x0000,
  lastMemoryRead: 0x00,
  lastMemoryWrite: 0x00,
  lastIoRead: 0x00,
  lastIoWrite: 0x00,
  im: 0,
  snoozed: false,
  iff1: false,
  iff2: false,
  interruptBlocked: false,
  halted: false,
  tacts: 0,
  tactsInFrame: 0
};

export function createZ80CpuPanelViewModel(state: Z80CpuState): Z80CpuPanelViewModel {
  return {
    flags: FLAG_BITS.map(([letter, bitNo]) => ({
      letter,
      active: toFlag(state.af, bitNo)
    })),
    mainRegisters: [
      row("AF", toHex16(state.af), "AF'", toHex16(state.af_)),
      row("BC", toHex16(state.bc), "BC'", toHex16(state.bc_)),
      row("DE", toHex16(state.de), "DE'", toHex16(state.de_)),
      row("HL", toHex16(state.hl), "HL'", toHex16(state.hl_)),
      row("IX", toHex16(state.ix)),
      row("IY", toHex16(state.iy)),
      row("PC", toHex16(state.pc)),
      row("SP", toHex16(state.sp)),
      row("I", toHex8(state.i), "R", toHex8(state.r)),
      row("WZ", toHex16(state.wz))
    ],
    memoryAndIo: [
      row("LMR", toHex8(state.lastMemoryRead), "LMW", toHex8(state.lastMemoryWrite)),
      row("IRV", toHex8(state.lastIoRead), "IWV", toHex8(state.lastIoWrite))
    ],
    interrupts: [
      row("IM", state.im === undefined ? "-" : `${state.im}`, "SNZ", toBoolMark(state.snoozed)),
      row("IF1", toBoolMark(state.iff1), "IF2", toBoolMark(state.iff2)),
      row("INT", toBoolMark(state.interruptBlocked), "HLT", toBoolMark(state.halted)),
      row("CLK", state.tacts === undefined ? "-" : `${state.tacts}`),
      row("TSP", state.tactsInFrame === undefined ? "-" : `${state.tactsInFrame}`)
    ]
  };
}

export function toBoolMark(value: boolean | undefined): string {
  if (value === undefined) {
    return "-";
  }

  return value ? "●" : "○";
}

function row(
  leftLabel: string,
  leftValue: string,
  rightLabel?: string,
  rightValue?: string
): Z80RegisterRowView {
  return { leftLabel, leftValue, rightLabel, rightValue };
}
