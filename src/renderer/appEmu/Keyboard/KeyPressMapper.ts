import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";

/**
 * Stores and manages tracking keypresses
 */
export class KeyPressMapper {
  private keypress = new Set<number>();

  setKeyStatus (code: number, down: boolean): void {
    if (down) {
      this.keypress.add(code);
    } else {
      this.keypress.delete(code);
    }
  }

  isPressed (code: number, secondary?: number, ternary?: number): boolean {
    return (
      this.keypress.has(code) &&
      (secondary === undefined || this.keypress.has(secondary)) &&
      (ternary === undefined || this.keypress.has(ternary))
    );
  }
}
