import { CommonTokens } from "@main/compiler-common/common-tokens";
import { CommonAsmParser, ParsePoint } from "@main/compiler-common/common-asm-parser";
import { Expression, PartialAssemblyLine } from "@main/compiler-common/tree-nodes";
import { CommonTokenType } from "@main/compiler-common/common-tokens";
import type { Z80Node } from "./assembler-tree-nodes";
import { Z80Tokens, Z80TokenType } from "./z80-token-stream";
import {
  CopperHaltPragma,
  CopperMovePragma,
  CopperNopPragma,
  CopperWaitPragma,
  CopperWordPragma,
  DmaCmdPragma,
  DmaContinuePragma,
  DmaDisablePragma,
  DmaEnablePragma,
  DmaLoadPragma,
  DmaReadMaskPragma,
  DmaResetPragma,
  DmaWr0Pragma,
  DmaWr1Pragma,
  DmaWr2Pragma,
  DmaWr3Pragma,
  DmaWr4Pragma,
  DmaWr5Pragma,
  SaveNexBarPragma,
  SaveNexBorderPragma,
  SaveNexCopperPragma,
  SaveNexCorePragma,
  SaveNexEntryAddrPragma,
  SaveNexEntryBankPragma,
  SaveNexFileHandlePragma,
  SaveNexFilePragma,
  SaveNexPalettePragma,
  SaveNexPreservePragma,
  SaveNexRamPragma,
  SaveNexScreenPragma,
  SaveNexStackAddrPragma,
  DefZxPragma,
} from "./z80-machine-tree-nodes";

/**
 * Parses the pragmas of the machines Klive's Z80 assembler targets: the ZX Spectrum Next's `.savenex`,
 * `.dma` and `.copper`, and the ZX80/ZX81's `.defzx`. These are not part of the CPU-neutral core; the
 * Z80 instruction parser (`Z80AsmParser`) builds on this class.
 */
export abstract class Z80MachineAsmParser extends CommonAsmParser<Z80Node, Z80TokenType> {
  /**
   * Parses the machine pragmas
   * @param parsePoint The pragma token (already consumed) and its traits
   */
  protected parseCpuPragma(parsePoint: ParsePoint): PartialAssemblyLine<Z80Node> | null {
    switch (parsePoint.start.type) {
      case Z80Tokens.DefzxPragma:
        return {
          type: "DefZxPragma",
          value: this.getExpression()
        } as DefZxPragma<Z80Node, Z80TokenType>;
      case Z80Tokens.SaveNexPragma:
        return this.parseSaveNexPragma();
      case Z80Tokens.DmaPragma:
        return this.parseDmaPragma();
      case Z80Tokens.CopperPragma:
        return this.parseCopperPragma();
    }
    return null;
  }

  /**
   * `.defzx` emits bytes, so a structure field can be assigned with it
   * @param tokenType Pragma token type
   */
  protected isCpuByteEmittingPragma(tokenType: CommonTokenType): boolean {
    return tokenType === Z80Tokens.DefzxPragma;
  }

  /**
   * Parses a .savenex pragma by reading the subcommand and routing to the appropriate parser
   */
  private parseSaveNexPragma(): PartialAssemblyLine<Z80Node> | null {
    const subcommand = this.tokens.peek();
    if (subcommand.type !== CommonTokens.Identifier) {
      this.reportError("Z0346"); // Unknown subcommand
      return null;
    }

    const subcmdText = subcommand.text?.toLowerCase();
    this.tokens.get(); // consume the subcommand identifier

    switch (subcmdText) {
      case "file":
        return this.parseSaveNexFile();
      case "ram":
        return this.parseSaveNexRam();
      case "border":
        return this.parseSaveNexBorder();
      case "core":
        return this.parseSaveNexCore();
      case "stackaddr":
        return this.parseSaveNexStackAddr();
      case "entryaddr":
        return this.parseSaveNexEntryAddr();
      case "entrybank":
        return this.parseSaveNexEntryBank();
      case "filehandle":
        return this.parseSaveNexFileHandle();
      case "preserve":
        return this.parseSaveNexPreserve();
      case "screen":
        return this.parseSaveNexScreen();
      case "palette":
        return this.parseSaveNexPalette();
      case "copper":
        return this.parseSaveNexCopper();
      case "bar":
        return this.parseSaveNexBar();
      default:
        this.reportError("Z0346"); // Unknown subcommand
        return null;
    }
  }

