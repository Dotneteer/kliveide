/**
 * What a `$253B` read returns, per the FPGA read mux (`_input/next-fpga/src/zxnext.vhd` ~5830-6233,
 * one `case nr_register`).
 *
 * - Registers the mux does not list fall into `when others => port_253b_dat <= (others => '0')`:
 *   they read $00, including registers that only exist for writing ($04, $35-$39, $60, $63, ...).
 * - Listed registers hard-wire some bits: `zero` bits always read 0, `one` bits always read 1.
 *
 * The WASM core keeps the same table in `wasm/zxnext/zxnext-nextreg.c` (zxnextNextRegReadZeroMask);
 * `test/zxnext-hw/nextreg/read-mux.test.ts` checks both against the VHDL.
 */
const LISTED =
  "00 01 02 03 05 06 07 08 09 0A 0B 0E 0F 10 11 12 13 14 15 16 17 18 19 1A 1B 1C 1E 1F 20 22 23 26 27 28 " +
  "2C 2D 2E 2F 30 31 32 33 34 40 41 42 43 44 4A 4B 4C 50 51 52 53 54 55 56 57 61 62 64 68 69 6A 6B 6C 6E " +
  "6F 70 71 7F 80 81 82 83 84 85 86 87 88 89 8A 8C 8E 8F 90 91 92 93 98 99 9A 9B A0 A2 A8 A9 B0 B1 B2 B8 " +
  "B9 BA BB C0 C2 C3 C4 C5 C6 C8 C9 CA CC CD CE D8 D9 DA F0 F8 F9 FA";

/** Bits the mux hard-wires to 0, for the listed registers that have any. */
const ZERO_BITS: Record<number, number> = {
  0x02: 0x60, // --- bus_reset & "00" & iotrap & ...
  0x07: 0xcc, // --- "00" & cpu_speed & "00" & nr_07_cpu_speed
  0x09: 0x08, // --- psg_mono & sprite_tie & '0' & ...
  0x0a: 0x24, // --- mf_type & '0' & automap & reverse & '0' & dpi
  0x0b: 0x4e, // --- iomode_en & '0' & iomode & "000" & iomode_0
  0x0f: 0xf0, // --- "0000" & g_board_issue
  0x10: 0x80, // --- '0' & coreid & buttons
  0x11: 0xf8, // --- "00000" & video_timing
  0x12: 0x80, // --- '0' & layer2_active_bank
  0x13: 0x80, // --- '0' & layer2_shadow_bank
  0x1e: 0xfe, // --- "0000000" & cvc(8)
  0x20: 0x30, // --- status(0) & status(11) & "00" & status(6:3)
  0x22: 0x78, // --- not pulse_int_n & "0000" & ...
  0x2d: 0x3f, // --- i2s_sample & "000000"
  0x2f: 0xfc, // --- "000000" & tm_scrollx(9:8)
  0x34: 0x80, // --- '0' & sprite_mirror_id
  0x44: 0x3e, // --- palette_dat(10:9) & "00000" & palette_dat(0)
  0x4c: 0xf0, // --- "0000" & tm_transparent_index
  0x62: 0x38, // --- copper_mode & "000" & copper_addr(10:8)
  0x68: 0x02, // --- ... & fine_scroll_x & '0' & stencil
  0x6a: 0xc0, // --- "00" & radastan & radastan_xor & palette_offset
  0x6e: 0x40, // --- tilemap_base_7 & '0' & tilemap_base
  0x6f: 0x40, // --- tilemap_tiles_7 & '0' & tilemap_tiles
  0x70: 0xc0, // --- "00" & resolution & palette_offset
  0x71: 0xfe, // --- "0000000" & layer2_scrollx_msb
  0x81: 0x0f, // --- ROMCS & ... & "00" & expbus_speed (always "00")
  0x85: 0x70, // --- reset_type & "000" & internal_port_enable
  0x89: 0x70, // --- reset_type & "000" & bus_port_enable
  0x8a: 0xc0, // --- "00" & bus_port_propagate
  0x8f: 0xfc, // --- "000000" & mapping_mode
  0x90: 0x03, // --- nr_90_pi_gpio_o_en <= nr_wr_dat(7:2) & "00"
  0x93: 0xf0, // --- "0000" & pi_gpio_o_en
  0x9b: 0xf0, // --- "0000" & i_GPIO(27:24)
  0xa0: 0xc6, // --- "00" & en(5:3) & "00" & en(0)
  0xa2: 0x20, // --- ctl(7:6) & '0' & ctl(4:2) & '1' & ctl(0)
  0xa8: 0xfe, // --- "0000000" & esp_gpio0_en
  0xa9: 0xfa, // --- "00000" & gpio(2) & '0' & gpio(0)
  0xc0: 0x10, // --- im2_vector & '0' & stackless & im_mode & pulse_im2
  0xc4: 0x7c, // --- expbus & "00000" & ula_int_en
  0xc6: 0x88, // --- '0' & en_654 & '0' & en_210
  0xc8: 0xfc, // --- "000000" & status(0) & status(11)
  0xca: 0x88, // --- '0' & status(13) & status(2) & status(2) & '0' & ...
  0xcc: 0x7c, // --- dma_int_en_0_7 & "00000" & dma_int_en_0_10
  0xce: 0x88, // --- '0' & en_654 & '0' & en_210
  0xd8: 0xfe, // --- "0000000" & io_trap_fdc_en
  0xda: 0xfc, // --- "000000" & iotrap_cause
  0xf8: 0x80 // --- '0' & xadc_daddr
};

/** Bits the mux hard-wires to 1. */
const ONE_BITS: Record<number, number> = {
  0x8e: 0x08, // --- dffd(0) & 7ffd(2:0) & '1' & ...
  0xa2: 0x02 // --- ... & '1' & ctl(0)
};

const zeroMask = new Uint8Array(256).fill(0xff);
const oneMask = new Uint8Array(256);
for (const reg of LISTED.split(" ").map((h) => parseInt(h, 16))) zeroMask[reg] = ZERO_BITS[reg] ?? 0x00;
for (const [reg, bits] of Object.entries(ONE_BITS)) oneMask[Number(reg)] = bits;

/** Applies the read mux to a register's stored or computed value. */
export function applyNextRegReadMux(reg: number, value: number): number {
  const r = reg & 0xff;
  return ((value & ~zeroMask[r]) | oneMask[r]) & 0xff;
}
