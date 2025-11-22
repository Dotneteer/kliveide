import { IGenericDevice } from "@emuabstr/IGenericDevice";
import { IC64Machine } from "./IC64Machine";

/**
 * Implementation of the I/O Expansion Port for the Commodore 64
 * The expansion port is used for cartridges and other peripherals,
 * allowing them to map memory and I/O into the system address space.
 * This includes registers in the $DE00-$DFFF range.
 */
export class C64TapeDevice implements IGenericDevice<IC64Machine> {
  private _cassetteSwitchSense: boolean;
  private _motorOn: boolean;
  private _cassetteWrite: boolean;

  /**
   * Initialize the keyboard device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor(public machine: IC64Machine) {
    this.reset();
  }

  /**
   * Resets the state of the tape device.
   */
  reset(): void {
    this._cassetteSwitchSense = false;
  }

  /**
   * Gets the current state of the cassette switch.
   */
  get cassetteSwitchSense(): boolean {
    return this._cassetteSwitchSense;
  }

  /**
   * Sets the current state of the cassette switch.
   */
  set cassetteSwitchSense(value: boolean) {
    this._cassetteSwitchSense = value;
  }

  /**
   * Gets the current state of the motor.
   */
  get motorOn(): boolean {
    return this._motorOn;
  }

  /**
   * Sets the current state of the motor.
   */
  set motorOn(value: boolean) {
    this._motorOn = value;
  }

  /**
   * Gets the current state of the cassette write signal.
   */
  get cassetteWrite(): boolean {
    return this._cassetteWrite;
  }

  /**
   * Sets the current state of the cassette write signal.
   */
  set cassetteWrite(value: boolean) {
    this._cassetteWrite = value;
  }
}