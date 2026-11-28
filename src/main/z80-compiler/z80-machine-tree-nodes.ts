import { TypedObject } from "@main/compiler-common/abstractions";
import { CommonTokenType } from "@main/compiler-common/common-tokens";
import { Expression, PartialAssemblyLine } from "@main/compiler-common/tree-nodes";

// ============================================================================
// The syntax nodes of the pragmas that belong to the machines Klive's Z80 assembler targets, not to the
// CPU-neutral core: the ZX Spectrum Next's `.savenex`, `.dma` and `.copper`, and the ZX80/ZX81's `.defzx`.

/**
 * Every machine pragma of the Z80 assembler
 */
export type Z80MachinePragma<TNode extends TypedObject, TToken extends CommonTokenType> =
  | DefZxPragma<TNode, TToken>
  | SaveNexPragma<TNode, TToken>
  | DmaPragma<TNode, TToken>
  | CopperPragma<TNode, TToken>;

/**
 * `.defzx "TEXT"`: text in the ZX80's or ZX81's own character set (`.model ZX80`/`ZX81` only);
 * a lower-case letter gives the inverse-video capital
 */
export interface DefZxPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "DefZxPragma";

  /**
   * Pragma value
   */
  value: Expression<TNode, TToken>;
}

/**
 * SaveNex pragma types for ZX Spectrum Next NEX file generation
 */
export type SaveNexPragma<TNode extends TypedObject, TToken extends CommonTokenType> =
  | SaveNexFilePragma<TNode, TToken>
  | SaveNexRamPragma<TNode, TToken>
  | SaveNexBorderPragma<TNode, TToken>
  | SaveNexCorePragma<TNode, TToken>
  | SaveNexStackAddrPragma<TNode, TToken>
  | SaveNexEntryAddrPragma<TNode, TToken>
  | SaveNexEntryBankPragma<TNode, TToken>
  | SaveNexFileHandlePragma<TNode, TToken>
  | SaveNexPreservePragma<TNode, TToken>
  | SaveNexScreenPragma<TNode, TToken>
  | SaveNexPalettePragma<TNode, TToken>
  | SaveNexCopperPragma<TNode, TToken>
  | SaveNexBarPragma<TNode, TToken>;

export interface SaveNexFilePragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "SaveNexFilePragma";
  filename: Expression<TNode, TToken>;
}

export interface SaveNexRamPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "SaveNexRamPragma";
  size: Expression<TNode, TToken>;
}

export interface SaveNexBorderPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "SaveNexBorderPragma";
  color: Expression<TNode, TToken>;
}

export interface SaveNexCorePragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "SaveNexCorePragma";
  major: Expression<TNode, TToken>;
  minor?: Expression<TNode, TToken>;
  subminor?: Expression<TNode, TToken>;
}

export interface SaveNexStackAddrPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "SaveNexStackAddrPragma";
  address: Expression<TNode, TToken>;
}

export interface SaveNexEntryAddrPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "SaveNexEntryAddrPragma";
  address: Expression<TNode, TToken>;
}

export interface SaveNexEntryBankPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "SaveNexEntryBankPragma";
  bankNo: Expression<TNode, TToken>;
}

export interface SaveNexFileHandlePragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "SaveNexFileHandlePragma";
  mode: Expression<TNode, TToken>; // 0/"close", "bc", or address
}

export interface SaveNexPreservePragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "SaveNexPreservePragma";
  value: Expression<TNode, TToken>; // "on"/"off" or 0/1
}

export interface SaveNexScreenPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "SaveNexScreenPragma";
  screenType: Expression<TNode, TToken>; // l2, ula, lores, hires, hicolor, l2_320, l2_640
  filename: Expression<TNode, TToken>;
  paletteFile?: Expression<TNode, TToken>;
  paletteOffset?: Expression<TNode, TToken>;
}

export interface SaveNexPalettePragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "SaveNexPalettePragma";
  filename: Expression<TNode, TToken>;
}

export interface SaveNexCopperPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "SaveNexCopperPragma";
  filename: Expression<TNode, TToken>;
}

