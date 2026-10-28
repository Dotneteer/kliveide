import { describe, expect, it } from "vitest";

import { createTvcSession } from "../harness/tvc";
import { TVC_PHYS_VID0, TVC_BANK_SIZE, TVC_PHYS_U0 } from "@emu/machines/tvc/tvcMachineInfo";
import { bareMachine, PAL, PAPER_LEFT, PAPER_TOP, pictureHash, pixel, RGB, writeShotIfAsked } from "./bare";

/*
 * The TVC 64K+ (`.plans/VIDEOTON_TVC_PLAN.md` Phase 5): BASIC 2.2, four 16K video banks, and a video
 * paging register (port 0Ch, mirrored at 0Dh-0Fh) whose bits 1-0 choose page 1's bank (with port
 * 02h bit 2), bits 3-2 page 2's, and bits 5-4 the bank the video circuit shows (HW pp.94-95).
 */

/** "TV COMPUTER BASIC 2.2 / Copyright 1988 VIDEOTON / 42155 bytes free / ok" and the cursor, checked by eye */
const PLUS_BOOT_SHA1 = "bfd42725e1a1774ed4cd36475cfb7367da6ba402";

describe("TVC 64K+", () => {
  it("boots BASIC 2.2, the picture checked by eye", async () => {
    const s = await createTvcSession({ model: "tvc64p" });
    s.bootToBasic();
    await writeShotIfAsked(s, "plus-boot");
    expect(await pictureHash(s)).toBe(PLUS_BOOT_SHA1);
  });

  it("page 2 shows the video bank port 0Ch bits 3-2 choose; page 1 too, with port 02h bit 2", async () => {
    const s = await createTvcSession({ model: "tvc64p" });
    bareMachine(s, { halt: false });
    for (let bank = 0; bank < 4; bank++) {
      s.wasm.tvcWritePort(0x0c, bank << 2);
      s.poke(0x8000, 0x10 + bank);
    }
    for (let bank = 0; bank < 4; bank++) expect(s.physical(TVC_PHYS_VID0 + bank * TVC_BANK_SIZE)).toBe(0x10 + bank);
    // --- Page 1: port 02h bit 2 maps a video bank there, chosen by port 0Ch bits 1-0 (the mirror 0Fh)
    s.wasm.tvcWritePort(0x02, 0x14);
    s.wasm.tvcWritePort(0x0f, 0x03);
    expect(s.peek(0x4000)).toBe(0x13);
    s.wasm.tvcWritePort(0x02, 0x10);
    expect(s.peek(0x4000)).toBe(s.physical(TVC_PHYS_U0 + TVC_BANK_SIZE));
  });

  it("shows the bank port 0Ch bits 5-4 choose, whatever the CPU sees", async () => {
    const s = await createTvcSession({ model: "tvc64p" });
    bareMachine(s, { halt: false });
    s.wasm.tvcWritePort(0x06, 0x00);
    s.wasm.tvcWritePort(0x60, PAL.black);
    s.wasm.tvcWritePort(0x61, PAL.white);
    // --- Bank 2 gets a full first paper byte; the CPU keeps bank 0 in page 2
    s.wasm.tvcWritePort(0x0c, 2 << 2);
    s.poke(0x8000, 0xff);
    s.wasm.tvcWritePort(0x0c, 0);
    s.poke(0x8000, 0x00);
    s.runFrames(2);
    expect(pixel(s, PAPER_LEFT, PAPER_TOP)).toBe(RGB.black);
    s.wasm.tvcWritePort(0x0c, 2 << 4);
    s.runFrames(2);
    expect(pixel(s, PAPER_LEFT, PAPER_TOP)).toBe(RGB.brightWhite);
    expect(s.peek(0x8000)).toBe(0x00);
  });

  it("page 0 setting 11b is U3 on the 64K+ and U0 on the 64K", async () => {
    for (const [model, bank] of [["tvc64p", 3], ["tvc64", 0]] as const) {
      const s = await createTvcSession({ model });
      bareMachine(s, { halt: false });
      s.wasm.tvcWritePort(0x02, 0x18);
      expect(s.wasm.tvcGetPhysicalAddress(0x0123), model).toBe(TVC_PHYS_U0 + bank * TVC_BANK_SIZE + 0x0123);
    }
  });

  it("ignores port 0Ch on the 64K, which has one video bank", async () => {
    const s = await createTvcSession({ model: "tvc64" });
    bareMachine(s, { halt: false });
    s.wasm.tvcWritePort(0x0c, 0x3f);
    expect(s.wasm.tvcGetPhysicalAddress(0x8000)).toBe(TVC_PHYS_VID0);
    expect(s.wasm.tvcGetDisplayBank()).toBe(0);
  });
});
