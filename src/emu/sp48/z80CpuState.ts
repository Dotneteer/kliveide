import type { Z80CpuState } from "../../common/messaging/EmuApi";
import type { Sp48BusAccess, Sp48CpuState } from "./WasmZxSpectrum48Machine";

export type Sp48CpuStateProvider = {
  getCpuState(): Sp48CpuState;
  getLastMemoryAccess(): Sp48BusAccess;
  getLastPortAccess(): Sp48BusAccess;
};

export function mapSp48ControllerToZ80CpuState(
  controller: Sp48CpuStateProvider
): Z80CpuState {
  const cpu = controller.getCpuState();
  const memory = controller.getLastMemoryAccess();
  const port = controller.getLastPortAccess();

  return {
    af: cpu.af,
    bc: cpu.bc,
    de: cpu.de,
    hl: cpu.hl,
    ix: cpu.ix,
    iy: cpu.iy,
    pc: cpu.pc,
    sp: cpu.sp,
    af_: cpu.afAlt,
    bc_: cpu.bcAlt,
    de_: cpu.deAlt,
    hl_: cpu.hlAlt,
    i: (cpu.ir >> 8) & 0xff,
    r: cpu.ir & 0xff,
    wz: cpu.wz,
    lastMemoryRead: memory.isWrite ? undefined : memory.value,
    lastMemoryWrite: memory.isWrite ? memory.value : undefined,
    lastIoRead: port.isWrite ? undefined : port.value,
    lastIoWrite: port.isWrite ? port.value : undefined,
    im: cpu.interruptMode,
    iff1: cpu.iff1,
    halted: cpu.halted,
    tacts: cpu.tacts
  };
}
