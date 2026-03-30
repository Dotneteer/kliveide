import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";
import { MultifaceDevice } from "@emu/machines/zxNext/MultifaceDevice";

/**
 * Tests for MAME/FPGA vs Klive Multiface discrepancy fixes (D3–D9).
 *
 * Reference:
 *   MAME: _input/src/mame/sinclair/specnext_multiface.cpp/.h
 *   FPGA: _input/next-fpga/src/device/multiface.vhd
 *         _input/next-fpga/src/device/divmmc.vhd
 *         _input/next-fpga/src/zxnext.vhd
 */
describe("Multiface Discrepancy Fixes", async () => {
  let m: TestZxNextMachine;
  let mf: MultifaceDevice;

  beforeEach(async () => {
    m = await createTestNextMachine();
    mf = m.multifaceDevice;
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  D3: Missing enable_i gating
  //
  //  FPGA: reset <= reset_i or not enable_i  (held in reset when disabled)
  //  MAME: nmi_disable_r() { return m_enable && m_nmi_active; }
  //        mf_enabled_r()  { return m_enable && mf_enable_eff(); }
  //
  //  Klive: MultifaceDevice.enabled maps to nextRegDevice.portMultifaceEnabled
  // ═══════════════════════════════════════════════════════════════════════

  describe("D3: enabled gating", () => {
    it("enabled returns false when portMultifaceEnabled is false", () => {
      m.nextRegDevice.portMultifaceEnabled = false;
      expect(mf.enabled).toBe(false);
    });

    it("enabled returns true when portMultifaceEnabled is true", () => {
      m.nextRegDevice.portMultifaceEnabled = true;
      expect(mf.enabled).toBe(true);
    });

    it("nmiHold is false when enabled=false even if nmiActive=true", () => {
      m.nextRegDevice.portMultifaceEnabled = false;
      mf.nmiActive = true;
      expect(mf.nmiHold).toBe(false);
    });

    it("nmiHold is true when enabled=true and nmiActive=true", () => {
      m.nextRegDevice.portMultifaceEnabled = true;
      mf.nmiActive = true;
      expect(mf.nmiHold).toBe(true);
    });

    it("mfEnabledEff is false when enabled=false even if mfEnabled=true", () => {
      m.nextRegDevice.portMultifaceEnabled = false;
      mf.mfEnabled = true;
      expect(mf.mfEnabledEff).toBe(false);
    });

    it("mfEnabledEff is true when enabled=true and mfEnabled=true", () => {
      m.nextRegDevice.portMultifaceEnabled = true;
      mf.mfEnabled = true;
      expect(mf.mfEnabledEff).toBe(true);
    });

    it("isActive is false when enabled=false even if mfEnabled and nmiActive", () => {
      m.nextRegDevice.portMultifaceEnabled = false;
      mf.mfEnabled = true;
      mf.nmiActive = true;
      expect(mf.isActive).toBe(false);
    });

    it("isActive is true when enabled=true and nmiActive=true", () => {
      m.nextRegDevice.portMultifaceEnabled = true;
      mf.nmiActive = true;
      expect(mf.isActive).toBe(true);
    });

    it("isActive is true when enabled=true and mfEnabled=true", () => {
      m.nextRegDevice.portMultifaceEnabled = true;
      mf.mfEnabled = true;
      expect(mf.isActive).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  D4: onRetnExecuted() clears mf_enable unconditionally (not just when nmiActive)
  //
  //  FPGA multiface.vhd line 178:
  //    elsif port_mf_disable_rd_i = '1' or cpu_retn_seen_i = '1' then
  //        mf_enable <= '0';
  //  MAME specnext_multiface.cpp line 74:
  //    if (m_port_mf_disable_rd || m_cpu_retn_seen)
  //        m_mf_enable = 0;
  //
  //  Both clear mf_enable on RETN unconditionally.
  // ═══════════════════════════════════════════════════════════════════════

  describe("D4: RETN clears mf_enable unconditionally", () => {
    it("onRetnExecuted clears mfEnabled even when nmiActive is already false", () => {
      m.nextRegDevice.portMultifaceEnabled = true;
      // MF ROM has paged itself out via port write (nmiActive cleared),
      // but mfEnabled is still true (e.g., readEnablePort was called).
      mf.nmiActive = false;
      mf.mfEnabled = true;
      (m as any).onRetnExecuted();
      // mfEnabledEff was true → handleRetn() should have been called
      expect(mf.mfEnabled).toBe(false);
    });

    it("onRetnExecuted clears both nmiActive and mfEnabled when both are set", () => {
      m.nextRegDevice.portMultifaceEnabled = true;
      mf.nmiActive = true;
      mf.mfEnabled = true;
      (m as any).onRetnExecuted();
      expect(mf.nmiActive).toBe(false);
      expect(mf.mfEnabled).toBe(false);
    });

    it("onRetnExecuted does not touch MF when MF is disabled (enabled=false)", () => {
      m.nextRegDevice.portMultifaceEnabled = false;
      mf.nmiActive = true;
      mf.mfEnabled = true;
      (m as any).onRetnExecuted();
      // enabled=false → mfEnabledEff=false, nmiHold=false → handleRetn not called
      expect(mf.nmiActive).toBe(true);
      expect(mf.mfEnabled).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  D5: DivMMC receives RETN signal, gated by NOT mf_is_active
  //
  //  FPGA zxnext.vhd line 4091:
  //    divmmc_retn_seen <= z80_retn_seen_28 AND NOT mf_is_active
  //  MAME specnext.cpp leave_nmi():
  //    m_mf->cpu_retn_seen_w(1); m_mf->clock_w();
  //    m_divmmc->retn_seen_w(1); m_divmmc->clock_w();
  //
  //  In FPGA: DivMMC only gets RETN when MF is not active.
  //  In MAME: DivMMC always gets RETN (no gate), but MF is clocked first.
  //  Our impl: MF is processed first via handleRetn(), then checks isActive.
  // ═══════════════════════════════════════════════════════════════════════

  describe("D5: RETN routed to DivMMC", () => {
    it("DivMMC handleRetnExecution called when MF is not active", () => {
      m.nextRegDevice.portMultifaceEnabled = true;
      m.nextRegDevice.directSetRegValue(0x83, 0x03); // Enable DivMMC + MF

      // Set up DivMMC state that RETN should clear
      const divmmc = m.divMmcDevice;
      (divmmc as any)._nmiButtonPressed = true;
      (divmmc as any)._autoMapActive = true;

      // MF is not active (both false)
      mf.nmiActive = false;
      mf.mfEnabled = false;

      (m as any).onRetnExecuted();

      // DivMMC should have been cleared by handleRetnExecution
      expect((divmmc as any)._nmiButtonPressed).toBe(false);
      expect((divmmc as any)._autoMapActive).toBe(false);
    });

    it("DivMMC handleRetnExecution called after MF handleRetn clears MF state", () => {
      m.nextRegDevice.portMultifaceEnabled = true;
      m.nextRegDevice.directSetRegValue(0x83, 0x03); // Enable DivMMC + MF

      const divmmc = m.divMmcDevice;
      (divmmc as any)._nmiButtonPressed = true;
      (divmmc as any)._autoMapActive = true;

      // MF NMI is active — but handleRetn will clear it first
      mf.nmiActive = true;
      mf.mfEnabled = true;

      (m as any).onRetnExecuted();

      // After handleRetn: nmiActive=false, mfEnabled=false → isActive=false
      // So DivMMC should also receive the RETN
      expect(mf.nmiActive).toBe(false);
      expect(mf.mfEnabled).toBe(false);
      expect((divmmc as any)._nmiButtonPressed).toBe(false);
      expect((divmmc as any)._autoMapActive).toBe(false);
    });

    it("DivMMC does NOT receive RETN when DivMMC is disabled", () => {
      m.nextRegDevice.portMultifaceEnabled = true;
      m.nextRegDevice.directSetRegValue(0x83, 0x02); // MF enabled, DivMMC disabled

      const divmmc = m.divMmcDevice;
      (divmmc as any)._nmiButtonPressed = true;
      (divmmc as any)._autoMapActive = true;

      mf.nmiActive = false;
      mf.mfEnabled = false;

      (m as any).onRetnExecuted();

      // DivMMC is disabled → handleRetnExecution should NOT have been called
      expect((divmmc as any)._nmiButtonPressed).toBe(true);
      expect((divmmc as any)._autoMapActive).toBe(true);
    });

    it("DivMMC RETN clears button_nmi and automap but NOT conmem (D6)", () => {
      m.nextRegDevice.portMultifaceEnabled = false; // MF disabled
      m.nextRegDevice.directSetRegValue(0x83, 0x01); // DivMMC enabled

      const divmmc = m.divMmcDevice;
      // Set conmem via port 0xE3 write
      m.writePort(0xe3, 0x80); // conmem bit set
      (divmmc as any)._nmiButtonPressed = true;
      (divmmc as any)._autoMapActive = true;

      (m as any).onRetnExecuted();

      // button_nmi and automap cleared
      expect((divmmc as any)._nmiButtonPressed).toBe(false);
      expect((divmmc as any)._autoMapActive).toBe(false);
      // conmem NOT cleared by RETN
      expect((divmmc as any)._conmem).toBe(true);
      expect(divmmc.port0xe3Value & 0x80).toBe(0x80);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  D6: handleRetnExecution does NOT clear conmem
  //
  //  FPGA divmmc.vhd: retn_seen clears only button_nmi, automap_hold, automap_held.
  //  conmem (port 0xE3 bit 7) is a user-controlled register.
  // ═══════════════════════════════════════════════════════════════════════

  describe("D6: handleRetnExecution preserves conmem", () => {
    it("handleRetnExecution clears button_nmi and automap", () => {
      (m.divMmcDevice as any)._nmiButtonPressed = true;
      (m.divMmcDevice as any)._autoMapActive = true;
      m.divMmcDevice.handleRetnExecution();
      expect((m.divMmcDevice as any)._nmiButtonPressed).toBe(false);
      expect((m.divMmcDevice as any)._autoMapActive).toBe(false);
    });

    it("handleRetnExecution does NOT clear conmem flag", () => {
      (m.divMmcDevice as any)._conmem = true;
      (m.divMmcDevice as any)._conmemActivated = true;
      m.divMmcDevice.handleRetnExecution();
      expect((m.divMmcDevice as any)._conmem).toBe(true);
      expect((m.divMmcDevice as any)._conmemActivated).toBe(true);
    });

    it("handleRetnExecution does NOT clear port 0xE3 bit 7", () => {
      m.nextRegDevice.directSetRegValue(0x83, 0x01); // Enable DivMMC hardware
      m.writePort(0xe3, 0x85); // conmem=1, bank=5
      m.divMmcDevice.handleRetnExecution();
      // bit 7 (conmem) should still be set in the stored register value
      expect(m.divMmcDevice.port0xe3Value & 0x80).toBe(0x80);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  D9: No debug console.log in onFetch0066
  //  (Verified by code inspection — no runtime assertion needed,
  //   but we test that onFetch0066 still functions correctly.)
  // ═══════════════════════════════════════════════════════════════════════

  describe("D9: onFetch0066 no debug logging", () => {
    it("onFetch0066 sets mfEnabled when nmiActive", () => {
      mf.nmiActive = true;
      mf.mfEnabled = false;
      mf.onFetch0066();
      expect(mf.mfEnabled).toBe(true);
    });

    it("onFetch0066 is no-op when nmiActive=false", () => {
      mf.nmiActive = false;
      mf.mfEnabled = false;
      mf.onFetch0066();
      expect(mf.mfEnabled).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Integration: full NMI → RETN cycle with DivMMC
  // ═══════════════════════════════════════════════════════════════════════

  describe("Integration: NMI + RETN cycle", () => {
    it("MF NMI through full state machine, then RETN clears both MF and DivMMC", () => {
      m.nextRegDevice.portMultifaceEnabled = true;
      m.nextRegDevice.directSetRegValue(0x83, 0x03); // Enable both DivMMC + MF
      m.divMmcDevice.enableMultifaceNmiByM1Button = true;

      const divmmc = m.divMmcDevice;

      // Trigger MF NMI
      (m as any)._pendingMfNmi = true;
      m.beforeOpcodeFetch(); // IDLE→FETCH, pressNmiButton called
      expect((m as any)._nmiState).toBe("FETCH");
      expect(mf.nmiActive).toBe(true);

      // Simulate CPU jumping to 0x0066
      m.pc = 0x0066;
      m.beforeOpcodeFetch(); // FETCH→HOLD, onFetch0066 called
      expect((m as any)._nmiState).toBe("HOLD");
      expect(mf.mfEnabled).toBe(true);

      // Now set DivMMC state that should be cleared by RETN
      // (set AFTER NMI accepted, as in real hardware the DivMMC NMI lines
      //  would not be asserted while MF NMI is active)
      (divmmc as any)._nmiButtonPressed = true;
      (divmmc as any)._autoMapActive = true;

      // Execute RETN via onRetnExecuted
      (m as any).onRetnExecuted();

      // MF state cleared
      expect(mf.nmiActive).toBe(false);
      expect(mf.mfEnabled).toBe(false);
      // DivMMC state cleared (MF became inactive after handleRetn)
      expect((divmmc as any)._nmiButtonPressed).toBe(false);
      expect((divmmc as any)._autoMapActive).toBe(false);
    });

    it("stackless NMI + RETN restores PC and clears MF/DivMMC", () => {
      m.nextRegDevice.portMultifaceEnabled = true;
      m.nextRegDevice.directSetRegValue(0x83, 0x03);
      m.divMmcDevice.enableMultifaceNmiByM1Button = true;
      m.interruptDevice.enableStacklessNmi = true;

      // DivMMC NMI state (not MF — stackless is for DivMMC)
      m.divMmcDevice.enableDivMmcNmiByDriveButton = true;
      (m.divMmcDevice as any)._nmiButtonPressed = true;

      // Simulate stackless NMI having been processed
      (m as any)._stacklessNmiProcessed = true;
      m.interruptDevice.nmiReturnAddress = 0x4321;
      m.pc = 0xbeef; // garbage from stack pop

      // MF not active
      mf.nmiActive = false;
      mf.mfEnabled = false;

      (m as any).onRetnExecuted();

      // DivMMC cleared (MF not active)
      expect((m.divMmcDevice as any)._nmiButtonPressed).toBe(false);
      // PC restored from nmiReturnAddress
      expect(m.pc).toBe(0x4321);
      // Stackless flag cleared
      expect((m as any)._stacklessNmiProcessed).toBe(false);
    });
  });
});
