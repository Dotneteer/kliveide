import * as vscode from "vscode";

import {
  EditorProviderBase,
  ReplacementTuple,
} from "../editor-base";
import { getAssetsFileResource } from "../../extension-paths";

export class BasicEditorProvider extends EditorProviderBase {
  private static readonly viewType = "kliveide.basicEditor";

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new BasicEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      BasicEditorProvider.viewType,
      provider
    );
    return providerRegistration;
  }

  /**
   * Instantiates an editor provider
   * @param context Extension context
   */
  constructor(protected readonly context: vscode.ExtensionContext) {
    super(context);
  }

  title = "Klive Basic Editor";
  htmlFileName = "basic.html";

  /**
   * The replacements that should be carried out on the HTML contents
   * of this panel's view
   */
  getContentReplacements(): ReplacementTuple[] {
    return [
      ["stylefile", getAssetsFileResource("style.css")],
      ["jsfile", getAssetsFileResource("basic.bundle.js")],
    ];
  }

  /**
   * Resolve a custom editor for a given text resource.
   *
   * @param document Document for the resource to resolve.
   * @param webviewPanel The webview panel used to display the editor UI for this resource.
   * @param token A cancellation token that indicates the result is no longer needed.
   * @return Thenable indicating that the custom editor has been resolved.
   */
  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    super.resolveCustomTextEditor(document, webviewPanel, _token);
  }
}
