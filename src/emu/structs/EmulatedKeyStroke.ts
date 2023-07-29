import { SpectrumKeyCode } from "../../renderer/abstractions/SpectrumKeyCode";

/**
 * This class represents the information about an emulated key press
 */
export class EmulatedKeyStroke {
  constructor (
    public startTact: number,
    public endTact: number,
    public primaryCode: SpectrumKeyCode,
    public secondaryCode?: SpectrumKeyCode
  ) {}

  /**
   * Returns a string that represents the current object.
   */
  toString () {
    return (
      `S:${this.startTact}, E:${this.endTact}, L:${
        this.endTact - this.startTact
      }, ` + `${this.primaryCode}-${this.secondaryCode}`
    );
  }
}
