/**
 * How host input reaches a ZX Spectrum Next, whichever core runs it.
 *
 * The emulated joystick connectors and the Kempston mouse are already complete in both cores, but
 * until this contract existed nothing in `src/` could drive them: the only callers of the WASM
 * exports were the test harness. These two methods are the whole host-input surface.
 *
 * Deliberately **not** part of `IZxNextIdeMachine`, which is what the IDE panels *read*. This file
 * imports nothing, so a renderer hook can type against it without pulling emulation into the WASM
 * machine's import graph - which `test/wasm/zxNext/wasm-next-separation.test.ts` fails on, even for
 * a type import.
 */

/** The two joystick sockets. `left` is joystick 1 in NextReg `$05`, `right` is joystick 2. */
export type JoystickConnector = "left" | "right";

/**
 * The connector's 12 output bits, active high, as `md6_joystick_connector_x2.vhd` reports them.
 *
 * The host sets these pins and nothing else. NextReg `$05` decides what they *mean*: a Kempston
 * mode puts them on port `$1F` / `$37`, an MD mode adds A and START, and the Sinclair, Cursor and
 * user-defined modes make the core press membrane keys through the joymap. So one host binding
 * table serves every joystick mode, and it keeps working when a program changes `$05` mid-game.
 */
export const JOY_RIGHT = 0x001;
export const JOY_LEFT = 0x002;
export const JOY_DOWN = 0x004;
export const JOY_UP = 0x008;
/** Fire 1 (pin 6). */
export const JOY_B = 0x010;
/** Fire 2 (pin 9). */
export const JOY_C = 0x020;
/** MD pads only, from here down. */
export const JOY_A = 0x040;
export const JOY_START = 0x080;
export const JOY_Y = 0x100;
export const JOY_Z = 0x200;
export const JOY_X = 0x400;
export const JOY_MODE = 0x800;

/** Mouse buttons as a packet carries them: 1 = pressed, in the order the hardware uses. */
export const MOUSE_LEFT = 0x01;
export const MOUSE_RIGHT = 0x02;
export const MOUSE_MIDDLE = 0x04;

export interface IZxNextHostInputMachine {
  /**
   * Hold exactly these connector bits. The value is the whole pin state, not a change: releasing a
   * direction means sending the word without it.
   */
  setJoystickState(side: JoystickConnector, bits: number): void;

  /**
   * Deliver one PS/2 mouse packet - the only way the hardware ever learns about the mouse.
   *
   * `buttons` are held until the next packet names them. `dx` / `dy` are **right and up positive**,
   * so a host that works in screen coordinates negates Y. `dz` is a wheel delta of -8..7.
   *
   * Each delta must fit a signed byte, and the caller should stay well inside that: the core scales
   * the packet by NextReg `$0A`'s DPI *before* adding it to its 8-bit counter, and at DPI `00` that
   * doubles the byte - so anything past ±63 can arrive at the guest as movement in the opposite
   * direction. Split a larger movement across several packets, which is what a real mouse reporting
   * at 100-200 Hz does anyway.
   */
  mousePacket(buttons: number, dx: number, dy: number, dz: number): void;

  /**
   * How many times the CPU has read a mouse port since power-on.
   *
   * Not a hardware register - it exists so the host can tell whether software is *using* the mouse.
   * A program that polls the counters draws its own pointer, and the host's own indicator would
   * then be a second pointer drifting away from it (different origin, the machine's DPI scaling,
   * and counters that wrap where an indicator clamps). Rising means "something is reading me": the
   * host compares it with what it saw last frame.
   */
  mousePortReadCount(): number;

  /**
   * What the core multiplies each packet delta by before adding it to its counters - the DPI in
   * NextReg `$0A` bits 1-0: `00` doubles, `01` keeps, `10` and `11` halve and quarter.
   *
   * The host needs it to draw an honest indicator. Its own pointer moves by the host movement,
   * while the machine's moves by that movement scaled here, so at DPI `00` the machine's pointer
   * travels exactly twice as far - which looks like a bug in the delivery and is not one. Software
   * changes this register whenever it likes, so it is read per frame rather than cached.
   */
  mouseDeltaScale(): number;
}
