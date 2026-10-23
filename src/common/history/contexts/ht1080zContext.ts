/*
 * The HT-1080Z's 16-byte history context (`htHistoryContext` in `ht1080z.c`,
 * `.plans/HT1080Z_PLAN.md` §11):
 *   0    bits 0-1 the model (0 Series I, 1 Series II, 2 the /64), bit 4 48K of RAM (else 16K)
 * There is no banking: no address is in a partition.
 */

const MODELS = ["Series I", "Series II", "/64", "?"];

export type Ht1080zHistoryContext = {
  model: string;
  ram: string;
};

export function decodeHt1080zContext(context: Uint8Array): Ht1080zHistoryContext {
  return {
    model: MODELS[context[0] & 0x03],
    ram: (context[0] & 0x10) !== 0 ? "48K" : "16K"
  };
}

export function ht1080zPartitionFor(_context: Uint8Array, _address: number): number | undefined {
  return undefined;
}

export function describeHt1080zContext(context: Uint8Array): string {
  const c = decodeHt1080zContext(context);
  return `HT-1080Z ${c.model} ${c.ram}`;
}
