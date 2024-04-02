/**
 * ZCC wrapper to invoke the ZCC process
 */
class ZccImplementation {
  target?: string;
  verbose?: boolean;
  outputBaseName?: string;
  cpuTarget?: string;
  subType?: string;
  clib?: string;
  crt0?: string;
  startupLib?: string;
  noCrt?: boolean;
  startup?: number;
  zorg?: number;
  noStdLib?: boolean;
  pragmaRedirect?: string;
  pragmaDefine?: string;
  pragmaOutput?: string;
  pragmaExport?: string;
  pragmaNeed?: string;
  pragmaBytes?: string;
  pragmaString?: string;
  pragmaInclude?: string;
  m4?: boolean;
  preprocessOnly?: boolean;
  dD?: boolean;
  compileOnly?: boolean;
  assembleOnly?: boolean;
  makeLib?: boolean;
  explicitC?: boolean;
  createApp?: boolean;





  /**
   * Executes the ZCC process
   */
  execute(): void {
    // TODO: Implement this
  }
}

type CpuDescriptor = {
    id: string;
    descr: string;
}
const cpuTargets: CpuDescriptor[] = [
    { id: "8080", descr: "Intel 8080" },
    { id: "8085", descr: "Intel 8085" },
    { id: "z80", descr: "Zilog Z80" },
    { id: "z80_ixiy", descr: "Zilog Z80 with IY/IY swap" },
    { id: "z80_strict", descr: "Zilog Z80 with documented Z80 instruction set" },
    { id: "z80n", descr: "Z80N (Next) instruction set" },
    { id: "z180", descr: "Zilog Z180" },
    { id: "r2ka", descr: "Rabbit 2000" },
    { id: "r3k", descr: "Rabbit 3000" },
    { id: "r4k", descr: "Rabbit 4000" },
    { id: "gbz8", descr: "Gameboy Z80" },
    { id: "ez80_z80", descr: "Zilog eZ80 in Z80 mode" },
    { id: "kc160", descr: "KC160 (Z80 mode)" },

]

export const Zcc = new ZccImplementation();