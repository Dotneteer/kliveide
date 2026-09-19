import { describe, expect, it } from "vitest";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";
import { ULA_BORDER_COLOR_NAMES } from "@common/messaging/EmuApi";

/*
 * The keyboard matrix and the $FE read bits are covered by `test/zxnext-hw/keyboard/` and
 * `test/zxnext-hw/ports/port-decode` (PORT-005). What stays here is the ULA panel state, the floating
 * bus accessor and the analog EAR discharge, which the harness does not observe.
 */
describe("ZX Spectrum Next WASM keyboard and ULA ports", () => {
  it("reports issue 2/3 MIC contribution and border state through port $FE", async () => {
    const wasm = await createTestZxNextWasmMachine();

    // --- zxnext.vhd ~3453-3465: $FE bit 6 is the last $FE bit 4 (issue 3), or bit 3 (MIC) with
    // --- NextReg $08 bit 0 set (issue 2). Bits 7 and 5 read 1, no key pressed gives bits 4-0 = 1s.
    wasm.doWritePort(0x00fe, 0x08);
    expect(wasm.doReadPort(0x00fe)).toBe(0xbf);

    wasm.tbblueOut(0x08, 0x1b);
    expect(wasm.doReadPort(0x00fe)).toBe(0xff);

    wasm.doWritePort(0x00fe, 0x17);
    expect(wasm.getWasmV2UlaState()).toMatchObject({
      // --- Border = $17 bits 2-0 = 7; `UlaState.bor` is its name (see ULA_BORDER_COLOR_NAMES)
      bor: ULA_BORDER_COLOR_NAMES[0x17 & 0x07],
      ear: true,
      mic: false
    });
    // --- Pinned (the value both cores agreed on at tag `pre-zxnext-ts-removal-2026-09-19`): the
    // --- floating bus outside the display, as a port $FF read returns it
    expect(wasm.floatingBusDevice.readFloatingBus()).toBe(0xff);
    expect(wasm.doReadPort(0xffff)).toBe(0xff);
  });

  it("keeps port $FE bit 6 up for the analog EAR discharge time", async () => {
    const wasm = await createTestZxNextWasmMachine();

    wasm.setTacts(100);
    wasm.doWritePort(0x00fe, 0x10);

    wasm.setTacts(110);
    wasm.doWritePort(0x00fe, 0x00);

    // --- Pinned (the values both cores agreed on at tag `pre-zxnext-ts-removal-2026-09-19`): after
    // --- EAR goes low at tact 110, bit 6 still reads 1 at tact 149 and drops at tact 150.
    wasm.setTacts(149);
    expect(wasm.doReadPort(0x00fe)).toBe(0xff);
    expect(wasm.doReadPort(0x00fe) & 0x40).toBe(0x40);

    wasm.setTacts(150);
    expect(wasm.doReadPort(0x00fe)).toBe(0xbf);
    expect(wasm.doReadPort(0x00fe) & 0x40).toBe(0x00);
  });
});
