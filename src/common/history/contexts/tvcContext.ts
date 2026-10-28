/*
 * The Videoton TVC's 16-byte history context (`tvcHistoryContext` in `tvc.c`,
 * `.plans/VIDEOTON_TVC_PLAN.md` §13):
 *   0    bit 0 the 64K+; bit 1 the video bank the video circuit shows is not 0
 *   1    port 02h, the main paging register
 *   2    port 0Ch, the 64K+'s video paging register
 *
 * The partitions are the machine's (`TvcWasmV2Machine.getPartitionLabels`): U0-U3 are 0-3, the video
 * banks VID0-VID3 4-7, SYS -1, CART -2 and EXT -3 (the card window and EXTH).
 */

export type TvcHistoryContext = {
  plus: boolean;
  port02: number;
  port0c: number;
};

export function decodeTvcContext(context: Uint8Array): TvcHistoryContext {
  return { plus: (context[0] & 0x01) !== 0, port02: context[1], port0c: context[2] };
}

/** The partition the mapper (`tvc-memory.c`) showed at an address */
export function tvcPartitionFor(context: Uint8Array, address: number): number | undefined {
  const { plus, port02: m, port0c } = decodeTvcContext(context);
  const a = address & 0xffff;
  switch (a >> 14) {
    case 0:
      switch ((m >> 3) & 3) {
        case 0: return -1;
        case 1: return -2;
        case 2: return 0;
        default: return plus ? 3 : 0;
      }
    case 1:
      return plus && (m & 0x04) !== 0 ? 4 + (port0c & 3) : 1;
    case 2:
      return (m & 0x20) !== 0 ? 2 : 4 + (plus ? (port0c >> 2) & 3 : 0);
    default:
      switch ((m >> 6) & 3) {
        case 0: return -2;
        case 1: return -1;
        case 2: return 3;
        default: return -3;
      }
  }
}

function hex2(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

export function describeTvcContext(context: Uint8Array, partitionLabels?: Record<number, string>): string {
  const c = decodeTvcContext(context);
  const label = (address: number) => {
    const p = tvcPartitionFor(context, address);
    return p === undefined ? "?" : (partitionLabels?.[p] ?? String(p));
  };
  const pages = [0x0000, 0x4000, 0x8000, 0xc000].map(label).join(" ");
  const ports = c.plus ? `P02 ${hex2(c.port02)}h P0C ${hex2(c.port0c)}h` : `P02 ${hex2(c.port02)}h`;
  return `TVC ${c.plus ? "64K+" : "64K"} ${ports} [${pages}]`;
}