  private parseSaveNexFile(): SaveNexFilePragma<Z80Node, Z80TokenType> {
    const filename = this.getExpression();
    return {
      type: "SaveNexFilePragma",
      filename
    } as SaveNexFilePragma<Z80Node, Z80TokenType>;
  }

  private parseSaveNexRam(): SaveNexRamPragma<Z80Node, Z80TokenType> {
    const size = this.getExpression();
    return {
      type: "SaveNexRamPragma",
      size
    } as SaveNexRamPragma<Z80Node, Z80TokenType>;
  }

  private parseSaveNexBorder(): SaveNexBorderPragma<Z80Node, Z80TokenType> {
    const color = this.getExpression();
    return {
      type: "SaveNexBorderPragma",
      color
    } as SaveNexBorderPragma<Z80Node, Z80TokenType>;
  }

  private parseSaveNexCore(): SaveNexCorePragma<Z80Node, Z80TokenType> {
    const major = this.getExpression();
    const minor = this.getExpression(true, true);
    const subminor = minor ? this.getExpression(true, true) : null;
    return {
      type: "SaveNexCorePragma",
      major,
      minor,
      subminor
    } as SaveNexCorePragma<Z80Node, Z80TokenType>;
  }

  private parseSaveNexStackAddr(): SaveNexStackAddrPragma<Z80Node, Z80TokenType> {
    const address = this.getExpression();
    return {
      type: "SaveNexStackAddrPragma",
      address
    } as SaveNexStackAddrPragma<Z80Node, Z80TokenType>;
  }

  private parseSaveNexEntryAddr(): SaveNexEntryAddrPragma<Z80Node, Z80TokenType> {
    const address = this.getExpression();
    return {
      type: "SaveNexEntryAddrPragma",
      address
    } as SaveNexEntryAddrPragma<Z80Node, Z80TokenType>;
  }

  private parseSaveNexEntryBank(): SaveNexEntryBankPragma<Z80Node, Z80TokenType> {
    const bankNo = this.getExpression();
    return {
      type: "SaveNexEntryBankPragma",
      bankNo
    } as SaveNexEntryBankPragma<Z80Node, Z80TokenType>;
  }

  private parseSaveNexFileHandle(): SaveNexFileHandlePragma<Z80Node, Z80TokenType> {
    const mode = this.getExpression();
    return {
      type: "SaveNexFileHandlePragma",
      mode
    } as SaveNexFileHandlePragma<Z80Node, Z80TokenType>;
  }

  private parseSaveNexPreserve(): SaveNexPreservePragma<Z80Node, Z80TokenType> {
    const value = this.getExpression();
    return {
      type: "SaveNexPreservePragma",
      value
    } as SaveNexPreservePragma<Z80Node, Z80TokenType>;
  }

  private parseSaveNexScreen(): SaveNexScreenPragma<Z80Node, Z80TokenType> {
    const type = this.getExpression();
    const filename = this.getExpression(true, true);
    const paletteOffset = filename ? this.getExpression(true, true) : null;
    return {
      type: "SaveNexScreenPragma",
      screenType: type,
      filename,
      paletteOffset
    } as SaveNexScreenPragma<Z80Node, Z80TokenType>;
  }

  private parseSaveNexPalette(): SaveNexPalettePragma<Z80Node, Z80TokenType> {
    const filename = this.getExpression();
    return {
      type: "SaveNexPalettePragma",
      filename
    } as SaveNexPalettePragma<Z80Node, Z80TokenType>;
  }

  private parseSaveNexCopper(): SaveNexCopperPragma<Z80Node, Z80TokenType> {
    const filename = this.getExpression();
    return {
      type: "SaveNexCopperPragma",
      filename
    } as SaveNexCopperPragma<Z80Node, Z80TokenType>;
  }

