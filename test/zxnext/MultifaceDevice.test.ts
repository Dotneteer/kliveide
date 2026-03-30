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

  /** Helper: enable the multiface IO gate (NR $85 bit 1) */
  function enableMf(): void {
    m.nextRegDevice.portMultifaceEnabled = true;
  }

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
    expect(mf.invisible).toBe(true);
  });

  // ─────────────────────────────
  //  D4: enabled gate
  // ─────────────────────────────

  it("enabled: false by default (portMultifaceEnabled not set)", () => {
    expect(mf.enabled).toBe(false);
  });

  it("enabled: true when NR $85 bit 1 is set", () => {
    enableMf();
    expect(mf.enabled).toBe(true);
  });

  // ─────────────────────────────
  //  D9: nmiHold gated by enable
  // ─────────────────────────────

  it("nmiHold: false when nmiActive=true but enabled=false", () => {
    mf.nmiActive = true;
    expect(mf.nmiHold).toBe(false);
  });

  it("nmiHold: true when nmiActive=true and enabled=true", () => {
    enableMf();
    mf.nmiActive = true;
    expect(mf.nmiHold).toBe(true);
  });

  it("nmiHold: false when nmiActive=false even if enabled=true", () => {
    enableMf();
    expect(mf.nmiHold).toBe(false);
  });

  // ─────────────────────────────
  //  D4: isActive gated by enable
  // ─────────────────────────────

  it("isActive: false when both flags set but not enabled", () => {
    mf.nmiActive = true;
    mf.mfEnabled = true;
    expect(mf.isActive).toBe(false);
  });

  it("isActive: true when nmiActive=true and enabled", () => {
    enableMf();
    mf.nmiActive = true;
    expect(mf.isActive).toBe(true);
  });

  it("isActive: true when mfEnabled=true and enabled", () => {
    enableMf();
    mf.mfEnabled = true;
    expect(mf.isActive).toBe(true);
  });

  // ─────────────────────────────
  //  D4: mfEnabledEff gated by enable
  // ─────────────────────────────

  it("mfEnabledEff: false when mfEnabled=true but not enabled", () => {
    mf.mfEnabled = true;
    expect(mf.mfEnabledEff).toBe(false);
  });

  it("mfEnabledEff: true when mfEnabled=true and enabled", () => {
    enableMf();
    mf.mfEnabled = true;
    expect(mf.mfEnabledEff).toBe(true);
  });

  // ─────────────────────────────
  //  invisibleEff
  // ─────────────────────────────

  it("invisibleEff: invisible=true, mode128 → true", () => {
    m.divMmcDevice.multifaceType = 1;
    mf.invisible = true;
    expect(mf.invisibleEff).toBe(true);
  });

  it("invisibleEff: invisible=true, mode48 → false (mode48 overrides)", () => {
    m.divMmcDevice.multifaceType = 3;
    mf.invisible = true;
    expect(mf.invisibleEff).toBe(false);
  });

  it("invisibleEff: invisible=false → false regardless of mode", () => {
    mf.invisible = false;
    expect(mf.invisibleEff).toBe(false);
  });

  // ─────────────────────────────
  //  readEnablePort() — D4, D5
  // ─────────────────────────────

  it("readEnablePort: returns fallthrough (0x00) when not enabled (D4)", () => {
    mf.nmiActive = true;
    mf.invisible = false;
    expect(mf.readEnablePort(0x003f)).toBe(0x00);
    // mfEnabled should NOT have changed
    expect(mf.mfEnabled).toBe(false);
  });

  it("readEnablePort: pages in when enabled, not invisible (mode128)", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 1;
    mf.invisible = false;
    mf.readEnablePort(0x00bf);
    expect(mf.mfEnabled).toBe(true);
  });

  it("readEnablePort: invisible_eff prevents page-in (mode128, invisible=true)", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 1;
    mf.mfEnabled = true;
    mf.invisible = true;
    mf.readEnablePort(0x00bf);
    expect(mf.mfEnabled).toBe(false);
  });

  it("readEnablePort: invisible_eff is false in mode48 even when invisible=true → pages in", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 3;
    mf.invisible = true;
    mf.readEnablePort(0x009f);
    expect(mf.mfEnabled).toBe(true);
  });

  it("readEnablePort: pages in when invisible=false regardless of nmiActive", () => {
    enableMf();
    mf.nmiActive = false;
    mf.invisible = false;
    mf.readEnablePort(0x003f);
    expect(mf.mfEnabled).toBe(true);
  });

  // D5: return data

  it("readEnablePort D5: MF128 visible → returns (bit3_of_7ffd << 7) | 0x7F", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 1; // mode128
    mf.invisible = false;
    m.memoryDevice.port7ffdValue = 0x08; // bit 3 set → shadow screen
    const data = mf.readEnablePort(0x00bf);
    expect(data).toBe(0xff); // (1 << 7) | 0x7f = 0xff
  });

  it("readEnablePort D5: MF128 → bit3=0 returns 0x7F", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 1;
    mf.invisible = false;
    m.memoryDevice.port7ffdValue = 0x00; // bit 3 clear
    const data = mf.readEnablePort(0x00bf);
    expect(data).toBe(0x7f);
  });

  it("readEnablePort D5: MF+3 → returns port1ffd for addr bits 15:12 = 0x1", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 0; // modeP3
    mf.invisible = false;
    m.memoryDevice.port1ffdValue = 0x05;
    const data = mf.readEnablePort(0x103f); // addr bits 15:12 = 0x1
    expect(data).toBe(0x05);
  });

  it("readEnablePort D5: MF+3 → returns port7ffd for addr bits 15:12 = 0x7", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 0;
    mf.invisible = false;
    m.memoryDevice.port7ffdValue = 0x1a;
    const data = mf.readEnablePort(0x703f); // addr bits 15:12 = 0x7
    expect(data).toBe(0x1a);
  });

  it("readEnablePort D5: MF+3 → returns portDffd for addr bits 15:12 = 0xD", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 0;
    mf.invisible = false;
    m.memoryDevice.portDffdValue = 0x03;
    const data = mf.readEnablePort(0xd03f); // addr bits 15:12 = 0xD
    expect(data).toBe(0x03);
  });

  it("readEnablePort D5: MF+3 default → returns borderColor & 0x07", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 0;
    mf.invisible = false;
    m.composedScreenDevice.borderColor = 5;
    const data = mf.readEnablePort(0x003f); // addr bits 15:12 = 0x0 → default
    expect(data).toBe(5);
  });

  it("readEnablePort D5: mode48 visible → fallthrough (mf_port_en false for mode48)", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 3; // mode48
    mf.invisible = false;
    const data = mf.readEnablePort(0x009f);
    // mf_port_en requires mode_128 || mode_p3 → false for mode48 → fallthrough
    expect(data).toBe(0x00);
    // But mfEnabled should still be set (mf_enable = !invisible_eff)
    expect(mf.mfEnabled).toBe(true);
  });

  it("readEnablePort D5: invisible in mode128 → fallthrough (mf_port_en false)", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 1;
    mf.invisible = true; // invisibleEff = true
    const data = mf.readEnablePort(0x00bf);
    expect(data).toBe(0x00); // fallthrough
    expect(mf.mfEnabled).toBe(false);
  });

  // ─────────────────────────────
  //  readDisablePort() — D2, D4, D6
  // ─────────────────────────────

  it("readDisablePort: returns 0x00 fallthrough (D6), pages out MF", () => {
    enableMf();
    mf.mfEnabled = true;
    const result = mf.readDisablePort(0x00bf);
    expect(result).toBe(0x00);
    expect(mf.mfEnabled).toBe(false);
  });

  it("readDisablePort D2: clears nmiActive in MF+3 mode", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 0; // MF+3
    mf.nmiActive = true;
    mf.readDisablePort(0x00bf);
    expect(mf.nmiActive).toBe(false);
  });

  it("readDisablePort D2: does NOT clear nmiActive in non-+3 modes", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 1; // MF128
    mf.nmiActive = true;
    mf.readDisablePort(0x003f);
    expect(mf.nmiActive).toBe(true);
  });

  it("readDisablePort D4: no state change when not enabled", () => {
    mf.mfEnabled = true;
    mf.nmiActive = true;
    mf.readDisablePort(0x00bf);
    // Should be unchanged because enabled=false
    expect(mf.mfEnabled).toBe(true);
    expect(mf.nmiActive).toBe(true);
  });

  // ─────────────────────────────
  //  writeEnablePort() — D1
  // ─────────────────────────────

  it("writeEnablePort D1: clears nmiActive in all modes when enabled", () => {
    enableMf();
    for (const t of [0, 1, 2, 3]) {
      m.divMmcDevice.multifaceType = t;
      mf.nmiActive = true;
      mf.writeEnablePort(0);
      expect(mf.nmiActive).toBe(false);
    }
  });

  it("writeEnablePort D1: sets invisible in +3 mode", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 0; // MF+3
    mf.invisible = false;
    mf.writeEnablePort(0);
    expect(mf.invisible).toBe(true);
  });

  it("writeEnablePort D1: does NOT set invisible in non-+3 modes", () => {
    enableMf();
    for (const t of [1, 2, 3]) {
      m.divMmcDevice.multifaceType = t;
      mf.invisible = false;
      mf.writeEnablePort(0);
      expect(mf.invisible).toBe(false);
    }
  });

  it("writeEnablePort D4: no effect when not enabled", () => {
    mf.nmiActive = true;
    mf.invisible = false;
    mf.writeEnablePort(0);
    expect(mf.nmiActive).toBe(true);
    expect(mf.invisible).toBe(false);
  });

  // ─────────────────────────────
  //  writeDisablePort() — D1
  // ─────────────────────────────

  it("writeDisablePort D1: clears nmiActive in all modes when enabled", () => {
    enableMf();
    for (const t of [0, 1, 2, 3]) {
      m.divMmcDevice.multifaceType = t;
      mf.nmiActive = true;
      mf.writeDisablePort(0);
      expect(mf.nmiActive).toBe(false);
    }
  });

  it("writeDisablePort D1: sets invisible in non-+3 modes", () => {
    enableMf();
    for (const t of [1, 2, 3]) {
      m.divMmcDevice.multifaceType = t;
      mf.invisible = false;
      mf.writeDisablePort(0);
      expect(mf.invisible).toBe(true);
    }
  });

  it("writeDisablePort D1: does NOT set invisible in MF+3 mode", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 0;
    mf.invisible = false;
    mf.writeDisablePort(0);
    expect(mf.invisible).toBe(false);
  });

  it("writeDisablePort D4: no effect when not enabled", () => {
    mf.nmiActive = true;
    mf.invisible = false;
    mf.writeDisablePort(0);
    expect(mf.nmiActive).toBe(true);
    expect(mf.invisible).toBe(false);
  });

  // ─────────────────────────────
  //  onFetch0066() — D10
  // ─────────────────────────────

  it("onFetch0066(): pages in MF when nmiActive (D10: no console.log)", () => {
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

  // ─────────────────────────────
  //  handlePortRead / handlePortWrite routing
  // ─────────────────────────────

  it("handlePortRead: routes to enable port based on mode", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 1; // MF128 → enable=0xBF
    mf.invisible = false;
    mf.handlePortRead(0x00bf);
    expect(mf.mfEnabled).toBe(true); // enable port read pages in
  });

  it("handlePortRead: routes to disable port based on mode", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 1; // MF128 → disable=0x3F
    mf.mfEnabled = true;
    mf.handlePortRead(0x003f);
    expect(mf.mfEnabled).toBe(false); // disable port read pages out
  });

  it("handlePortWrite: routes to disable port and clears nmiActive (D1)", () => {
    enableMf();
    m.divMmcDevice.multifaceType = 1; // MF128 → disable=0x3F
    mf.nmiActive = true;
    mf.handlePortWrite(0x003f, 0x00);
    expect(mf.nmiActive).toBe(false);
  });

  it("handlePortWrite D4: no effect when not enabled", () => {
    m.divMmcDevice.multifaceType = 1;
    mf.nmiActive = true;
    mf.handlePortWrite(0x003f, 0x00);
    expect(mf.nmiActive).toBe(true);
  });
});
