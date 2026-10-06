import type { TilemapBanks, TilemapRegs } from "@common/zxnext/tilemap/tilemapDecode";

/** The registers after reset, with the tilemap enabled ($6B = $80). */
export const RESET_REGS: TilemapRegs = {
  enabled: true,
  control: 0x80,
  defaultAttr: 0,
  mapBank7: false,
  mapMsb: 0x2c,
  defBank7: false,
  defMsb: 0x0c,
  scrollX: 0,
  scrollY: 0,
  transparencyIndex: 0x0f,
  globalTransparency: 0xe3,
  clip: [0, 159, 0, 255],
  clipIndex: 0,
  ulaDisabled: false
};

export function regs(patch: Partial<TilemapRegs> = {}): TilemapRegs {
  return { ...RESET_REGS, ...patch };
}

export function emptyBanks(): TilemapBanks {
  return { bank5: new Uint8Array(0x4000), bank7: new Uint8Array(0x4000) };
}
