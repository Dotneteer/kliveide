import { Z80RegistersProvider } from "./views/z80-registers";

/**
 * Z80RegisterProvider singleton instance
 */
let z80RegistersProvider: Z80RegistersProvider;

export function setZ80RegisterProvider(provider: Z80RegistersProvider): void {
  z80RegistersProvider = provider;
}

export function getZ80RegisterProvider(): Z80RegistersProvider {
  return z80RegistersProvider;
}
