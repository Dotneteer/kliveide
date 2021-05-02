import * as vscode from "vscode";

/**
 * Base class for declare language hover provider
 */
export abstract class HoverProviderBase implements vscode.HoverProvider {

  /**
   * default constructor
   * @param context Extension context
   */
  constructor(protected readonly context: vscode.ExtensionContext) { }

  /**
   * Property to define in inherited classes to specify language id used in language hover provider
   */
  protected abstract get language(): string;

  /**
   * Custom method to define in inherited classes to create hover language details   
   * @param document text document
   * @param position cursor position
   * @param token cancelation token
   * @returns markdown formated string to show in UI
   */
  protected abstract createHoverText(
    document: vscode.TextDocument,
    position: vscode.Position,
    cancellationToken: vscode.CancellationToken): string;


  /**
   * @see vscode.HoverProvider definition
   * Provide a hover for the given position and document. Multiple hovers at the same
   * position will be merged by the editor. A hover can have a range which defaults
   * to the word range at the position when omitted.
   *
   * @param document The document in which the command was invoked.
   * @param position The position at which the command was invoked.
   * @param cancellationToken A cancellation token.
   * @return A hover or a thenable that resolves to such. The lack of a result can be
   * signaled by returning `undefined` or `null`.
   */
  provideHover(document: vscode.TextDocument, position: vscode.Position, cancellationToken: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {

    let result: vscode.ProviderResult<vscode.Hover>;

    try {

      // call inherited method
      const details: string = this.createHoverText(document, position, cancellationToken);

      // format details for show in UI
      if (details) {
        result = { contents: [new vscode.MarkdownString(details)] };
      }

    }
    catch (e) { console.log(e.message); }

    return result;
  }
}