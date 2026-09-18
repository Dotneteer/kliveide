import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession } from "../../harness/zxnext";

/*
 * What a `$253B` read returns (catalogue NR-009 - NR-011).
 *
 * Hardware: the read mux in `_input/next-fpga/src/zxnext.vhd` (~5830-6233) is one `case nr_register`.
 * Registers it does not list fall into `when others => port_253b_dat <= (others => '0')` (~6232) -
 * including registers that exist only for writing ($04, $35-$39, $60, $63, $75-$79, ...). Registers it
 * lists pad some bits with constant '0' (or '1') bits.
 */

/** The registers the read mux lists (extracted from zxnext.vhd ~5830-6233). */
const READ_MUX = new Set(
  (
    "00 01 02 03 05 06 07 08 09 0A 0B 0E 0F 10 11 12 13 14 15 16 17 18 19 1A 1B 1C 1E 1F 20 22 23 26 27 28 " +
    "2C 2D 2E 2F 30 31 32 33 34 40 41 42 43 44 4A 4B 4C 50 51 52 53 54 55 56 57 61 62 64 68 69 6A 6B 6C 6E " +
    "6F 70 71 7F 80 81 82 83 84 85 86 87 88 89 8A 8C 8E 8F 90 91 92 93 98 99 9A 9B A0 A2 A8 A9 B0 B1 B2 B8 " +
    "B9 BA BB C0 C2 C3 C4 C5 C6 C8 C9 CA CC CD CE D8 D9 DA F0 F8 F9 FA"
  )
    .split(" ")
    .map((h) => parseInt(h, 16))
);
const UNLISTED = Array.from({ length: 256 }, (_, r) => r).filter((r) => !READ_MUX.has(r));

/*
 * NR-010: constant bits of the read mux, checked after writing $FF (or, for `readOnly` rows, without a
 * write). `zero`/`one` are masks of the bits the mux hard-wires. Registers whose write has effects a
 * readback cannot undo (resets, config-mode-only writes) are read-only rows.
 */
