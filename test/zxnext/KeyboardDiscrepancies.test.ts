import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { NextExtendedKey } from "@emu/machines/zxNext/NextKeyboardDevice";

// ===== Tests for keyboard device discrepancy fixes (D1-D7) =====

// --- D7: Extended key properties populated from input via setExtendedKeyStatus ---

describe("Next - Keyboard - D7: setExtendedKeyStatus populates extended key properties", function () {
  it("Setting Semicolon extended key updates semicolonPressed", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Semicolon, true);
    expect(m.keyboardDevice.semicolonPressed).toBe(true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Semicolon, false);
    expect(m.keyboardDevice.semicolonPressed).toBe(false);
  });

  it("Setting DoubleQuote extended key updates doubleQuotePressed", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.DoubleQuote, true);
    expect(m.keyboardDevice.doubleQuotePressed).toBe(true);
  });

  it("Setting Up extended key updates upPressed", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Up, true);
    expect(m.keyboardDevice.upPressed).toBe(true);
  });

  it("Setting Down extended key updates downPressed", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Down, true);
    expect(m.keyboardDevice.downPressed).toBe(true);
  });

  it("Setting Left extended key updates leftPressed", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Left, true);
    expect(m.keyboardDevice.leftPressed).toBe(true);
  });

  it("Setting Right extended key updates rightPressed", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Right, true);
    expect(m.keyboardDevice.rightPressed).toBe(true);
  });

  it("Setting Delete extended key updates deletePressed", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Delete, true);
    expect(m.keyboardDevice.deletePressed).toBe(true);
  });

  it("Setting Edit extended key updates editPressed", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Edit, true);
    expect(m.keyboardDevice.editPressed).toBe(true);
  });

  it("Setting Break extended key updates breakPressed", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Break, true);
    expect(m.keyboardDevice.breakPressed).toBe(true);
  });

  it("Setting all extended keys and reading regs 0xB0/0xB1", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    // Set all B0 keys
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Semicolon, true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.DoubleQuote, true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Comma, true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Dot, true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Up, true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Down, true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Left, true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Right, true);
    expect(m.keyboardDevice.nextRegB0Value).toBe(0xff);

    // Set all B1 keys
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Delete, true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Edit, true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Break, true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.InvVideo, true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.TrueVideo, true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Graph, true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.CapsLock, true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Extend, true);
    expect(m.keyboardDevice.nextRegB1Value).toBe(0xff);
  });

  it("Reg 0xB0 reflects individual extended key bits", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Up, true);
    expect(m.keyboardDevice.nextRegB0Value).toBe(0x08); // bit 3
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Right, true);
    expect(m.keyboardDevice.nextRegB0Value).toBe(0x09); // bits 3+0
  });

  it("Reset clears all extended key states", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Up, true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Delete, true);
    m.keyboardDevice.reset();
    expect(m.keyboardDevice.nextRegB0Value).toBe(0x00);
    expect(m.keyboardDevice.nextRegB1Value).toBe(0x00);
  });
});

// --- D2: Extended key injection into 8×5 keyboard matrix ---

