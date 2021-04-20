import * as vscode from "vscode";
import { ZxBasicKeyword } from "../keywords/zxbasic-keyword";
import { HoverProviderBase } from "./common/hover-provider-base";

/**
 * ZxBasic language hover provider 
 */
export class ZxBasicHoverProvider extends HoverProviderBase implements vscode.HoverProvider {

  private composedKeywords: string[] = ["GO", "TO", "SUB", "ELSE", "IF"]

  /**
   * default constructor
   * @param context Extension context
   */
  constructor(protected readonly context: vscode.ExtensionContext) { super(context) }

  /**
   * ZxBasic language provider
   */
  protected get language() { return "zxbasic"; }


  /**
   * @see HoverProviderBase.customProviderHover definition
   */
  protected createHoverText(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): string {

    const wordRange = document.getWordRangeAtPosition(position);
    let languageToken = document.getText(wordRange);

    // set limit to token and only allow chars
    if (!languageToken || !/[a-zA-Z]+/.test(languageToken) || languageToken.length > 70) return;

    // compose keywords
    if (this.composedKeywords.includes(languageToken)) languageToken = this.tryGetComposedKeyword(languageToken, document, position);

    // find keyword
    let keyword = ZxBasicKeyword.findKeyword(languageToken);

    // format output
    return keyword ? `### [${keyword.keyword}](${keyword.link}) \n${keyword.description}` : null;
  }

  private tryGetComposedKeyword(languageToken: string, document: vscode.TextDocument, position: vscode.Position): string {

    // get hover line text
    const line = document.lineAt(position.line).text;

    const nextKeyword: string = line.substring(position.character).split(" ")[1];
    const previousKeyword: string = line.substring(0, position.character).split(" ").slice(-2)[0];

    let result: string;
    switch (languageToken) {
      case "GO":
      case "ELSE":
        // join next word
        if (this.composedKeywords.includes(nextKeyword)) result = `${languageToken}${nextKeyword}`;
      case "SUB":
      case "TO":
      case "IF":
        // join previous word
        if (this.composedKeywords.includes(previousKeyword)) result = `${previousKeyword}${languageToken}`;
        break;
    }

    return result || languageToken;
  }

}