  private parseSaveNexBar(): SaveNexBarPragma<Z80Node, Z80TokenType> {
    const enabled = this.getExpression();
    const color = this.getExpression(true, true);
    const delay = color ? this.getExpression(true, true) : null;
    const startDelay = delay ? this.getExpression(true, true) : null;
    return {
      type: "SaveNexBarPragma",
      enabled,
      color,
      delay,
      startDelay
    } as SaveNexBarPragma<Z80Node, Z80TokenType>;
  }

  // ---------------------------------------------------------------------------
  // .dma pragma sub-parsers

  private parseDmaPragma(): PartialAssemblyLine<Z80Node> | null {
    const subcommand = this.tokens.peek();
    if (subcommand.type !== CommonTokens.Identifier) {
      this.reportError("Z0360");
      return null;
    }
    const subcmdText = subcommand.text?.toLowerCase();
    this.tokens.get(); // consume sub-command identifier

    switch (subcmdText) {
      case "reset":    return { type: "DmaResetPragma" } as DmaResetPragma<Z80Node>;
      case "load":     return { type: "DmaLoadPragma" } as DmaLoadPragma<Z80Node>;
      case "enable":   return { type: "DmaEnablePragma" } as DmaEnablePragma<Z80Node>;
      case "disable":  return { type: "DmaDisablePragma" } as DmaDisablePragma<Z80Node>;
      case "continue": return { type: "DmaContinuePragma" } as DmaContinuePragma<Z80Node>;
      case "cmd":      return this.parseDmaCmd();
      case "readmask": return this.parseDmaReadMask();
      case "wr0":      return this.parseDmaWr0();
      case "wr1":      return this.parseDmaWr1();
      case "wr2":      return this.parseDmaWr2();
      case "wr3":      return this.parseDmaWr3();
      case "wr4":      return this.parseDmaWr4();
      case "wr5":      return this.parseDmaWr5();
      default:
        this.reportError("Z0360");
        return null;
    }
  }

  private parseDmaCmd(): DmaCmdPragma<Z80Node, Z80TokenType> | null {
    const value = this.getExpression();
    if (!value) return null;
    return { type: "DmaCmdPragma", value } as DmaCmdPragma<Z80Node, Z80TokenType>;
  }

  private parseDmaReadMask(): DmaReadMaskPragma<Z80Node, Z80TokenType> | null {
    const mask = this.getExpression();
    if (!mask) return null;
    return { type: "DmaReadMaskPragma", mask } as DmaReadMaskPragma<Z80Node, Z80TokenType>;
  }

  private parseDmaWr0(): DmaWr0Pragma<Z80Node, Z80TokenType> | null {
    // direction keyword (required)
    const dirToken = this.tokens.peek();
    const dirText = dirToken.text?.toLowerCase();
    if (dirToken.type !== CommonTokens.Identifier || (dirText !== "a_to_b" && dirText !== "b_to_a")) {
      this.reportError("Z0361");
      return null;
    }
    this.tokens.get();
    const direction = dirText as "a_to_b" | "b_to_a";

    // comma (required)
    if (!this.skipToken(CommonTokens.Comma)) {
      this.reportError("Z0003");
      return null;
    }

    // transfer type keyword (required)
    const ttToken = this.tokens.peek();
    const ttText = ttToken.text?.toLowerCase();
    if (
      ttToken.type !== CommonTokens.Identifier ||
      (ttText !== "transfer" && ttText !== "search" && ttText !== "search_transfer")
    ) {
      this.reportError("Z0362");
      return null;
    }
    this.tokens.get();
    const transferType = ttText as "transfer" | "search" | "search_transfer";

    // optional portAAddr (with leading comma)
    let portAAddr: Expression<Z80Node, Z80TokenType> | undefined;
    let blockLength: Expression<Z80Node, Z80TokenType> | undefined;
    if (this.skipToken(CommonTokens.Comma)) {
      portAAddr = this.getExpression() ?? undefined;
      if (this.skipToken(CommonTokens.Comma)) {
        blockLength = this.getExpression() ?? undefined;
      }
    }

    return { type: "DmaWr0Pragma", direction, transferType, portAAddr, blockLength } as DmaWr0Pragma<Z80Node, Z80TokenType>;
  }

