import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { getNonce } from "./utils";

/**
 * Base class for all custom editors
 */
export abstract class EditorProviderBase
  implements vscode.CustomTextEditorProvider {
  /**
   * The path of the "assets" folder within the extension
   */
  readonly assetsPath: string;

  /**
   * The path of the "out" folder within the extension
   */
  readonly outPath: string;

  /**
   * The title of the webview
   */
  abstract readonly title: string;

  /**
   * The name of the html file that is to be used as a template for
   * the contents of the view
   */
  abstract readonly htmlFileName: string;

  /**
   * The replacements that should be carried out on the HTML contents
   * of this panel's view
   */
  getContentReplacements(): ReplacementTuple[] {
    return [];
  }

  /**
   * Resolve a custom editor for a given text resource.
   *
   * @param document Document for the resource to resolve.
   * @param webviewPanel The webview panel used to display the editor UI for this resource.
   * @param token A cancellation token that indicates the result is no longer needed.
   * @return Thenable indicating that the custom editor has been resolved.
   */
  abstract async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void>;

  /**
   * Instantiates the editor provider
   * @param context Extension context
   */
  constructor(protected readonly context: vscode.ExtensionContext) {
    this.outPath = this.getExtensionPath("out");
    this.assetsPath = this.getExtensionPath("out/assets");
  }

  /**
   * Gets the HTML contents belonging to this editor
   * @param webView The webview to get this HTML for
   */
  getHtmlContents(webView: vscode.Webview): string {
    // --- Read the HTML resource file
    let htmlContents: string;
    try {
      htmlContents = fs.readFileSync(
        this.getAssetsFileName(this.htmlFileName),
        "utf8"
      );

      // --- Prepare replacements
      const reps = this.getContentReplacements();
      reps.push(["cspSource", webView.cspSource], ["nonce", getNonce()]);

      // --- Replace the contents
      for (const replEntry of reps) {
        htmlContents = htmlContents
          .split(`$$$${replEntry[0]}$$$`)
          .join(replEntry[1].toString());
      }
    } catch (err) {
      htmlContents = `<p>Error loading HTML resource ${this.htmlFileName}: ${err}</p>`;
    }
    return htmlContents;
  }

  /**
   * Gets the specified path within the extension
   * @param {String[]} path Path within the extension
   */
  protected getExtensionPath(...paths: string[]): string {
    return path.join(this.context.extensionPath, ...paths);
  }

  /**
   * Gets the specified file resource URI
   * @param {String} basePath Base path of the resource within the extension folder
   * @param {String} resource Resource file name
   */
  protected getFileResource(basePath: string, resource: string): vscode.Uri {
    const file = vscode.Uri.file(path.join(basePath, resource));
    return file.with({ scheme: "vscode-resource" });
  }

  /**
   * Gets a resource from the "out" extension folder
   * @param {String} resource Resource file name
   */
  protected getOuFileResource(resource: string): vscode.Uri {
    return this.getFileResource(this.outPath, resource);
  }

  /**
   * Gets a resource from the "assets" extension folder
   * @param {String} resource Resource file name
   */
  protected getAssetsFileResource(resource: string): vscode.Uri {
    return this.getFileResource(this.assetsPath, resource);
  }

  /**
   * Gets a file name from the "out" extension folder
   * @param {String} filename Filename
   */
  protected getOuFileName(filename: string): string {
    return path.join(this.outPath, filename);
  }

  /**
   * Gets a file name from the "assets" extension folder
   * @param {String} filename Filename
   */
  protected getAssetsFileName(filename: string): string {
    return path.join(this.assetsPath, filename);
  }
}

/**
 * This type defines a replacement tuple
 */
export type ReplacementTuple = [string, string | vscode.Uri];
