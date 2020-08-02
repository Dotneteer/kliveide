/**
 * Represents Z80 Registers data
 */
export interface RegisterData {
  af: number;
  bc: number;
  de: number;
  hl: number;
  af_: number;
  bc_: number;
  de_: number;
  hl_: number;
  pc: number;
  sp: number;
  ix: number;
  iy: number;
  i: number;
  r: number;
  wz: number;
}
