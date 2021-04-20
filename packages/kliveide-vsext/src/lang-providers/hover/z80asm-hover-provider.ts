import * as vscode from "vscode";
import { HoverProviderBase } from "./common/hover-provider-base";
import { Z80AsmKeywords } from "../keywords/z80asm-keyword";


/**
 * Z80 Assembler language hover provider
 */
export class Z80AsmHoverProvider extends HoverProviderBase implements vscode.HoverProvider {

  /**
   * default constructor
   * @param context Extension context
   */
  constructor(protected readonly context: vscode.ExtensionContext) { super(context) }

  /**
   * Z80 Assembler language provider
   */
  protected get language() { return "z80asm"; }


  /**
   * @see HoverProviderBase.customProviderHover definition
   */
  protected createHoverText(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): string {

    // get hover line text
    const textLine = document.lineAt(position.line).text;

    let keyword = Z80AsmKeywords.findKeyword(textLine);

    return keyword ?
      `### ${keyword.groupName} **[${keyword.keyword}](${keyword.link})** \n
**Operation:** *${keyword.operation}* \n
**Operands:** *${keyword.operands}* \n
**Condition bits affecteds:** *${keyword.conditionBitsAffected}* \n
~~~
Description: ${keyword.description} \n
${keyword.example ? "Example: " + keyword.example : ""}
~~~\n` : null;

  }
}
