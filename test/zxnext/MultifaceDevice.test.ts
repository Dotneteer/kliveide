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

  it("readDisablePort(): does NOT clear nmiActive (MAME: port_io_dly blocks nmiActive change)", () => {
    m.divMmcDevice.multifaceType = 0; // MF+3 — old model cleared nmiActive, MAME does not
    mf.nmiActive = true;
    mf.readDisablePort();
    expect(mf.nmiActive).toBe(true); // nmiActive unchanged — only RETN clears it
  });

  it("readDisablePort(): does NOT clear nmiActive in non-MF+3 mode", () => {
    m.divMmcDevice.multifaceType = 1;
    mf.nmiActive = true;
    mf.readDisablePort();
    expect(mf.nmiActive).toBe(true);
  });

  // ─────────────────────────────
  //  writeEnablePort()
  // ─────────────────────────────

  it("writeEnablePort(): does NOT change nmiActive (MAME: port_io_dly makes writes no-ops)", () => {
    for (const t of [0, 1, 2, 3]) {
      m.divMmcDevice.multifaceType = t;
      mf.nmiActive = true;
      mf.writeEnablePort(0);
      expect(mf.nmiActive).toBe(true); // nmiActive unchanged — only RETN clears it
    }
  });

  it("writeEnablePort(): does NOT set invisible (MAME: port_io_dly makes writes no-ops)", () => {
    m.divMmcDevice.multifaceType = 0; // MF+3 — old model set invisible, MAME does not
    mf.invisible = false;
    mf.writeEnablePort(0);
    expect(mf.invisible).toBe(false); // invisible unchanged by port writes
  });

  it("writeEnablePort(): does NOT set invisible in non-MF+3 modes", () => {
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

  it("writeDisablePort(): does NOT change nmiActive (MAME: port_io_dly makes writes no-ops)", () => {
    for (const t of [0, 1, 2, 3]) {
      m.divMmcDevice.multifaceType = t;
      mf.nmiActive = true;
      mf.writeDisablePort(0);
      expect(mf.nmiActive).toBe(true); // nmiActive unchanged — only RETN clears it
    }
  });

  it("writeDisablePort(): does NOT set invisible (MAME: port_io_dly makes writes no-ops)", () => {
    for (const t of [1, 2, 3]) {
      m.divMmcDevice.multifaceType = t;
      mf.invisible = false;
      mf.writeDisablePort(0);
      expect(mf.invisible).toBe(false); // invisible unchanged by port writes
    }
  });

  it("writeDisablePort(): does NOT set invisible in MF+3 mode (type 0)", () => {
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
});