describe("Next - Keyboard - D2: Extended keys inject into 8×5 matrix", function () {
  // Helper: read keyboard row via port 0xFE address
  // Row 0 = address 0xFEFE, Row 1 = 0xFDFE, Row 2 = 0xFBFE, Row 3 = 0xF7FE
  // Row 4 = 0xEFFE, Row 5 = 0xDFFE, Row 6 = 0xBFFE, Row 7 = 0x7FFE
  function readKeyRow(m: IZxNextMachine, row: number): number {
    const addr = ((~(1 << row) & 0xff) << 8) | 0xfe;
    return m.keyboardDevice.getKeyLineStatus(addr);
  }

  it("UP key injects CShift + N7 into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Up, true);

    // Row 0 should show CShift pressed (bit 0 = 0)
    expect(readKeyRow(m, 0) & 0x01).toBe(0x00);
    // Row 4 should show N7 pressed (bit 3 = 0)
    expect(readKeyRow(m, 4) & 0x08).toBe(0x00);
    // Other rows should be unaffected
    expect(readKeyRow(m, 1)).toBe(0xff);
  });

  it("DOWN key injects CShift + N6 into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Down, true);

    expect(readKeyRow(m, 0) & 0x01).toBe(0x00); // CShift
    expect(readKeyRow(m, 4) & 0x10).toBe(0x00); // N6 (bit 4)
  });

  it("LEFT key injects CShift + N5 into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Left, true);

    expect(readKeyRow(m, 0) & 0x01).toBe(0x00); // CShift
    expect(readKeyRow(m, 3) & 0x10).toBe(0x00); // N5 (bit 4)
  });

  it("RIGHT key injects CShift + N8 into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Right, true);

    expect(readKeyRow(m, 0) & 0x01).toBe(0x00); // CShift
    expect(readKeyRow(m, 4) & 0x04).toBe(0x00); // N8 (bit 2)
  });

  it("DELETE key injects CShift + N0 into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Delete, true);

    expect(readKeyRow(m, 0) & 0x01).toBe(0x00); // CShift
    expect(readKeyRow(m, 4) & 0x01).toBe(0x00); // N0 (bit 0)
  });

  it("EDIT key injects CShift + N1 into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Edit, true);

    expect(readKeyRow(m, 0) & 0x01).toBe(0x00); // CShift
    expect(readKeyRow(m, 3) & 0x01).toBe(0x00); // N1 (bit 0)
  });

  it("BREAK key injects CShift + Space into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Break, true);

    expect(readKeyRow(m, 0) & 0x01).toBe(0x00); // CShift
    expect(readKeyRow(m, 7) & 0x01).toBe(0x00); // Space (bit 0)
  });

  it("INV VIDEO key injects CShift + N4 into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.InvVideo, true);

    expect(readKeyRow(m, 0) & 0x01).toBe(0x00); // CShift
    expect(readKeyRow(m, 3) & 0x08).toBe(0x00); // N4 (bit 3)
  });

  it("TRUE VIDEO key injects CShift + N3 into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.TrueVideo, true);

    expect(readKeyRow(m, 0) & 0x01).toBe(0x00); // CShift
    expect(readKeyRow(m, 3) & 0x04).toBe(0x00); // N3 (bit 2)
  });

  it("GRAPH key injects CShift + N9 into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Graph, true);

    expect(readKeyRow(m, 0) & 0x01).toBe(0x00); // CShift
    expect(readKeyRow(m, 4) & 0x02).toBe(0x00); // N9 (bit 1)
  });

  it("CAPS LOCK key injects CShift + N2 into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.CapsLock, true);

    expect(readKeyRow(m, 0) & 0x01).toBe(0x00); // CShift
    expect(readKeyRow(m, 3) & 0x02).toBe(0x00); // N2 (bit 1)
  });

  it("EXTEND key injects CShift + SShift into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Extend, true);

    expect(readKeyRow(m, 0) & 0x01).toBe(0x00); // CShift
    expect(readKeyRow(m, 7) & 0x02).toBe(0x00); // SShift (bit 1)
  });

  it("Semicolon key injects SShift + O into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Semicolon, true);

    expect(readKeyRow(m, 7) & 0x02).toBe(0x00); // SShift (bit 1)
    expect(readKeyRow(m, 5) & 0x02).toBe(0x00); // O (bit 1)
    // CShift should NOT be pressed for SShift-based keys
    expect(readKeyRow(m, 0) & 0x01).toBe(0x01);
  });

  it("DoubleQuote key injects SShift + P into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.DoubleQuote, true);

    expect(readKeyRow(m, 7) & 0x02).toBe(0x00); // SShift
    expect(readKeyRow(m, 5) & 0x01).toBe(0x00); // P (bit 0)
  });

  it("Comma key injects SShift + N into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Comma, true);

    expect(readKeyRow(m, 7) & 0x02).toBe(0x00); // SShift
    expect(readKeyRow(m, 7) & 0x08).toBe(0x00); // N (bit 3)
  });

  it("Dot key injects SShift + M into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Dot, true);

    expect(readKeyRow(m, 7) & 0x02).toBe(0x00); // SShift
    expect(readKeyRow(m, 7) & 0x04).toBe(0x00); // M (bit 2)
  });

  it("Extended keys coexist with regular key presses", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    // Press regular key A
    m.keyboardDevice.setKeyStatus(SpectrumKeyCode.A, true);
    // Also press extended UP
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Up, true);

    // Row 1 should show A pressed (bit 0 = 0)
    expect(readKeyRow(m, 1) & 0x01).toBe(0x00);
    // Row 0 should show CShift pressed from UP
    expect(readKeyRow(m, 0) & 0x01).toBe(0x00);
    // Row 4 should show N7 pressed from UP
    expect(readKeyRow(m, 4) & 0x08).toBe(0x00);
  });

  it("Releasing extended key removes matrix injection", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Up, true);
    expect(readKeyRow(m, 0) & 0x01).toBe(0x00); // CShift pressed

    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Up, false);
    expect(readKeyRow(m, 0) & 0x01).toBe(0x01); // CShift released
    expect(readKeyRow(m, 4) & 0x08).toBe(0x08); // N7 released
  });
});

