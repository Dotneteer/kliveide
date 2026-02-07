import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class UlaDevice implements IGenericDevice<IZxNextMachine> {
  // --- Last value of bit 3 on port $FE
  private _portBit3LastValue = false;

  // --- Last value of bit 4 on port $FE
  private _portBit4LastValue = false;

  // --- Tacts value when last time bit 4 of $fe changed from 0 to 1
  private _portBit4ChangedFrom0Tacts = 0;

  // --- Tacts value when last time bit 4 of $fe changed from 1 to 0
  private _portBit4ChangedFrom1Tacts = 0;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this._portBit3LastValue = false;
    this._portBit4LastValue = false;
    this._portBit4ChangedFrom0Tacts = 0;
    this._portBit4ChangedFrom1Tacts = 0;
  }

  /**
   * Reads a byte from the ZX Spectrum generic input port.
   * @param address Port address
   * @returns Byte value read from the generic port
   */
  readPort0xfe(address: number): number {
    var portValue = this.machine.keyboardDevice.getKeyLineStatus(address);

    // --- Handle analog EAR bit
    var bit4Sensed = this._portBit4LastValue;
    if (!bit4Sensed) {
      // --- Changed later to 1 from 0 than to 0 from 1?
      let chargeTime = this._portBit4ChangedFrom1Tacts - this._portBit4ChangedFrom0Tacts;
      if (chargeTime > 0) {
        // --- Yes, calculate charge time
        chargeTime = chargeTime > 700 ? 2800 : 4 * chargeTime;

        // --- Calculate time ellapsed since last change from 1 to 0
        bit4Sensed = this.machine.tacts - this._portBit4ChangedFrom1Tacts < chargeTime;
      }

      // --- Calculate bit 6 value
      var bit6Value = this._portBit3LastValue ? 0x40 : bit4Sensed ? 0x40 : 0x00;

      // --- Check for ULA 3
      if (!bit4Sensed) {
        bit6Value = 0x00;
      }

      // --- Merge bit 6 with port value
      portValue = ((portValue & 0xbf) | bit6Value) & 0xff;
    }
    return portValue;
  }

  /**
   * Wites the specified data byte to the ZX Spectrum generic output port.
   * @param value Data byte to write
   */
  writePort0xfe(value: number): void {
    // --- Extract the border color
    this.machine.composedScreenDevice.borderColor = value & 0x07;

    // --- Store the last EAR bit
    var bit4 = value & 0x10;
    this.machine.beeperDevice.setEarBit(bit4 !== 0);

    // --- Set the last value of bit3
    this._portBit3LastValue = (value & 0x08) !== 0;

    // --- Manage bit 4 value
    if (this._portBit4LastValue) {
      // --- Bit 4 was 1, is it now 0?
      if (!bit4) {
        this._portBit4ChangedFrom1Tacts = this.machine.tacts;
        this._portBit4LastValue = false;
      }
    } else {
      // --- Bit 4 was 0, is it now 1?
      if (bit4) {
        this._portBit4ChangedFrom0Tacts = this.machine.tacts;
        this._portBit4LastValue = true;
      }
    }
  }
}
