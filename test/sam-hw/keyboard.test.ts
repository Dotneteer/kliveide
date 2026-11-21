import { describe, expect, it } from "vitest";

import { createSamSession, type SamTestSession } from "../harness/samcoupe";
import { createBareSam } from "./bare";
import { SamKeyCode } from "@emu/machines/samcoupe/SamKeyCode";
import { samKeyMappings } from "@emu/machines/samcoupe/SamKeyMappings";
import { JOY_B, JOY_LEFT, JOY_UP } from "@emu/machines/zxNext/IZxNextHostInputMachine";

/*
 * The keyboard (plan §9.1; SOUND_INPUT_IO.md §3): the matrix through FEh/F9h, row 8 at FFFEh, the
 * joysticks on rows 3/4, and the typer, every character read back from the line SAM BASIC stores.
 */

/** The text of BASIC line 10 (after its REM token) */
function storedRemText(s: SamTestSession): string {
  const page = s.page(0, 0x1a9f) & 0x1f;
  const offset = (s.page(0, 0x1aa0) | (s.page(0, 0x1aa1) << 8)) & 0x3fff;
  const length = s.page(page, offset + 2) | (s.page(page, offset + 3) << 8);
  let text = "";
  for (let i = 5; i < 4 + length - 1; i++) text += String.fromCharCode(s.page(page, offset + i));
  return text;
}

describe("SAM keyboard", () => {
  it("FEh reads rows by A8-A15 (0 selects), bits 0-4; F9h bits 5-7", async () => {
    const s = await createBareSam();
    s.wasm.samSetFrameTact(50_000);
    s.machine.setKeyStatus(SamKeyCode.Z, true);
    expect(s.in(0xfefe) & 0x1f).toBe(0x1d);
    expect(s.in(0xfdfe) & 0x1f).toBe(0x1f);
    // --- Several rows at once AND together
    expect(s.in(0x00fe) & 0x1f).toBe(0x1d);
    s.machine.setKeyStatus(SamKeyCode.Z, false);
    s.machine.setKeyStatus(SamKeyCode.Edit, true);
    expect(s.in(0xbff9) & 0xe0).toBe(0x60);
    expect(s.in(0xbffe) & 0x1f).toBe(0x1f);
  });

  it("row 8 (CNTRL and the cursors) reads at FFFEh", async () => {
    const s = await createSamSession({ model: "sam512" });
    s.machine.setKeyStatus(SamKeyCode.Left, true);
    // --- Bit 4 is RIGHT; the mouse's nibble (Fh while nothing moves) leaves bits 0-3 to the keys
    expect(s.in(0xfffe) & 0x1f).toBe(0x17);
  });

  it("the joysticks: stick 1 on keys 6-0, stick 2 on keys 1-5", async () => {
    const s = await createBareSam();
    s.wasm.samSetFrameTact(50_000);
    // --- Stick 1: fire is key 0 (row 4 bit 0), up key 9 (bit 1)
    s.machine.setJoystickState("left", JOY_B | JOY_UP);
    expect(s.in(0xeffe) & 0x1f).toBe(0x1c);
    s.machine.setJoystickState("left", 0);
    expect(s.in(0xeffe) & 0x1f).toBe(0x1f);
    // --- Stick 2: left is key 1 (row 3 bit 0)
    s.machine.setJoystickState("right", JOY_LEFT);
    expect(s.in(0xf7fe) & 0x1f).toBe(0x1e);
  });

  it("types every character the typer knows, as SAM BASIC stores it", async () => {
    const s = await createSamSession();
    s.bootToBasic();
    const text = "abcxyzABCXYZ0123456789!@#$%&'()~-/+*=_\";:,.<>|{}^[]?`\\";
    s.typeKeys(`10 REM ${text}\n`, { settle: 20 });
    expect(storedRemText(s)).toBe(text);
  });

  it("the host mapping targets only matrix keys", () => {
    for (const target of Object.values(samKeyMappings)) {
      const names = Array.isArray(target) ? target : [target];
      for (const name of names) expect(SamKeyCode[name as string], String(name)).toBeDefined();
    }
  });
});
