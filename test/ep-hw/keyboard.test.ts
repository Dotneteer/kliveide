import { describe, expect, it } from "vitest";

import { EpKeyCode } from "@emu/machines/enterprise/EpKeyCode";
import { epKeyMappings } from "@emu/machines/enterprise/EpKeyMappings";
import { canTypeOnEnterprise } from "@emu/machines/enterprise/EpTyper";
import { JOY_B, JOY_UP } from "@emu/machines/zxNext/IZxNextHostInputMachine";
import { createEpSession } from "../harness/enterprise";

/*
 * The keyboard (`.plans/ENTERPRISE_PLAN.md` §9.1): the typer's characters, typed at IS-BASIC's prompt
 * and read back from the screen; a program typed and run; the host mapping's targets; the joysticks.
 */

const PRINTABLE = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!\"#$%&'()_-=^~\\|@`[{]};+:*,<.>/? ";

describe("the Enterprise keyboard", () => {
  it("types every printable ASCII character, and each appears on the screen", async () => {
    for (const c of PRINTABLE) expect(canTypeOnEnterprise(c), c).toBe(true);
    const s = await createEpSession();
    s.bootToBasic();
    // --- One screen line at a time: EXOS's text rows are 40 columns
    for (const chunk of PRINTABLE.match(/.{1,30}/g)!) {
      s.typeKeys(chunk, { settle: 5 });
      const lines = s.screenText().split("\n").filter((l) => l.trim());
      expect(lines[lines.length - 1].trimStart()).toBe(chunk.trimEnd());
      s.typeKeys("\n", { settle: 15 });
    }
  });

  it("types and runs a program", async () => {
    const s = await createEpSession();
    s.bootToBasic();
    s.typeKeys('10 PRINT "KLIVE";2*21\nRUN\n', { settle: 30 });
    expect(s.screenText()).toMatch(/^KLIVE 42\s*$/m);
  });

  it("maps every host key onto a key of the matrix", () => {
    for (const [host, key] of Object.entries(epKeyMappings)) {
      expect(EpKeyCode[key as string], `${host} -> ${String(key)}`).toBeDefined();
    }
  });

  it("reads an external joystick through B6h bit 0 on the row of its contact", async () => {
    const s = await createEpSession();
    s.runFrames(5);
    // --- Joystick 1 fire is row 0, joystick 2 up is row 6 (the host's pins, as the emulator panel sends them)
    s.machine.setJoystickState("left", JOY_B);
    s.machine.setJoystickState("right", JOY_UP);
    for (const [row, pressed] of [[0, true], [1, false], [6, true], [9, false]] as const) {
      s.wasm.epWritePort(0xb5, row);
      expect(s.wasm.epReadPort(0xb6) & 0x01, `row ${row}`).toBe(pressed ? 0 : 1);
    }
  });

  it("lets EXOS read a joystick: its JOY function sees the external stick's directions", async () => {
    const s = await createEpSession();
    s.bootToBasic();
    // --- IS-BASIC's JOY(1): bit 0 right, 1 left, 2 down, 3 up, 4 fire (EXOS @@JOY)
    s.machine.setJoystickState("left", JOY_UP);
    s.typeKeys("PRINT JOY(1)\n", { settle: 20 });
    s.machine.setJoystickState("left", 0);
    expect(s.screenText()).toMatch(/^ 8\s*$/m);
  });
});
