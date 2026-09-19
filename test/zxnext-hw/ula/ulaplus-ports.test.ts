import { describe, expect, it } from "vitest";

import { createSession, displayFileAddress, type NextTestSession } from "../../harness/zxnext";

/*
 * B12 - the ULA+ ports $BF3B (register select) and $FF3B (data).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd` ~4500-4563, 4717-4720, 6903-6904):
 * - $BF3B write: `port_bf3b_ulap_mode <= cpu_do(7 downto 6)`; in mode group "00" also
 *   `port_bf3b_ulap_index <= cpu_do(5 downto 0)`.
 * - $FF3B write in group "00": a NextReg-stream palette write (`cpu_requester_2`, register X"FF") to
 *   ULA palette entry `"11" & index` = $C0 + index (first or second ULA palette by $43 bit 6). The data
 *   byte is ULA+ GGGRRRBB, reordered to RRRGGGBB: `cpu_do(4 downto 2) & cpu_do(7 downto 5) &
 *   cpu_do(1 downto 0)`; the 9th bit is B1 or B0 as for $41.
 * - $FF3B read in group "00": that entry back as GGGRRRBB (`dat(5:3) & dat(8:6) & dat(2:1)`).
 * - $FF3B write in group "01": `port_ff3b_ulap_en <= cpu_do(0)` (also written by NextReg $68 bit 3);
 *   read in any group but "00": "0000000" & ulap_en.
 * Ports enabled at reset (NextReg $85 bit 0, `internal_port_enable(24)`).
 *
 * The screen uses the ULA+ indexing (see ulanext-ulaplus.test.ts): attr $9A -> ink $E2 (index $22),
 * paper $EB (index $2B); border 5 -> $CD (index $0D).
 */

const grb = (r: number, g: number, b: number) => ((g & 7) << 5) | ((r & 7) << 2) | (b & 3);

async function session(): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(` .org $8000\n jr $`);
  return s;
}

describe("ULA+ ports", () => {
  it("$FF3B in mode group 01 enables ULA+ and reads the enable back ($68 bit 3 too)", async () => {
    const s = await session();
    s.out(0xbf3b, 0x40);
    expect(s.in(0xff3b) & 0x01).toBe(0);
    s.out(0xff3b, 0x01);
    expect({ port: s.in(0xff3b), nextReg68bit3: s.readNextReg(0x68) & 0x08 }).toEqual({ port: 0x01, nextReg68bit3: 0x08 });
    s.out(0xbf3b, 0x40).out(0xff3b, 0x00);
    expect({ port: s.in(0xff3b), nextReg68bit3: s.readNextReg(0x68) & 0x08 }).toEqual({ port: 0x00, nextReg68bit3: 0x00 });
  });

  it("$FF3B in mode group 00 writes and reads ULA palette entry $C0 + index in GRB order", async () => {
    const s = await session();
    const value = grb(5, 2, 1); // --- GGG RRR BB = 010 101 01
    s.out(0xbf3b, 0x22).out(0xff3b, value);
    s.out(0xbf3b, 0x22);
    expect(s.in(0xff3b)).toBe(value);
    // --- The same entry through NextReg $40/$41's read side: $41 reads RRRGGGBB of entry $E2
    s.setNextReg(0x43, 0x00).setNextReg(0x40, 0xe2);
    expect(s.readNextReg(0x41)).toBe((5 << 5) | (2 << 2) | 1);
  });

  it("colours written through the ports show on a ULA+ screen", async () => {
    const s = await session();
    // --- border BB = 10: the 9th bit is B1 or B0 = 1, so blue 101 (#B6), not 100
    for (const [index, value] of [[0x22, grb(7, 0, 0)], [0x2b, grb(0, 7, 0)], [0x0d, grb(0, 0, 2)]]) {
      s.out(0xbf3b, index).out(0xff3b, value);
    }
    for (let row = 0; row < 8; row++) s.poke(displayFileAddress(row, 0), 0xf0);
    s.poke(0x5800, 0x9a).out(0xfe, 5).setNextReg(0x14, 0xe3);
    s.out(0xbf3b, 0x40).out(0xff3b, 0x01); // --- ULA+ on
    s.runFrames(2);
    expect({ ink: s.pixel(98, 50), paper: s.pixel(106, 50), border: s.pixel(40, 50) }).toEqual({
      ink: "#FF0000",
      paper: "#00FF00",
      border: "#0000B6"
    });
  });
});
