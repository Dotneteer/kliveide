import { NEXT_REG_DESCRIPTORS } from "../nextRegDescriptors";
import { NEXT_REG_DELTA_30204 } from "./30204";
import type { NextRegSetDelta } from "./index";

/*
 * Core 3.03.03's NextReg set (`dev/plans/ZXNEXT_3_03_PLAN.md`, D5): the 3.02.04 delta, plus the two
 * registers whose description names the issue 5 board, which the 3.03 models are the first to emulate
 * (`nextreg.txt@3.02.04`: $0F's board ID 0011, $04's bit 7). The 3.03 nextreg.txt is not published:
 * the zxnDDMA's guide (`zxnddma.gde@26.11`) adds no register. VHDL-PENDING(3.03.03).
 */

const base = (id: number) => {
  const descriptor = NEXT_REG_DESCRIPTORS.find((d) => d.id === id);
  if (!descriptor) throw new Error(`NextReg $${id.toString(16)} is missing from the base set.`);
  return descriptor;
};

export const NEXT_REG_DELTA_30303: NextRegSetDelta = {
  upsert: [
    ...(NEXT_REG_DELTA_30204.upsert ?? []),
    {
      ...base(0x04),
      slices: [
        {
          mask: 0xff,
          description: "16K SRAM bank mapped to 0x0000-0x3FFF (hard reset = 0); bit 7 is ignored except on an issue 5 board"
        }
      ]
    },
    {
      ...base(0x0f),
      slices: [
        {
          mask: 0x0f,
          description: "Board ID",
          valueSet: {
            0: "ZXN Issue 2, XC6SLX16-2FTG256, 128Mbit W25Q128JV, 24bit spi, 64K*8 core size",
            1: "ZXN Issue 3, XC6SLX16-2FTG256, 128Mbit W25Q128JV, 24bit spi, 64K*8 core size",
            2: "ZXN Issue 4, XC7A15T-1CSG324, 256Mbit MX25L25645G, 32bit spi, 64K*34 core size",
            3: "ZXN Issue 5, XC7A35T-2CSG324, 256Mbit MX25L25645G, 32bit spi, 64K*34 core size"
          }
        }
      ]
    }
  ],
  remove: NEXT_REG_DELTA_30204.remove
};
