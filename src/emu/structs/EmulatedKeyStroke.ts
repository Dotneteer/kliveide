/**
 * This class represents the information about an emulated key press
 */
export class EmulatedKeyStroke {
  constructor (
    public startTact: number,
    public endTact: number,
    public primaryCode: number,
    public secondaryCode?: number,
    public ternaryCode?: number
  ) {}
}
