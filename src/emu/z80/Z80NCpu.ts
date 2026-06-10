import { Z80Cpu } from "./Z80Cpu";

export class Z80NCpu extends Z80Cpu {
  allowExtendedInstructions = true;

  tbblueOut(_address: number, _value: number): void {}

  protected flushTbBlueOutput(): void {
    if (this.wasm.z80GetLastTbBlueIsWrite() === 0) {
      return;
    }
    this.tbblueOut(this.wasm.z80GetLastTbBlueAddress(), this.wasm.z80GetLastTbBlueValue());
  }
}
