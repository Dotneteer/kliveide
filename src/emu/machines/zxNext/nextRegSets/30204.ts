import type { NextRegSetDelta } from "./index";

/*
 * Core 3.02.04's NextReg changes against 3.02.01 (`.ai/zxnext-cores/30201-to-30204.md`, D5): no new
 * register numbers; the registers whose bits were re-meant are listed here with their 3.02.04
 * description (`nextreg.txt@3.02.04`). Each is the base descriptor (`nextRegDescriptors.ts`) with only
 * the re-meant bits changed.
 */
export const NEXT_REG_DELTA_30204: NextRegSetDelta = {
  upsert: [
    {
      id: 0x0a,
      description: "Peripheral 5 Setting",
      slices: [
        {
          mask: 0xc0,
          shift: 6,
          description: "Multiface type (hard reset = 00) (config mode only)",
          valueSet: {
            0: "Multiface +3 (enable port 0x3F, disable port 0xBF)",
            1: "Multiface 128 v87.2 (enable port 0xBF, disable port 0x3F)",
            2: "Multiface 128 v87.12 (enable port 0x9F, disable port 0x1F)",
            3: "Multiface 1 (enable port 0x9F, disable port 0x1F)"
          }
        },
        {
          mask: 0x20,
          shift: 5,
          description:
            "1 to swap SD card 0 and 1 (hard reset = 0) (config mode only; only affects future writes to port 0xE7)"
        },
        { mask: 0x10, shift: 4, description: "Enable DivMMC automap (hard reset = 0)" },
        {
          mask: 0x08,
          shift: 3,
          description: "1 to reverse left and right mouse buttons (hard reset = 0)"
        },
        { mask: 0x04, shift: 2, description: "1 to change bit 5 (config mode only; reads 0)" },
        {
          mask: 0x03,
          description: "Mouse DPI (hard reset = 01)",
          valueSet: {
            0: "Low DPI",
            1: "Default",
            2: "Medium DPI",
            3: "High DPI"
          }
        }
      ]
    },
    {
      id: 0x81,
      description: "Expansion Bus Control",
      slices: [
        { mask: 0x80, shift: 7, description: "ROMCS is asserted on the expansion bus (read only)" },
        {
          mask: 0x40,
          shift: 6,
          description: "Allow peripherals to override the ULA on some even port reads (rotronics wafadrive)"
        },
        { mask: 0x20, shift: 5, description: "Disable expansion bus nmi debounce (opus discovery)" },
        {
          mask: 0x10,
          shift: 4,
          description: "Propagate the max cpu clock at all times including when the expansion bus is off"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Enable +3 FDC signals on the expansion bus (issue 5 only; stored and readable on all boards)"
        },
        {
          mask: 0x03,
          description: "Max cpu speed when the expansion bus is on (currently fixed at 00 = 3.5MHz)"
        }
      ]
    },
    {
      id: 0xa0,
      description: "PI Peripheral Enable",
      slices: [
        {
          mask: 0x20,
          shift: 5,
          description: "Enable UART on GPIO 14,15 (overrides gpio)* (soft reset = 0)"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "0 to connect Rx to GPIO 15, Tx to GPIO 14 (for comm with pi hats) (soft reset = 0); 1 to connect Rx to GPIO 14, Tx to GPIO 15 (for comm with pi)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Enable I2C on GPIO 2,3 (override gpio) (soft reset = 0)"
        },
        {
          mask: 0x02,
          shift: 1,
          description:
            "Enable SPI on GPIO 7,8,9,10,11 in slave mode pi->Next (overrides gpio and master mode) (hard reset = 0; reads 0 if slave mode is not available)"
        },
        {
          mask: 0x01,
          description: "Enable SPI on GPIO 7,8,9,10,11 in master mode Next->pi (overrides gpio) (soft reset = 0)"
        }
      ]
    }
  ]
};
