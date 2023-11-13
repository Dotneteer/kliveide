import { SpectrumKeyCode } from "@renderer/abstractions/SpectrumKeyCode";

/**
 * Stores and manages tracking keypresses
 */
export class KeyPressMapper {
  private keypress = new Set<SpectrumKeyCode>();

  setKeyStatus (code: SpectrumKeyCode, down: boolean): void {
    if (down) {
      this.keypress.add(code);
    } else {
      this.keypress.delete(code);
    }
  }

  isPressed (code: SpectrumKeyCode, secondary?: SpectrumKeyCode): boolean {
    return (
      this.keypress.has(code) &&
      (secondary === undefined || this.keypress.has(secondary))
    );
  }
}
