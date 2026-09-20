import type { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import type { IZ88BeeperDevice } from "./IZ88BeeperDevice";
import type { IZ88BlinkDevice } from "./IZ88BlinkDevice";
import type { IZ88KeyboardDevice } from "./IZ88KeyboardDevice";
import type { IZ88ScreenDevice } from "./IZ88ScreenDevice";
import type { Z88BankedMemory } from "./memory/Z88BankedMemory";

/**
 * The Z88 machine as the TypeScript Z88 devices and memory cards see it: the backend-neutral
 * `IZ88Machine` plus the TypeScript memory and device objects they reach through their host.
 *
 * Only the TypeScript emulation (`Z88Machine`, its devices and cards) uses this interface. The IDE
 * and the renderer talk to `IZ88Machine` / `IZ88IdeMachine`, which a WASM machine implements too.
 */
export interface IZ88DeviceHost extends IZ88Machine {
  /**
   * The physical memory of the machine
   */
  readonly memory: Z88BankedMemory;

  /**
   * Represents the Blink device of Z88
   */
  blinkDevice: IZ88BlinkDevice;

  /**
   * Represents the keyboard device of Z88
   */
  keyboardDevice: IZ88KeyboardDevice;

  /**
   * Represents the screen device of Z88
   */
  screenDevice: IZ88ScreenDevice;

  /**
   * Represents the beeper device of Z88
   */
  beeperDevice: IZ88BeeperDevice;
}