  private parseDmaWr1(): DmaWr1Pragma<Z80Node> | null {
    // port type keyword (required)
    const ptToken = this.tokens.peek();
    const ptText = ptToken.text?.toLowerCase();
    if (ptToken.type !== CommonTokens.Identifier || (ptText !== "memory" && ptText !== "io")) {
      this.reportError("Z0363");
      return null;
    }
    this.tokens.get();
    const portType = ptText as "memory" | "io";

    // comma + address mode (required)
    if (!this.skipToken(CommonTokens.Comma)) {
      this.reportError("Z0003");
      return null;
    }
    const amToken = this.tokens.peek();
    const amText = amToken.text?.toLowerCase();
    if (
      amToken.type !== CommonTokens.Identifier ||
      (amText !== "increment" && amText !== "decrement" && amText !== "fixed")
    ) {
      this.reportError("Z0364");
      return null;
    }
    this.tokens.get();
    const addrMode = amText as "increment" | "decrement" | "fixed";

    // optional cycle length (with leading comma)
    let cycleLength: "2t" | "3t" | "4t" | undefined;
    if (this.skipToken(CommonTokens.Comma)) {
      cycleLength = this.parseDmaCycleLength();
      if (!cycleLength) return null;
    }

    return { type: "DmaWr1Pragma", portType, addrMode, cycleLength } as DmaWr1Pragma<Z80Node>;
  }

  private parseDmaWr2(): DmaWr2Pragma<Z80Node, Z80TokenType> | null {
    // port type keyword (required)
    const ptToken = this.tokens.peek();
    const ptText = ptToken.text?.toLowerCase();
    if (ptToken.type !== CommonTokens.Identifier || (ptText !== "memory" && ptText !== "io")) {
      this.reportError("Z0363");
      return null;
    }
    this.tokens.get();
    const portType = ptText as "memory" | "io";

    // comma + address mode (required)
    if (!this.skipToken(CommonTokens.Comma)) {
      this.reportError("Z0003");
      return null;
    }
    const amToken = this.tokens.peek();
    const amText = amToken.text?.toLowerCase();
    if (
      amToken.type !== CommonTokens.Identifier ||
      (amText !== "increment" && amText !== "decrement" && amText !== "fixed")
    ) {
      this.reportError("Z0364");
      return null;
    }
    this.tokens.get();
    const addrMode = amText as "increment" | "decrement" | "fixed";

    // optional cycle length (with leading comma)
    let cycleLength: "2t" | "3t" | "4t" | undefined;
    let prescaler: Expression<Z80Node, Z80TokenType> | undefined;
    if (this.skipToken(CommonTokens.Comma)) {
      cycleLength = this.parseDmaCycleLength();
      if (!cycleLength) return null;

      // optional prescaler (with leading comma)
      if (this.skipToken(CommonTokens.Comma)) {
        prescaler = this.getExpression() ?? undefined;
      }
    }

    return { type: "DmaWr2Pragma", portType, addrMode, cycleLength, prescaler } as DmaWr2Pragma<Z80Node, Z80TokenType>;
  }

  private parseDmaWr3(): DmaWr3Pragma<Z80Node, Z80TokenType> {
    const node: DmaWr3Pragma<Z80Node, Z80TokenType> = { type: "DmaWr3Pragma" };

    // Parse optional comma-separated flags and optional mask/match expressions
    while (true) {
      const t = this.tokens.peek();
      if (t.type === CommonTokens.Identifier) {
        const text = t.text?.toLowerCase();
        if (text === "dma_enable") {
          this.tokens.get();
          node.dmaEnable = true;
        } else if (text === "stop_on_match") {
          this.tokens.get();
          node.stopOnMatch = true;
        } else if (text === "int_enable") {
          this.tokens.get();
          node.intEnable = true;
        } else {
          // Unknown identifier — treat as mask expression
          node.mask = this.getExpression() ?? undefined;
          if (this.skipToken(CommonTokens.Comma)) {
            node.match = this.getExpression() ?? undefined;
          }
          break;
        }
      } else if (t.type > 0 && t.type !== CommonTokens.NewLine) {
        // Non-identifier expression token (number, etc.) — treat as mask
        node.mask = this.getExpression() ?? undefined;
        if (this.skipToken(CommonTokens.Comma)) {
          node.match = this.getExpression() ?? undefined;
        }
        break;
      } else {
        // End of line / EOF
        break;
      }

      // Check for comma to continue flag list
      if (!this.skipToken(CommonTokens.Comma)) {
        break;
      }
    }

    return node;
  }

