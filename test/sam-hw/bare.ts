import { createSamSession, type SamTestSession } from "../harness/samcoupe";

/*
 * A bare SAM for the hardware tests: powered on, no ROM boot. The CPU runs from RAM page `codePage`
 * mapped into section A (LMPR = RAM0 | page), interrupts off; the test places the code and the frame
 * position. Assemble-free: the tests write opcodes as bytes.
 */

export type BareOptions = {
  model?: string;
  extmem?: boolean;
  /** The page the code runs in (section A at 0000h; default 4) */
  codePage?: number;
};

export async function createBareSam(options: BareOptions = {}): Promise<SamTestSession> {
  const s = await createSamSession({ model: options.model, extmem: options.extmem });
  const page = options.codePage ?? 4;
  s.wasm.samHardReset();
  // --- RAM0: page `page` in section A, page + 1 in B; ROM1 off; C/D pages 0 and 1
  s.out(0x00fa, 0x20 | page);
  s.out(0x00fb, 0x00);
  s.wasm.samSetCpuIff1(0);
  s.wasm.samSetCpuIff2(0);
  s.wasm.samSetCpuSp(0x7ff0);
  s.wasm.samSetCpuPc(0x0000);
  return s;
}

/** Writes code at `address` of the CPU's view (through the current paging) */
export function loadCode(s: SamTestSession, address: number, bytes: number[]): void {
  s.poke(address, bytes);
}
