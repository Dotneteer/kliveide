import * as vscode from "vscode";
import { Z80AsmHoverProvider } from "../z80asm-hover-provider";
import { ZxBasicHoverProvider } from "../zxbasic-hover-provider";

/**
 * object with existent languages hover providers
 */
export var HoverProvider = {
  ZxBasic: ZxBasicHoverProvider,
  Z80Asm: Z80AsmHoverProvider
}

/**
 * Factory class for register langage hover providers
 * https://code.visualstudio.com/api/language-extensions/programmatic-language-features
 */
export abstract class HoverProviderFactory {

  /**
   * Method for register all language hover providers in @see HoverProvider enum
   * @param context vscode extension context
   * @returns array of vscode.Disposable, type which can release resources
   */
  public static registerAll(context: vscode.ExtensionContext): vscode.Disposable[] {

    let providersRegistrations = Object.keys(HoverProvider)
      .map((item: string, _index: number, _array: string[]) => { return HoverProviderFactory.register(context, item); });

    return providersRegistrations;
  }

  /**
   * Method for register a language hover provider
   * @param context vscode extension context
   * @param hoverProviderClassName class name of language hover provider to register
   * @returns vscode.Disposable, type which can release resources
   */
  public static register(context: vscode.ExtensionContext, hoverProviderClassName: string): vscode.Disposable {

    const provider = new (HoverProvider as any)[hoverProviderClassName](context);
    const providerRegistration = vscode.languages.registerHoverProvider(
      provider.language,
      provider
    );

    return providerRegistration;
  }

}