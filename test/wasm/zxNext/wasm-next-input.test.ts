import { describe, expect, it } from "vitest";
import { JoystickMode } from "@emu/machines/zxNext/JoystickDevice";
import { createTestNextMachine } from "../../zxnext/TestNextMachine";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM joystick and mouse devices", () => {
  it("matches TypeScript Kempston and Mega Drive joystick port reads", async () => {
    const oracle = await createTestNextMachine();
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    oracle.joystickDevice.joystick1Mode = JoystickMode.MD1;
    oracle.joystickDevice.joystick2Mode = JoystickMode.Kempston2;
    oracle.joystickDevice.setLeftState(0xd5);
    oracle.joystickDevice.setRightState(0x2a);
    exports.zxnextSetJoystickModes(JoystickMode.MD1, JoystickMode.Kempston2);
    exports.zxnextSetJoystickLeftState(0xd5);
    exports.zxnextSetJoystickRightState(0x2a);

    expect(exports.zxnextReadPort(0x001f)).toBe(oracle.joystickDevice.readPort1f());
    expect(exports.zxnextReadPort(0x0037)).toBe(oracle.joystickDevice.readPort37());
  });

  it("matches TypeScript Kempston mouse movement, wheel, buttons, and NR $0A config", async () => {
    const oracle = await createTestNextMachine();
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    oracle.mouseDevice.dpi = 2;
    oracle.mouseDevice.swapButtons = true;
    oracle.mouseDevice.addDelta(11, -7);
    oracle.mouseDevice.addWheelDelta(5);
    oracle.mouseDevice.setButtons(true, false, true);
    exports.zxnextMouseSetNextReg0A(0x0a);
    exports.zxnextMouseAddDelta(11, -7);
    exports.zxnextMouseAddWheelDelta(5);
    exports.zxnextMouseSetButtons(1, 0, 1);

    expect(exports.zxnextGetMouseDpi()).toBe(oracle.mouseDevice.dpi);
    expect(Boolean(exports.zxnextGetMouseSwapButtons())).toBe(oracle.mouseDevice.swapButtons);
    expect(exports.zxnextReadPort(0xfbdf)).toBe(oracle.mouseDevice.readPortFbdf());
    expect(exports.zxnextReadPort(0xffdf)).toBe(oracle.mouseDevice.readPortFfdf());
    expect(exports.zxnextReadPort(0xfadf)).toBe(oracle.mouseDevice.readPortFadf());
  });
});