  private parseDmaWr4(): DmaWr4Pragma<Z80Node, Z80TokenType> | null {
    // operating mode keyword (required)
    const modeToken = this.tokens.peek();
    const modeText = modeToken.text?.toLowerCase();
    if (
      modeToken.type !== CommonTokens.Identifier ||
      (modeText !== "byte" && modeText !== "continuous" && modeText !== "burst")
    ) {
      this.reportError("Z0366");
      return null;
    }
    this.tokens.get();
    const mode = modeText as "byte" | "continuous" | "burst";

    // optional portBAddr (with leading comma)
    let portBAddr: Expression<Z80Node, Z80TokenType> | undefined;
    if (this.skipToken(CommonTokens.Comma)) {
      portBAddr = this.getExpression() ?? undefined;
    }

    return { type: "DmaWr4Pragma", mode, portBAddr } as DmaWr4Pragma<Z80Node, Z80TokenType>;
  }

  /**
   * Parses a DMA cycle length token: 2t, 3t, or 4t.
   * These are tokenized as a DecimalLiteral (2/3/4) followed by Identifier 't'.
   */
  private parseDmaCycleLength(): "2t" | "3t" | "4t" | null {
    const numToken = this.tokens.peek();
    if (numToken.type !== CommonTokens.DecimalLiteral) {
      this.reportError("Z0365");
      return null;
    }
    const numText = numToken.text;
    if (numText !== "2" && numText !== "3" && numText !== "4") {
      this.reportError("Z0365");
      return null;
    }
    this.tokens.get(); // consume digit
    const tToken = this.tokens.peek();
    if (tToken.type !== CommonTokens.Identifier || tToken.text?.toLowerCase() !== "t") {
      this.reportError("Z0365");
      return null;
    }
    this.tokens.get(); // consume 't'
    return `${numText}t` as "2t" | "3t" | "4t";
  }

  private parseDmaWr5(): DmaWr5Pragma<Z80Node> {
    let autoRestart: boolean | undefined;
    const t = this.tokens.peek();
    if (t.type === CommonTokens.Identifier && t.text?.toLowerCase() === "auto_restart") {
      this.tokens.get();
      autoRestart = true;
    }
    return { type: "DmaWr5Pragma", autoRestart } as DmaWr5Pragma<Z80Node>;
  }

  // ---------------------------------------------------------------------------
  // .copper pragma sub-parsers

  private parseCopperPragma(): PartialAssemblyLine<Z80Node> | null {
    // --- `nop` and `halt` are Z80 keywords, not identifiers: take the sub-command by its text
    const subcommand = this.tokens.peek();
    const subcmdText = subcommand.text ?? "";
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(subcmdText)) {
      this.reportError("Z0371", subcommand, [subcmdText]);
      return null;
    }
    this.tokens.get(); // consume sub-command

    switch (subcmdText.toLowerCase()) {
      case "wait": {
        const waitLine = this.getExpression();
        if (!waitLine) return null;
        const waitHpos = this.getExpression(false, true);
        if (!waitHpos) return null;
        return { type: "CopperWaitPragma", waitLine, waitHpos } as CopperWaitPragma<Z80Node, Z80TokenType>;
      }
      case "move": {
        const reg = this.getExpression();
        if (!reg) return null;
        const value = this.getExpression(false, true);
        if (!value) return null;
        return { type: "CopperMovePragma", reg, value } as CopperMovePragma<Z80Node, Z80TokenType>;
      }
      case "nop":
        return { type: "CopperNopPragma" } as CopperNopPragma<Z80Node>;
      case "halt":
        return { type: "CopperHaltPragma" } as CopperHaltPragma<Z80Node>;
      case "word": {
        const value = this.getExpression();
        if (!value) return null;
        return { type: "CopperWordPragma", value } as CopperWordPragma<Z80Node, Z80TokenType>;
      }
      default:
        this.reportError("Z0371", subcommand, [subcmdText]);
        return null;
    }
  }
}
