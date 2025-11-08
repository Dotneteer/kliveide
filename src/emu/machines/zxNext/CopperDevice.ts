import type { IGenericDevice } from "@emuabstr/IGenericDevice";
import type { IZxNextMachine } from "@emuabstr/IZxNextMachine";

export enum CopperStartMode {
  FullyStopped = 0,
  StartFromZeroAndLoop = 1,
  StartFromLastPointAndLoop = 2,
  StartFromZeroRestartOnPositionReached = 3
}

export class CopperDevice implements IGenericDevice<IZxNextMachine> {
  private readonly _memory: Uint8Array = new Uint8Array(0x2000);
  private _startMode: CopperStartMode;
  private _instructionAddress: number;
  private _storedByte: number;

  verticalLineOffset: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this._startMode = CopperStartMode.FullyStopped;
    this._instructionAddress = 0;
    this._storedByte = 0;
    this.verticalLineOffset = 0;
  }

  readMemory(address: number): number {
    return this._memory[address];
  }

  get startMode(): CopperStartMode {
    return this._startMode;
  }

  get instructionAddress(): number {
    return this._instructionAddress;
  }

  setInstructionAddress(address: number): void {
    this._instructionAddress = address;
  }

  set nextReg60Value(value: number) {
    this._memory[this._instructionAddress] = value & 0xff;
    this._instructionAddress = (this._instructionAddress + 1) & 0x7ff;
  }

  get nextReg61Value(): number {
    return this._instructionAddress & 0xff;
  }

  set nextReg61Value(value: number) {
    this._instructionAddress = (this._instructionAddress & 0x700) | (value & 0xff);
  }

  get nextReg62Value(): number {
    return (this._startMode << 6) | ((this._instructionAddress & 0x700) >> 8);
  }

  set nextReg62Value(value: number) {
    this._startMode = (value & 0xc0) >> 6;
    this._instructionAddress = ((value & 0x07) << 8) | (this._instructionAddress & 0xff);
  }

  set nextReg63Value(value: number) {
    if (this._instructionAddress & 0x0001) {
      this._memory[this._instructionAddress & 0x7fe] = this._storedByte;
      this._memory[this._instructionAddress] = value;
    }
    this._storedByte = value;
    this._instructionAddress = (this._instructionAddress + 1) & 0x7ff;
  }

  dispose(): void {}
}
