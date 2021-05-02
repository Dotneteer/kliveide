/**
 * Event arguments when pressing a key on the ZX Spectrum 48 virtual keyboard
 */
export interface Sp48ButtonClickArgs {
  code: number;
  keyCategory: string;
  button: number;
  down: boolean;
}

/**
 * Event arguments when pressing a key on the Cambridge Z88 virtual keyboard
 */
 export interface Z88ButtonClickArgs {
  code: number;
  keyCategory: string;
  down: boolean;
  isLeft: boolean;
  iconCount: number;
  special?: string;
}
