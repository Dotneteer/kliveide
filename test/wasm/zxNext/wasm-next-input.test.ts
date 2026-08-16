import { describe, expect, it } from "vitest";

import { JoystickMode } from "@emu/machines/zxNext/JoystickDevice";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Spectrum Next WASM v2 joystick and mouse input", () => {
  it("tracks hard-reset input defaults from NextRegs", async () => {
    const machine = await createTestZxNextWasmMachine();

    expect(machine.nextRegDevice.directGetRegValue(0x05)).toBe(0x41);
    expect(machine.nextRegDevice.directGetRegValue(0x0a)).toBe(0x01);
    expect(machine.nextRegDevice.directGetRegValue(0x0b)).toBe(0x01);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      joystick1Mode: JoystickMode.Kempston1,
      joystick2Mode: JoystickMode.Sinclair2,
      joystickIoModeEnabled: false,
      joystickIoMode: 0,
      joystickIoModeParam: true,
      joystickLeftState: 0,
      joystickRightState: 0,
      mouseX: 0,
      mouseY: 0,
      mouseWheel: 0,
      mouseButtonLeft: false,
      mouseButtonRight: false,
      mouseButtonMiddle: false,
      mouseSwapButtons: false,
      mouseDpi: 1
    });
  });

  it("decodes Kempston joystick 1, joystick 2, MD modes, and changed-state sync", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.joystickDevice.setLeftState(0xff);
    expect(machine.doReadPort(0x001f)).toBe(0x3f);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      joystickLeftState: 0xff,
      joystickStateWriteCount: 1
    });
    expect(machine.doReadPort(0x001f)).toBe(0x3f);
    expect(machine.getWasmV2Diagnostics().joystickStateWriteCount).toBe(1);

    machine.nextRegDevice.directSetRegValue(0x05, 0x48);
    expect(machine.getWasmV2Diagnostics().joystick1Mode).toBe(JoystickMode.MD1);
    expect(machine.doReadPort(0x001f)).toBe(0xff);

    machine.nextRegDevice.directSetRegValue(0x05, 0x02);
    machine.joystickDevice.setRightState(0x2a);
    expect(machine.getWasmV2Diagnostics().joystick2Mode).toBe(JoystickMode.Kempston2);
    expect(machine.doReadPort(0x0037)).toBe(0x2a);

    machine.nextRegDevice.directSetRegValue(0x05, 0x50);
    machine.joystickDevice.setLeftState(0x08);
    machine.joystickDevice.setRightState(0x10);
    expect(machine.doReadPort(0x001f)).toBe(0x18);
  });

  it("applies internal and expansion-bus port-enable gates for joystick ports", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.joystickDevice.setLeftState(0x1f);
    machine.nextRegDevice.directSetRegValue(0x82, 0xbf);
    expect(machine.doReadPort(0x001f)).toBe(0xff);

    machine.nextRegDevice.directSetRegValue(0x05, 0x02);
    machine.joystickDevice.setRightState(0x1f);
    machine.nextRegDevice.directSetRegValue(0x82, 0x7f);
    expect(machine.doReadPort(0x0037)).toBe(0xff);

    machine.nextRegDevice.directSetRegValue(0x82, 0xff);
    machine.nextRegDevice.directSetRegValue(0x80, 0x80);
    machine.nextRegDevice.directSetRegValue(0x86, 0xbf);
    expect(machine.doReadPort(0x001f)).toBe(0xff);
  });

  it("exposes the joystick 1 alias only while mouse ports are disabled", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.joystickDevice.setLeftState(0x18);
    expect(machine.doReadPort(0x00df)).toBe(0xff);

    machine.nextRegDevice.directSetRegValue(0x83, 0xdf);
    expect(machine.doReadPort(0x00df)).toBe(0x18);
    expect(machine.doReadPort(0xfbdf)).toBe(0xff);
  });

  it("decodes Kempston mouse accumulators, wheel, buttons, swap, DPI, and gates", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.mouseDevice.addDelta(20, 40);
    machine.mouseDevice.addWheelDelta(3);
    machine.mouseDevice.setButtons(true, false, true);

    expect(machine.doReadPort(0xfbdf)).toBe(20);
    expect(machine.doReadPort(0xffdf)).toBe(40);
    expect(machine.doReadPort(0xfadf)).toBe(0x3e);
    expect(machine.doReadPort(0x0bdf)).toBe(20);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      mouseX: 20,
      mouseY: 40,
      mouseWheel: 3,
      mouseButtonLeft: true,
      mouseButtonRight: false,
      mouseButtonMiddle: true,
      mouseStateWriteCount: 1
    });

    machine.nextRegDevice.directSetRegValue(0x0a, 0x09);
    machine.mouseDevice.setButtons(true, false, false);
    expect(machine.doReadPort(0xfadf)).toBe(0x39);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      mouseSwapButtons: true,
      mouseDpi: 1
    });

    machine.nextRegDevice.directSetRegValue(0x0a, 0x02);
    machine.mouseDevice.addDelta(20, 0);
    expect(machine.doReadPort(0xfbdf)).toBe(30);
    expect(machine.getWasmV2Diagnostics().mouseDpi).toBe(2);

    machine.nextRegDevice.directSetRegValue(0x83, 0xdf);
    expect(machine.doReadPort(0xfbdf)).toBe(0xff);
    expect(machine.doReadPort(0xffdf)).toBe(0xff);
    expect(machine.doReadPort(0xfadf)).toBe(0xff);
  });

  it("syncs direct app-owned mouse state into WASM-owned NextReg reads", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.mouseDevice.swapButtons = true;
    machine.mouseDevice.dpi = 3;
    expect(machine.nextRegDevice.directGetRegValue(0x0a)).toBe(0x0b);
  });
});