// --- D6: Cancel extended key entries (reg 0x68 bit 4) ---

describe("Next - Keyboard - D6: cancelExtendedKeyEntries suppresses matrix injection", function () {
  function readKeyRow(m: IZxNextMachine, row: number): number {
    const addr = ((~(1 << row) & 0xff) << 8) | 0xfe;
    return m.keyboardDevice.getKeyLineStatus(addr);
  }

  it("Extended keys do NOT inject into matrix when cancel flag is set", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.cancelExtendedKeyEntries = true;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Up, true);

    // Matrix should be clean — no CShift or N7
    expect(readKeyRow(m, 0)).toBe(0xff);
    expect(readKeyRow(m, 4)).toBe(0xff);
  });

  it("Extended keys still visible in reg 0xB0 when cancel flag is set", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.cancelExtendedKeyEntries = true;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Up, true);

    // B0 should still report the key
    expect(m.keyboardDevice.nextRegB0Value & 0x08).toBe(0x08);
  });

  it("Clearing cancel flag re-enables matrix injection", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.cancelExtendedKeyEntries = true;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Up, true);
    expect(readKeyRow(m, 0)).toBe(0xff); // suppressed

    m.keyboardDevice.cancelExtendedKeyEntries = false;
    expect(readKeyRow(m, 0) & 0x01).toBe(0x00); // CShift now injected
  });

  it("Regular key presses still work when cancel flag is set", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.cancelExtendedKeyEntries = true;
    m.keyboardDevice.setKeyStatus(SpectrumKeyCode.A, true);

    // Row 1 should show A pressed
    expect(readKeyRow(m, 1) & 0x01).toBe(0x00);
  });

  it("Multiple extended keys with cancel — none inject into matrix", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.cancelExtendedKeyEntries = true;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Semicolon, true);
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Delete, true);

    // All rows should be clean
    for (let row = 0; row < 8; row++) {
      expect(readKeyRow(m, row)).toBe(0xff);
    }

    // But registers should reflect the state
    expect(m.keyboardDevice.nextRegB0Value & 0x80).toBe(0x80); // semicolon
    expect(m.keyboardDevice.nextRegB1Value & 0x80).toBe(0x80); // delete
  });
});

// --- D1: Joystick values merged into keyboard matrix on port 0xFE read ---

