/*
 * The Timex machines' 16-byte history context (`sp48HistoryContext` at the end of `sp48.c`, built
 * with `SP48_SCLD`; `.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` §3):
 *   0    port $F4 (bit n: chunk n is external)
 *   1    port $FF (bit 7: the external chunks are the EXROM bank's, not the DOCK's)
 *   2-3  the source of each 8K chunk, 2 bits each, chunk 0 in bits 0-1 of byte 2:
 *        0 HOME, 1 DOCK, 2 EXROM, 3 nothing behind it (reads $FF)
 *   4    the Timex model (0 TC2048, 1 TC2068, 2 TS2068)
 *
 * The partition numbering is `TimexWasmV2Machine`'s (`.plans/TIMEX_SCORPION_PLAN.md` Q5): HOME
 * H0 -1, H1 -2, H2-H7 2-7; DOCK D0-D7 8-15; EXROM X0-X7 -3 to -10. A chunk with nothing behind it
 * is named after the bank port $FF selects, as `getCurrentPartitions` names it (D4).
 */

export const TIMEX_CHUNK_HOME = 0;
export const TIMEX_CHUNK_DOCK = 1;
export const TIMEX_CHUNK_EXROM = 2;
export const TIMEX_CHUNK_NONE = 3;

const MODELS = ["TC2048", "TC2068", "TS2068"];
const SOURCES = ["HOME", "DOCK", "EXROM", "none"];

export type TimexHistoryContext = {
  portF4: number;
  portFf: number;
  /** The source of each 8K chunk (`TIMEX_CHUNK_*`) */
  chunkSources: number[];
  model: number;
};

export function decodeTimexContext(context: Uint8Array): TimexHistoryContext {
  return {
    portF4: context[0],
    portFf: context[1],
    chunkSources: Array.from({ length: 8 }, (_, chunk) => (context[2 + (chunk >> 2)] >> ((chunk & 3) * 2)) & 0x03),
    model: context[4]
  };
}

function partitionOf(chunk: number, source: number, exromBank: boolean): number {
  switch (source) {
    case TIMEX_CHUNK_HOME:
      return chunk < 2 ? -(chunk + 1) : chunk;
    case TIMEX_CHUNK_DOCK:
      return 8 + chunk;
    case TIMEX_CHUNK_EXROM:
      return -(3 + chunk);
    default:
      return exromBank ? -(3 + chunk) : 8 + chunk;
  }
}

export function timexPartitionFor(context: Uint8Array, address: number): number | undefined {
  const c = decodeTimexContext(context);
  const chunk = (address >>> 13) & 0x07;
  return partitionOf(chunk, c.chunkSources[chunk], (c.portFf & 0x80) !== 0);
}

export function describeTimexContext(context: Uint8Array, partitionLabels: Record<number, string> = {}): string {
  const c = decodeTimexContext(context);
  const exromBank = (c.portFf & 0x80) !== 0;
  const parts = [MODELS[c.model] ?? `model ${c.model}`];
  if (c.model !== 0) {
    const chunks = c.chunkSources.map((source, chunk) => {
      const partition = partitionOf(chunk, source, exromBank);
      return `${chunk}:${partitionLabels[partition] ?? SOURCES[source]}`;
    });
    parts.push(`Chunks ${chunks.join(" ")}`);
  }
  parts.push(`$F4=${hex2(c.portF4)} $FF=${hex2(c.portFf)}`);
  return parts.join(" · ");
}

function hex2(value: number): string {
  return `$${value.toString(16).toUpperCase().padStart(2, "0")}`;
}
