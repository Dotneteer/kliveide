import { describe, expect, it } from "vitest";

import { createTvcSession } from "..";
import { TVC_TACTS_IN_FRAME } from "@emu/machines/tvc/tvcMachineInfo";

describe("Videoton TVC harness", () => {
  it("boots BASIC 1.2 to its key wait, with SYS paged into page 3", async () => {
    const s = await createTvcSession();
    s.bootToBasic();
    expect((s.wasm.tvcGetPort02() >> 6) & 3).toBe(1);
  });

  it("keeps the frame length across a power-on, which the controller paces the UI by", async () => {
    const s = await createTvcSession();
    s.machine.hardReset();
    expect(s.machine.tactsInFrame).toBe(TVC_TACTS_IN_FRAME);
    expect(s.wasm.tvcGetTactsInFrame()).toBe(62_800);
  });
});