describe("Next - Keyboard - D1: Joystick merged into keyboard matrix", function () {
  function readKeyRow(m: IZxNextMachine, row: number): number {
    const addr = ((~(1 << row) & 0xff) << 8) | 0xfe;
    return m.keyboardDevice.getKeyLineStatus(addr);
  }

  it("Joy1 state merges into keyboard row 4", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    // Set joy1 right (bit 0)
    m.joystickDevice.joy1State = 0x01;

    // Row 4 bit 0 should be pressed (0)
    expect(readKeyRow(m, 4) & 0x01).toBe(0x00);
    // Other rows unaffected
    expect(readKeyRow(m, 3)).toBe(0xff);
  });

  it("Joy2 state merges into keyboard row 3", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    // Set joy2 right (bit 0)
    m.joystickDevice.joy2State = 0x01;

    // Row 3 bit 0 should be pressed (0)
    expect(readKeyRow(m, 3) & 0x01).toBe(0x00);
    // Row 4 unaffected
    expect(readKeyRow(m, 4)).toBe(0xff);
  });

  it("Joy1 all directions + fire merge into row 4", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.joystickDevice.joy1State = 0x1f; // right+left+down+up+fire

    // Row 4: all 5 bits pressed
    expect(readKeyRow(m, 4) & 0x1f).toBe(0x00);
  });

  it("Joy2 all directions + fire merge into row 3", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.joystickDevice.joy2State = 0x1f;

    expect(readKeyRow(m, 3) & 0x1f).toBe(0x00);
  });

  it("Joystick merge combines with keyboard key presses", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    // Press key A (row 1)
    m.keyboardDevice.setKeyStatus(SpectrumKeyCode.A, true);
    // Also set joy1 up (bit 3)
    m.joystickDevice.joy1State = 0x08;

    // Row 1 shows A
    expect(readKeyRow(m, 1) & 0x01).toBe(0x00);
    // Row 4 shows joy up
    expect(readKeyRow(m, 4) & 0x08).toBe(0x00);
  });

  it("Joystick merge combines with existing key in same row", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    // Press N0 (row 4, bit 0)
    m.keyboardDevice.setKeyStatus(SpectrumKeyCode.N0, true);
    // Also set joy1 fire (bit 4)
    m.joystickDevice.joy1State = 0x10;

    // Row 4 should show both
    expect(readKeyRow(m, 4) & 0x01).toBe(0x00); // N0 from keyboard
    expect(readKeyRow(m, 4) & 0x10).toBe(0x00); // fire from joystick
  });

  it("Joystick bits above 4 are masked off for keyboard merge", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.joystickDevice.joy1State = 0xff; // all bits set

    // Only lower 5 bits should affect the row
    expect(readKeyRow(m, 4) & 0x1f).toBe(0x00);
  });

  it("Zero joystick state does not affect keyboard", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.joystickDevice.joy1State = 0;
    m.joystickDevice.joy2State = 0;

    // All rows should be idle
    for (let row = 0; row < 8; row++) {
      expect(readKeyRow(m, row)).toBe(0xff);
    }
  });

  it("Multi-row address reads merge joystick for matching rows", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.joystickDevice.joy1State = 0x01; // right in row 4
    m.joystickDevice.joy2State = 0x02; // left in row 3

    // Read rows 3+4 together (address selects both)
    const addr = ((~((1 << 3) | (1 << 4)) & 0xff) << 8) | 0xfe;
    const result = m.keyboardDevice.getKeyLineStatus(addr);
    // Both right(bit0) and left(bit1) should be pressed
    expect(result & 0x01).toBe(0x00);
    expect(result & 0x02).toBe(0x00);
  });
});

// --- D4: Kempston joystick ports return 0xFF (no joystick connected) ---
// NOTE: Kempston port reads currently return 0xFF. Proper joystick mode-based
// reading will be implemented when joystick mode selection is complete.

describe("Next - Keyboard - D4: Kempston joystick ports return 0xFF (no joystick connected)", function () {
  it("Port 0x1F returns 0xFF", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;

    const val = m.doReadPort(0x001f);
    expect(val).toBe(0xff);
  });

  it("Port 0xDF (alias) returns 0xFF", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;

    const val = m.doReadPort(0x00df);
    expect(val).toBe(0xff);
  });

  it("Port 0x37 returns 0xFF", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;

    const val = m.doReadPort(0x0037);
    expect(val).toBe(0xff);
  });
});

// --- D5: Reg 0xB2 returns joystick MD pad button state ---

