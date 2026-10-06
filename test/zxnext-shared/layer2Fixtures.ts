import type { Layer2Regs } from "@common/zxnext/layer2/layer2Decode";

/** Layer 2 registers at their reset values, Layer 2 on, overridden by `patch`. */
export function l2regs(patch: Partial<Layer2Regs> = {}): Layer2Regs {
  return {
    enabled: true,
    activeBank: 8,
    shadowBank: 11,
    port123B: 0x02,
    bankOffset: 0,
    resolution: 0,
    paletteOffset: 0,
    scrollX: 0,
    scrollY: 0,
    clip: [0, 255, 0, 191],
    clipIndex: 0,
    globalTransparency: 0xe3,
    secondPalette: false,
    ...patch
  };
}

/** An 80K set whose byte at set offset `o` is `o * 7 + (o >> 8)`, so every byte position is distinct enough. */
export function patternSet(): Uint8Array {
  return Uint8Array.from({ length: 0x14000 }, (_, o) => (o * 7 + (o >> 8)) & 0xff);
}
