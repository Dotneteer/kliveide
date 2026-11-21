/*
 * The SAM Coupé's 16-byte history context (`samHistoryContext` in `sam.c`, `dev/plans/SAM_COUPE_PLAN.md`
 * §11):
 *   0  LMPR (FAh), 1 HMPR (FBh), 2 VMPR (FCh), 3 LEPR (80h), 4 HEPR (81h), as last written
 *   5  the internal pages fitted: 32 (512K) or 16 (256K)
 *
 * The partitions are the machine's (`samMachineInfo.ts`, `SamWasmV2Machine.getPartitionLabels`): internal
 * pages 0-31 by their number, ROM0 40h, ROM1 41h, external pages from 80h. The map follows `sam-memory.c`:
 *   A (0000h)  ROM0, or with LMPR bit 5 page LMPR[4:0]
 *   B (4000h)  page LMPR + 1
 *   C (8000h)  page HMPR[4:0], or with HMPR bit 7 the external page LEPR
 *   D (C000h)  page HMPR + 1, or ROM1 with LMPR bit 6; with HMPR bit 7 the external page HEPR
 */

/** The partitions of the ROMs and the first external page (`samMachineInfo.ts`) */
const ROM0 = 0x40;
const ROM1 = 0x41;
const EXT = 0x80;
/** External pages in the one pack the core fits */
const EXT_PAGES = 64;

export type SamHistoryContext = {
  lmpr: number;
  hmpr: number;
  vmpr: number;
  lepr: number;
  hepr: number;
  /** Internal 16K pages fitted: 32 or 16 */
  ramPages: number;
};

export function decodeSamContext(context: Uint8Array): SamHistoryContext {
  return {
    lmpr: context[0],
    hmpr: context[1],
    vmpr: context[2],
    lepr: context[3],
    hepr: context[4],
    ramPages: context[5]
  };
}

function external(reg: number): number | undefined {
  return reg < EXT_PAGES ? EXT + reg : undefined;
}

/** The partition an address was in when the record was made */
export function samPartitionFor(context: Uint8Array, address: number): number | undefined {
  const c = decodeSamContext(context);
  const ext = (c.hmpr & 0x80) !== 0;
  switch (((address & 0xffff) >> 14) & 3) {
    case 0:
      return c.lmpr & 0x20 ? c.lmpr & 0x1f : ROM0;
    case 1:
      return (c.lmpr + 1) & 0x1f;
    case 2:
      return ext ? external(c.lepr) : c.hmpr & 0x1f;
    default:
      if (ext) return external(c.hepr);
      return c.lmpr & 0x40 ? ROM1 : (c.hmpr + 1) & 0x1f;
  }
}

function hex2(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

export function describeSamContext(context: Uint8Array, partitionLabels?: Record<number, string>): string {
  const c = decodeSamContext(context);
  const sections = [0x0000, 0x4000, 0x8000, 0xc000].map((address) => {
    const partition = samPartitionFor(context, address);
    return partition === undefined ? "--" : (partitionLabels?.[partition] ?? hex2(partition));
  });
  const model = c.ramPages === 16 ? "256K" : "512K";
  return `SAM Coupé ${model} LMPR ${hex2(c.lmpr)}h HMPR ${hex2(c.hmpr)}h VMPR ${hex2(c.vmpr)}h [${sections.join(" ")}]`;
}