type PadRow = { reg: number; zero: number; one?: number; readOnly?: boolean; why: string };
const PADDED: PadRow[] = [
  { reg: 0x07, zero: 0xcc, why: `"00" & cpu_speed & "00" & nr_07_cpu_speed` },
  { reg: 0x09, zero: 0x08, why: `psg_mono & sprite_tie & '0' & ...` },
  { reg: 0x0a, zero: 0x24, why: `mf_type & '0' & automap & reverse & '0' & dpi` },
  { reg: 0x0b, zero: 0x4e, why: `iomode_en & '0' & iomode & "000" & iomode_0` },
  { reg: 0x0f, zero: 0xf0, readOnly: true, why: `"0000" & g_board_issue` },
  { reg: 0x10, zero: 0x80, readOnly: true, why: `'0' & nr_10_coreid & buttons` },
  { reg: 0x11, zero: 0xf8, readOnly: true, why: `"00000" & nr_11_video_timing` },
  { reg: 0x12, zero: 0x80, why: `'0' & nr_12_layer2_active_bank` },
  { reg: 0x13, zero: 0x80, why: `'0' & nr_13_layer2_shadow_bank` },
  { reg: 0x1e, zero: 0xfe, readOnly: true, why: `"0000000" & cvc(8)` },
  { reg: 0x22, zero: 0x78, why: `not pulse_int_n & "0000" & ...` },
  { reg: 0x2d, zero: 0x3f, readOnly: true, why: `nr_2d_i2s_sample & "000000"` },
  { reg: 0x2f, zero: 0xfc, why: `"000000" & nr_30_tm_scrollx(9:8)` },
  { reg: 0x34, zero: 0x80, why: `'0' & sprite_mirror_id` },
  { reg: 0x4c, zero: 0xf0, why: `"0000" & nr_4c_tm_transparent_index` },
  { reg: 0x62, zero: 0x38, why: `nr_62_copper_mode & "000" & nr_copper_addr(10:8)` },
  { reg: 0x68, zero: 0x02, why: `... & nr_68_ula_fine_scroll_x & '0' & stencil` },
  { reg: 0x6a, zero: 0xc0, why: `"00" & radastan & radastan_xor & palette_offset` },
  { reg: 0x6e, zero: 0x40, why: `nr_6e_tilemap_base_7 & '0' & nr_6e_tilemap_base` },
  { reg: 0x6f, zero: 0x40, why: `nr_6f_tilemap_tiles_7 & '0' & nr_6f_tilemap_tiles` },
  { reg: 0x70, zero: 0xc0, why: `"00" & resolution & palette_offset` },
  { reg: 0x71, zero: 0xfe, why: `"0000000" & nr_71_layer2_scrollx_msb` },
  { reg: 0x81, zero: 0x0f, why: `ROMCS & ... & "00" & nr_81_expbus_speed ("00")` },
  { reg: 0x85, zero: 0x70, why: `reset_type & "000" & nr_85_internal_port_enable` },
  { reg: 0x89, zero: 0x70, why: `reset_type & "000" & nr_89_bus_port_enable` },
  { reg: 0x8a, zero: 0xc0, why: `"00" & nr_8a_bus_port_propagate` },
  { reg: 0x8e, zero: 0x00, one: 0x08, why: `dffd(0) & 7ffd(2:0) & '1' & ...` },
  { reg: 0x8f, zero: 0xfc, why: `"000000" & nr_8f_mapping_mode` },
  { reg: 0x90, zero: 0x03, why: `nr_90_pi_gpio_o_en <= nr_wr_dat(7:2) & "00"` },
  { reg: 0x93, zero: 0xf0, why: `"0000" & nr_93_pi_gpio_o_en` },
  { reg: 0xa0, zero: 0xc6, why: `"00" & en(5:3) & "00" & en(0)` },
  { reg: 0xa2, zero: 0x20, one: 0x02, why: `ctl(7:6) & '0' & ctl(4:2) & '1' & ctl(0)` },
  { reg: 0xa8, zero: 0xfe, why: `"0000000" & nr_a8_esp_gpio0_en` },
  { reg: 0xc0, zero: 0x10, why: `im2_vector & '0' & stackless & im_mode & pulse_im2` },
  { reg: 0xc4, zero: 0x7c, why: `expbus & "00000" & ula_int_en` },
  { reg: 0xc6, zero: 0x88, why: `'0' & en_654 & '0' & en_210` },
  { reg: 0xcc, zero: 0x7c, why: `dma_int_en_0_7 & "00000" & dma_int_en_0_10` },
  { reg: 0xce, zero: 0x88, why: `'0' & en_654 & '0' & en_210` },
  { reg: 0xd8, zero: 0xfe, why: `"0000000" & nr_d8_io_trap_fdc_en` },
  { reg: 0xda, zero: 0xfc, readOnly: true, why: `"000000" & nr_da_iotrap_cause` }
];

const hex = (v: number) => `$${v.toString(16).padStart(2, "0")}`;

describe.each(ALL_CORES)("NextReg read mux - %s core", (core) => {
  it("NR-009: registers the read mux does not list read $00, even after a write", async () => {
    const s = await createSession(core);
    for (const reg of UNLISTED) {
      // --- $02 (reset) is listed; none of the unlisted registers has a write that breaks the session,
      // --- except the sprite attribute/pattern registers, which are harmless with sprites off.
      if (reg !== 0xff) s.setNextReg(reg, 0x5a);
    }
    const nonZero = UNLISTED.map((reg) => [reg, s.readNextReg(reg)] as const)
      .filter(([, v]) => v !== 0)
      .map(([reg, v]) => `${hex(reg)}=${hex(v)}`);
    expect(nonZero).toEqual([]);
  });

  for (const row of PADDED) {
    it(`NR-010: ${hex(row.reg)} hard-wires ${row.why}`, async () => {
      const s = await createSession(core);
      if (!row.readOnly) {
        if (row.reg === 0x85 || row.reg === 0x89) s.setNextReg(row.reg, 0xff);
        else s.setNextReg(row.reg, 0xff);
      }
      const value = s.readNextReg(row.reg);
      expect(hex(value & row.zero), "bits that read 0").toBe(hex(0));
      expect(hex(value & (row.one ?? 0)), "bits that read 1").toBe(hex(row.one ?? 0));
    });
  }

  it("NR-011: $7F holds all 256 values", async () => {
    const s = await createSession(core);
    const wrong: string[] = [];
    for (let v = 0; v < 256; v++) {
      s.setNextReg(0x7f, v);
      const back = s.readNextReg(0x7f);
      if (back !== v) wrong.push(`${hex(v)}->${hex(back)}`);
    }
    expect(wrong).toEqual([]);
  });
});
