import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";
import { MultifaceDevice } from "@emu/machines/zxNext/MultifaceDevice";

describe("MultifaceDevice", async () => {
  let m: TestZxNextMachine;
  let mf: MultifaceDevice;

  beforeEach(async () => {
    m = await createTestNextMachine();
    mf = m.multifaceDevice;
  });

  // ─────────────────────────────
  //  Initial state
  // ─────────────────────────────

  it("initial state: nmiActive=false, mfEnabled=false, invisible=true", () => {
    expect(mf.nmiActive).toBe(false);
    expect(mf.mfEnabled).toBe(false);
    expect(mf.invisible).toBe(true);
  });

  it("reset(): restores initial state", () => {
    mf.nmiActive = true;
    mf.mfEnabled = true;
    mf.invisible = false;
    mf.reset();
    expect(mf.nmiActive).toBe(false);
    expect(mf.mfEnabled).toBe(false);
    expect(mf.invisible).toBe(true);
  });

  // ─────────────────────────────
  //  Mode helpers
  // ─────────────────────────────

  it("mode48: true when multifaceType === 3", () => {
    m.divMmcDevice.multifaceType = 3;
    expect(mf.mode48).toBe(true);
    expect(mf.modeP3).toBe(false);
    expect(mf.mode128).toBe(false);
  });

  it("modeP3: true when multifaceType === 0", () => {
    m.divMmcDevice.multifaceType = 0;
    expect(mf.modeP3).toBe(true);
    expect(mf.mode48).toBe(false);
    expect(mf.mode128).toBe(false);
  });

  it("mode128: true for types 1 and 2", () => {
    m.divMmcDevice.multifaceType = 1;
    expect(mf.mode128).toBe(true);
    m.divMmcDevice.multifaceType = 2;
    expect(mf.mode128).toBe(true);
  });

  // ─────────────────────────────
  //  Port addresses
  // ─────────────────────────────

  it("enablePortAddress: 0x3F for MF+3 (type 0)", () => {
    m.divMmcDevice.multifaceType = 0;
    expect(mf.enablePortAddress).toBe(0x3f);
  });

  it("enablePortAddress: 0xBF for MF128 v87.2 (type 1)", () => {
    m.divMmcDevice.multifaceType = 1;
    expect(mf.enablePortAddress).toBe(0xbf);
  });

  it("enablePortAddress: 0x9F for MF128 v87.12 (type 2) and MF48 (type 3)", () => {
    m.divMmcDevice.multifaceType = 2;
    expect(mf.enablePortAddress).toBe(0x9f);
    m.divMmcDevice.multifaceType = 3;
    expect(mf.enablePortAddress).toBe(0x9f);
  });

  it("disablePortAddress: 0xBF for MF+3 (type 0)", () => {
    m.divMmcDevice.multifaceType = 0;
    expect(mf.disablePortAddress).toBe(0xbf);
  });

  it("disablePortAddress: 0x3F for MF128 v87.2 (type 1)", () => {
    m.divMmcDevice.multifaceType = 1;
    expect(mf.disablePortAddress).toBe(0x3f);
  });

  it("disablePortAddress: 0x1F for types 2 and 3", () => {
    m.divMmcDevice.multifaceType = 2;
    expect(mf.disablePortAddress).toBe(0x1f);
    m.divMmcDevice.multifaceType = 3;
    expect(mf.disablePortAddress).toBe(0x1f);
  });

  // ─────────────────────────────
  //  pressNmiButton()
  // ─────────────────────────────

  it("pressNmiButton(): sets nmiActive and clears invisible", () => {
    mf.invisible = true;
    mf.pressNmiButton();
    expect(mf.nmiActive).toBe(true);
    expect(mf.invisible).toBe(false);
  });

  it("pressNmiButton(): no-op when nmiActive already true", () => {
    mf.nmiActive = true;
    mf.invisible = true;
    mf.pressNmiButton();
    // invisible should remain true because the condition guard prevents mutation
    expect(mf.invisible).toBe(true);
  });

  // ─────────────────────────────
  //  isActive
  // ─────────────────────────────

  it("isActive: false when both nmiActive and mfEnabled are false", () => {
    expect(mf.isActive).toBe(false);
  });

  it("isActive: true when nmiActive is true", () => {
    mf.nmiActive = true;
    expect(mf.isActive).toBe(true);
  });

  it("isActive: true when mfEnabled is true", () => {
    mf.mfEnabled = true;
    expect(mf.isActive).toBe(true);
  });

  // ─────────────────────────────
  //  readEnablePort()
  // ─────────────────────────────

  it("readEnablePort(): returns 0xFF", () => {
    mf.nmiActive = true;
    mf.invisible = false;
    expect(mf.readEnablePort()).toBe(0xff);
  });

  it("readEnablePort(): pages in MF when nmiActive and not invisible", () => {
    m.divMmcDevice.multifaceType = 1; // mode128 — invisible_eff matters
    mf.nmiActive = true;
    mf.invisible = false;
    mf.readEnablePort();
    expect(mf.mfEnabled).toBe(true);
  });

  it("readEnablePort(): invisible_eff pages out MF, does not set mfEnabled", () => {
    m.divMmcDevice.multifaceType = 1; // mode128
    mf.nmiActive = true;
    mf.mfEnabled = true;
    mf.invisible = true; // invisible_eff = true because !mode48
    mf.readEnablePort();
    expect(mf.mfEnabled).toBe(false);
  });

  it("readEnablePort(): invisible_eff is false for mode48 even when invisible=true", () => {
    m.divMmcDevice.multifaceType = 3; // mode48
    mf.nmiActive = true;
    mf.invisible = true; // invisible_eff = invisible && !mode48 = false
    mf.readEnablePort();
    expect(mf.mfEnabled).toBe(true); // should still page in
  });

  it("readEnablePort(): pages in MF when invisible=false regardless of nmiActive (MAME: no nmiActive guard)", () => {
    mf.nmiActive = false; // nmiActive does NOT gate enable port in MAME model
    mf.invisible = false;
    mf.readEnablePort();
    expect(mf.mfEnabled).toBe(true); // mf_enable = !invisible_eff() = !false = true
  });

  // ─────────────────────────────
  //  readDisablePort()
  // ─────────────────────────────

  it("readDisablePort(): pages out MF, returns 0xFF", () => {
    mf.mfEnabled = true;
    const result = mf.readDisablePort();
    expect(result).toBe(0xff);
    expect(mf.mfEnabled).toBe(false);
  });

  it("readDisablePort(): clears nmiActive in P3 mode (FPGA: port_mf_disable_rd AND mode_p3)", () => {
    m.divMmcDevice.multifaceType = 0; // MF+3
    mf.nmiActive = true;
    mf.readDisablePort();
    expect(mf.nmiActive).toBe(false); // P3 disable read clears nmi_active
  });

  it("readDisablePort(): does NOT clear nmiActive in non-P3 mode", () => {
    m.divMmcDevice.multifaceType = 1;
    mf.nmiActive = true;
    mf.readDisablePort();
    expect(mf.nmiActive).toBe(true);
  });

  // ─────────────────────────────
  //  writeEnablePort()
  // ─────────────────────────────

  it("writeEnablePort(): clears nmiActive in all modes (FPGA: port_mf_enable_wr)", () => {
    for (const t of [0, 1, 2, 3]) {
      m.divMmcDevice.multifaceType = t;
      mf.nmiActive = true;
      mf.writeEnablePort(0);
      expect(mf.nmiActive).toBe(false);
    }
  });

  it("writeEnablePort(): sets invisible in P3 mode (FPGA: port_mf_enable_wr AND mode_p3)", () => {
    m.divMmcDevice.multifaceType = 0; // MF+3
    mf.invisible = false;
    mf.writeEnablePort(0);
    expect(mf.invisible).toBe(true);
  });

  it("writeEnablePort(): does NOT set invisible in non-P3 modes", () => {
    for (const t of [1, 2, 3]) {
      m.divMmcDevice.multifaceType = t;
      mf.invisible = false;
      mf.writeEnablePort(0);
      expect(mf.invisible).toBe(false);
    }
  });

  // ─────────────────────────────
  //  writeDisablePort()
  // ─────────────────────────────

  it("writeDisablePort(): clears nmiActive in all modes (FPGA: port_mf_disable_wr)", () => {
    for (const t of [0, 1, 2, 3]) {
      m.divMmcDevice.multifaceType = t;
      mf.nmiActive = true;
      mf.writeDisablePort(0);
      expect(mf.nmiActive).toBe(false);
    }
  });

  it("writeDisablePort(): sets invisible in non-P3 modes (FPGA: port_mf_disable_wr AND NOT mode_p3)", () => {
    for (const t of [1, 2, 3]) {
      m.divMmcDevice.multifaceType = t;
      mf.invisible = false;
      mf.writeDisablePort(0);
      expect(mf.invisible).toBe(true);
    }
  });

  it("writeDisablePort(): does NOT set invisible in P3 mode (type 0)", () => {
    m.divMmcDevice.multifaceType = 0;
    mf.invisible = false;
    mf.writeDisablePort(0);
    expect(mf.invisible).toBe(false);
  });

  // ─────────────────────────────
  //  onFetch0066()
  // ─────────────────────────────

  it("onFetch0066(): pages in MF when nmiActive", () => {
    mf.nmiActive = true;
    mf.mfEnabled = false;
    mf.onFetch0066();
    expect(mf.mfEnabled).toBe(true);
  });

  it("onFetch0066(): no effect when nmiActive=false", () => {
    mf.nmiActive = false;
    mf.mfEnabled = false;
    mf.onFetch0066();
    expect(mf.mfEnabled).toBe(false);
  });

  // ─────────────────────────────
  //  handleRetn()
  // ─────────────────────────────

  it("handleRetn(): clears nmiActive and mfEnabled", () => {
    mf.nmiActive = true;
    mf.mfEnabled = true;
    mf.handleRetn();
    expect(mf.nmiActive).toBe(false);
    expect(mf.mfEnabled).toBe(false);
  });

  // ═════════════════════════════
  //  D5: Enable gating (FPGA: enable_i / port_multiface_io_en)
  // ═════════════════════════════

  describe("D5: enable gating", () => {
    it("enabled defaults to true (portMultifaceEnabled undefined → ?? true)", () => {
      expect(mf.enabled).toBe(true);
    });

    it("enabled reflects nextRegDevice.portMultifaceEnabled", () => {
      m.nextRegDevice.portMultifaceEnabled = false;
      expect(mf.enabled).toBe(false);
      m.nextRegDevice.portMultifaceEnabled = true;
      expect(mf.enabled).toBe(true);
    });

    it("pressNmiButton() is no-op when disabled", () => {
      m.nextRegDevice.portMultifaceEnabled = false;
      mf.pressNmiButton();
      expect(mf.nmiActive).toBe(false);
    });

    it("nmiHold is false when disabled even if nmiActive is true", () => {
      mf.nmiActive = true;
      m.nextRegDevice.portMultifaceEnabled = false;
      expect(mf.nmiHold).toBe(false);
    });

    it("isActive is false when disabled even if mfEnabled or nmiActive", () => {
      mf.nmiActive = true;
      mf.mfEnabled = true;
      m.nextRegDevice.portMultifaceEnabled = false;
      expect(mf.isActive).toBe(false);
    });

    it("handlePortRead() returns {handled:false} when disabled", () => {
      m.divMmcDevice.multifaceType = 1; // MF128, enable=0xBF
      m.nextRegDevice.portMultifaceEnabled = false;
      mf.nmiActive = true;
      mf.invisible = false;
      const result = mf.handlePortRead(0xbf);
      expect(result.handled).toBe(false);
      // mfEnabled should NOT have changed
      expect(mf.mfEnabled).toBe(false);
    });

    it("handlePortWrite() is no-op when disabled", () => {
      m.divMmcDevice.multifaceType = 1; // enable=0xBF
      m.nextRegDevice.portMultifaceEnabled = false;
      mf.nmiActive = true;
      mf.handlePortWrite(0xbf, 0);
      // nmiActive should NOT have been cleared
      expect(mf.nmiActive).toBe(true);
    });

    it("onFetch0066() is no-op when disabled", () => {
      m.nextRegDevice.portMultifaceEnabled = false;
      mf.nmiActive = true;
      mf.onFetch0066();
      expect(mf.mfEnabled).toBe(false);
    });

    it("mfPortEn is false when disabled", () => {
      m.divMmcDevice.multifaceType = 1; // mode128
      mf.invisible = false; // normally would make mfPortEn true
      m.nextRegDevice.portMultifaceEnabled = false;
      expect(mf.mfPortEn).toBe(false);
    });

    it("disabling via NR 0x83 resets the device (FPGA: reset <= reset_i or not enable_i)", () => {
      // First enable multiface via NR 0x83
      m.nextRegDevice.directSetRegValue(0x83, 0xff); // all bits set including bit 1
      expect(m.nextRegDevice.portMultifaceEnabled).toBe(true);
      // Set up some active state
      mf.nmiActive = true;
      mf.mfEnabled = true;
      mf.invisible = false;
      // Now disable multiface via NR 0x83 with bit 1 clear
      m.nextRegDevice.directSetRegValue(0x83, 0xfd);
      expect(m.nextRegDevice.portMultifaceEnabled).toBe(false);
      expect(mf.nmiActive).toBe(false);
      expect(mf.mfEnabled).toBe(false);
      expect(mf.invisible).toBe(true);
    });
  });

  // ═════════════════════════════
  //  D4: Port read return values (mfPortEn, getMfPortData, handlePortRead)
  // ═════════════════════════════

  describe("D4: port read return values", () => {
    it("mfPortEn: true when visible and mode128", () => {
      m.divMmcDevice.multifaceType = 1; // mode128
      mf.invisible = false;
      expect(mf.mfPortEn).toBe(true);
    });

    it("mfPortEn: true when visible and modeP3", () => {
      m.divMmcDevice.multifaceType = 0; // MF+3
      mf.invisible = false;
      expect(mf.mfPortEn).toBe(true);
    });

    it("mfPortEn: false when invisible and mode128", () => {
      m.divMmcDevice.multifaceType = 1;
      mf.invisible = true;
      expect(mf.mfPortEn).toBe(false);
    });

    it("mfPortEn: true for mode48 even when invisible (invisible_eff=false)", () => {
      m.divMmcDevice.multifaceType = 3; // mode48
      mf.invisible = true;
      // invisible_eff = invisible && !mode48 = true && false = false
      // but mfPortEn requires mode128 || modeP3, and mode48 is neither
      expect(mf.mfPortEn).toBe(false);
    });

    it("getMfPortData: P3 mode returns port1ffd for cpu_a[15:12]=0001", () => {
      m.divMmcDevice.multifaceType = 0;
      m.memoryDevice.port1ffdValue = 0x05; // allRamMode=1, specialConfig=2 → getter returns 0x05
      expect(mf.getMfPortData(0x1000)).toBe(0x05);
    });

    it("getMfPortData: P3 mode returns port7ffd for cpu_a[15:12]=0111", () => {
      m.divMmcDevice.multifaceType = 0;
      m.memoryDevice.port7ffdValue = 0x33;
      expect(mf.getMfPortData(0x7000)).toBe(0x33);
    });

    it("getMfPortData: P3 mode returns portDffd for cpu_a[15:12]=1101", () => {
      m.divMmcDevice.multifaceType = 0;
      m.memoryDevice.portDffdValue = 0x0B; // selectedBankMsb = 0x0B → getter returns 0x0B
      expect(mf.getMfPortData(0xD000)).toBe(0x0B);
    });

    it("getMfPortData: P3 mode returns portEff7 bits 2-3 for cpu_a[15:12]=1110", () => {
      m.divMmcDevice.multifaceType = 0;
      m.memoryDevice.portEff7Value = 0x0c; // bits 2-3 set
      expect(mf.getMfPortData(0xE000)).toBe(0x0c);
      m.memoryDevice.portEff7Value = 0xff; // only bits 2-3 matter
      expect(mf.getMfPortData(0xE000)).toBe(0x0c);
    });

    it("getMfPortData: P3 mode returns border color for other cpu_a[15:12]", () => {
      m.divMmcDevice.multifaceType = 0;
      m.composedScreenDevice.borderColor = 5;
      expect(mf.getMfPortData(0x0000)).toBe(5);
      expect(mf.getMfPortData(0x5000)).toBe(5);
    });

    it("getMfPortData: mode128 returns (port7ffd[3]<<7)|0x7F", () => {
      m.divMmcDevice.multifaceType = 1; // mode128
      m.memoryDevice.port7ffdValue = 0x08; // bit 3 set
      expect(mf.getMfPortData(0x0000)).toBe(0xff); // 1<<7 | 0x7f
      m.memoryDevice.port7ffdValue = 0x00; // bit 3 clear
      expect(mf.getMfPortData(0x0000)).toBe(0x7f); // 0<<7 | 0x7f
    });

    it("handlePortRead: returns snapshot when mfPortEn is true", () => {
      m.divMmcDevice.multifaceType = 1; // mode128, enable=0xBF
      mf.invisible = false; // mfPortEn=true
      m.memoryDevice.port7ffdValue = 0x08; // bit 3 set → data=0xFF
      const result = mf.handlePortRead(0xbf);
      expect(result.handled).toBe(true);
      expect(result.value).toBe(0xff);
    });

    it("handlePortRead: returns {handled:false} on enable port when mfPortEn is false", () => {
      m.divMmcDevice.multifaceType = 1; // mode128, enable=0xBF
      mf.invisible = true; // mfPortEn=false
      const result = mf.handlePortRead(0xbf);
      expect(result.handled).toBe(false);
      // mfEnabled should still be updated (readEnablePort ran)
      expect(mf.mfEnabled).toBe(false); // invisible_eff = true → not paged in
    });

    it("handlePortRead: disable port always returns {handled:false}", () => {
      m.divMmcDevice.multifaceType = 1; // disable=0x3F
      mf.mfEnabled = true;
      const result = mf.handlePortRead(0x3f);
      expect(result.handled).toBe(false);
      expect(mf.mfEnabled).toBe(false); // disable port clears mfEnabled
    });

    it("handlePortRead: non-matching port returns {handled:false}", () => {
      m.divMmcDevice.multifaceType = 1;
      const result = mf.handlePortRead(0x1f); // not enable(0xBF) or disable(0x3F) for type 1
      expect(result.handled).toBe(false);
    });
  });
});