describe("Next - Keyboard - D5: Reg 0xB2 reads from JoystickDevice MD pad state", function () {
  it("Reg 0xB2 returns 0 initially", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    expect(m.keyboardDevice.nextRegB2Value).toBe(0x00);
  });

  it("Joy1 MD pad state maps to bits 3-0 (left pad)", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.joystickDevice.joy1MdPadState = 0x0f; // all buttons

    expect(m.keyboardDevice.nextRegB2Value & 0x0f).toBe(0x0f);
    expect(m.keyboardDevice.nextRegB2Value & 0xf0).toBe(0x00);
  });

  it("Joy2 MD pad state maps to bits 7-4 (right pad)", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.joystickDevice.joy2MdPadState = 0x0f; // all buttons

    expect(m.keyboardDevice.nextRegB2Value & 0xf0).toBe(0xf0);
    expect(m.keyboardDevice.nextRegB2Value & 0x0f).toBe(0x00);
  });

  it("Both pads combined in reg 0xB2", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.joystickDevice.joy1MdPadState = 0x05; // Y + Mode
    m.joystickDevice.joy2MdPadState = 0x0a; // X + Z

    expect(m.keyboardDevice.nextRegB2Value).toBe(0xa5);
  });

  it("Reset clears MD pad state", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.joystickDevice.joy1MdPadState = 0x0f;
    m.joystickDevice.joy2MdPadState = 0x0f;
    m.joystickDevice.reset();

    expect(m.keyboardDevice.nextRegB2Value).toBe(0x00);
  });

  it("Individual MD pad buttons map correctly", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    // Left pad Mode (bit 0)
    m.joystickDevice.joy1MdPadState = 0x01;
    expect(m.keyboardDevice.nextRegB2Value).toBe(0x01);

    // Left pad X (bit 3)
    m.joystickDevice.joy1MdPadState = 0x08;
    expect(m.keyboardDevice.nextRegB2Value).toBe(0x08);

    // Right pad Mode (bit 4)
    m.joystickDevice.joy1MdPadState = 0;
    m.joystickDevice.joy2MdPadState = 0x01;
    expect(m.keyboardDevice.nextRegB2Value).toBe(0x10);

    // Right pad X (bit 7)
    m.joystickDevice.joy2MdPadState = 0x08;
    expect(m.keyboardDevice.nextRegB2Value).toBe(0x80);
  });
});

// --- Combined: Extended keys + joystick + cancel flag interaction ---

describe("Next - Keyboard - Combined interactions", function () {
  function readKeyRow(m: IZxNextMachine, row: number): number {
    const addr = ((~(1 << row) & 0xff) << 8) | 0xfe;
    return m.keyboardDevice.getKeyLineStatus(addr);
  }

  it("Extended keys and joystick can both affect row 4", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    // UP injects CShift(row0) + N7(row4 bit3)
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Up, true);
    // Joy1 right (row4 bit0)
    m.joystickDevice.joy1State = 0x01;

    // Row 4 should show both N7 and right
    expect(readKeyRow(m, 4) & 0x08).toBe(0x00); // N7 from UP
    expect(readKeyRow(m, 4) & 0x01).toBe(0x00); // right from joy1
  });

  it("Cancel flag suppresses extended keys but not joystick", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.cancelExtendedKeyEntries = true;
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Up, true);
    m.joystickDevice.joy1State = 0x01;

    // N7 from UP should NOT be in matrix (cancelled)
    expect(readKeyRow(m, 4) & 0x08).toBe(0x08);
    // CShift from UP should NOT be in matrix (cancelled)
    expect(readKeyRow(m, 0)).toBe(0xff);
    // Joy1 right SHOULD still be in matrix
    expect(readKeyRow(m, 4) & 0x01).toBe(0x00);
  });

  it("All three sources combine: keyboard + extended + joystick", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    // Regular key in row 4: N6 (bit 4)
    m.keyboardDevice.setKeyStatus(SpectrumKeyCode.N6, true);
    // Extended key affecting row 4: DELETE → N0 (bit 0)
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Delete, true);
    // Joy1 fire (bit 4) — same as N6, combines via OR
    m.joystickDevice.joy1State = 0x10;

    const row4 = readKeyRow(m, 4);
    expect(row4 & 0x01).toBe(0x00); // N0 from DELETE
    expect(row4 & 0x10).toBe(0x00); // N6 from keyboard + joy fire
  });

  it("Reading all rows at once (address 0x00FE) combines everything", async () => {
    const m = (await createTestNextMachine()) as unknown as IZxNextMachine;
    m.keyboardDevice.setKeyStatus(SpectrumKeyCode.A, true); // row 1 bit 0
    m.keyboardDevice.setExtendedKeyStatus(NextExtendedKey.Up, true); // row 0 bit 0, row 4 bit 3
    m.joystickDevice.joy1State = 0x01; // row 4 bit 0

    // Address 0x00FE selects all rows (bits 8-15 all 0 → ~0 = 0xFF → all lines)
    const result = m.keyboardDevice.getKeyLineStatus(0x00fe);
    // Should show A(bit0), CShift(bit0), N7(bit3), joy right(bit0) all pressed
    expect(result & 0x01).toBe(0x00); // bit 0 pressed (from A, CShift, joy right, N0...)
    expect(result & 0x08).toBe(0x00); // bit 3 pressed (from N7 via UP)
  });
});
