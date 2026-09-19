import type { NextMachine } from "../core/machines";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

/*
 * The PS/2 mouse on the Next's mouse port: every event is one packet (ps2_mouse.v) with the buttons
 * held, the X / Y movement (-255..255, right / up positive) and the wheel (-8..7).
 */

export type MouseButton = "left" | "right" | "middle";
export type MouseEvent = { dx?: number; dy?: number; wheel?: number; buttons?: MouseButton[] };

const BUTTON_BITS: Record<MouseButton, number> = { left: 0x01, right: 0x02, middle: 0x04 };

export function mouseButtonBits(buttons: MouseButton[]): number {
  return buttons.reduce((bits, b) => bits | BUTTON_BITS[b], 0);
}

export function sendMousePacket(machine: NextMachine, buttons: number, dx: number, dy: number, dz: number): void {
  if (dx < -255 || dx > 255 || dy < -255 || dy > 255) throw new Error("A PS/2 packet moves -255..255 per axis");
  if (dz < -8 || dz > 7) throw new Error("A PS/2 wheel delta is -8..7");
  if (machine instanceof ZxNextWasmV2Machine) {
    machine.wasmV2Runtime!.exports.zxnextMousePacket(buttons, dx, dy, dz);
  } else {
    machine.mouseDevice.receivePacket(buttons, dx, dy, dz);
  }
}