export interface SaveNexBarPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "SaveNexBarPragma";
  enabled: Expression<TNode, TToken>; // "on"/"off" or 0/1
  color?: Expression<TNode, TToken>;
  delay?: Expression<TNode, TToken>;
  startDelay?: Expression<TNode, TToken>;
}

// ============================================================================
// DMA pragma nodes

/**
 * Union of all .dma sub-command pragma node types
 */
export type DmaPragma<TNode extends TypedObject, TToken extends CommonTokenType> =
  | DmaResetPragma<TNode>
  | DmaLoadPragma<TNode>
  | DmaEnablePragma<TNode>
  | DmaDisablePragma<TNode>
  | DmaContinuePragma<TNode>
  | DmaCmdPragma<TNode, TToken>
  | DmaReadMaskPragma<TNode, TToken>
  | DmaWr0Pragma<TNode, TToken>
  | DmaWr1Pragma<TNode>
  | DmaWr2Pragma<TNode, TToken>
  | DmaWr3Pragma<TNode, TToken>
  | DmaWr4Pragma<TNode, TToken>
  | DmaWr5Pragma<TNode>;

export interface DmaResetPragma<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "DmaResetPragma";
}

export interface DmaLoadPragma<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "DmaLoadPragma";
}

export interface DmaEnablePragma<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "DmaEnablePragma";
}

export interface DmaDisablePragma<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "DmaDisablePragma";
}

export interface DmaContinuePragma<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "DmaContinuePragma";
}

export interface DmaCmdPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "DmaCmdPragma";
  value: Expression<TNode, TToken>;
}

export interface DmaReadMaskPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "DmaReadMaskPragma";
  mask: Expression<TNode, TToken>;
}

export interface DmaWr0Pragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "DmaWr0Pragma";
  direction: "a_to_b" | "b_to_a";
  transferType: "transfer" | "search" | "search_transfer";
  portAAddr?: Expression<TNode, TToken>;
  blockLength?: Expression<TNode, TToken>;
}

export interface DmaWr1Pragma<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "DmaWr1Pragma";
  portType: "memory" | "io";
  addrMode: "increment" | "decrement" | "fixed";
  cycleLength?: "2t" | "3t" | "4t";
}

export interface DmaWr2Pragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "DmaWr2Pragma";
  portType: "memory" | "io";
  addrMode: "increment" | "decrement" | "fixed";
  cycleLength?: "2t" | "3t" | "4t";
  prescaler?: Expression<TNode, TToken>;
}

export interface DmaWr3Pragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "DmaWr3Pragma";
  dmaEnable?: boolean;
  stopOnMatch?: boolean;
  intEnable?: boolean;
  mask?: Expression<TNode, TToken>;
  match?: Expression<TNode, TToken>;
}

export interface DmaWr4Pragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "DmaWr4Pragma";
  mode: "byte" | "continuous" | "burst";
  portBAddr?: Expression<TNode, TToken>;
}

export interface DmaWr5Pragma<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "DmaWr5Pragma";
  autoRestart?: boolean;
}

// ============================================================================
// Copper pragma nodes

/**
 * Union of all .copper sub-command pragma node types
 */
export type CopperPragma<TNode extends TypedObject, TToken extends CommonTokenType> =
  | CopperWaitPragma<TNode, TToken>
  | CopperMovePragma<TNode, TToken>
  | CopperNopPragma<TNode>
  | CopperHaltPragma<TNode>
  | CopperWordPragma<TNode, TToken>;

/** `.copper wait <line>, <hpos>` */
export interface CopperWaitPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "CopperWaitPragma";
  /** Not `line`: that is the node's source line (`NodePosition`) */
  waitLine: Expression<TNode, TToken>;
  waitHpos: Expression<TNode, TToken>;
}

/** `.copper move <reg>, <value>` */
export interface CopperMovePragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "CopperMovePragma";
  reg: Expression<TNode, TToken>;
  value: Expression<TNode, TToken>;
}

/** `.copper nop` */
export interface CopperNopPragma<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "CopperNopPragma";
}

/** `.copper halt` */
export interface CopperHaltPragma<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "CopperHaltPragma";
}

/** `.copper word <expr>` */
export interface CopperWordPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "CopperWordPragma";
  value: Expression<TNode, TToken>;
}
