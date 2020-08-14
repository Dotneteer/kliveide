import * as vscode from "vscode";

import {
  EditorProviderBase,
  ReplacementTuple,
  ViewCommand,
} from "../editor-base";

export class MemoryEditorProvider extends EditorProviderBase {
  private static readonly viewType = "kliveide.memoryEditor";

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new MemoryEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      MemoryEditorProvider.viewType,
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

  title = "Klive Memory Editor";
  htmlFileName = "memory.html";

  /**
   * The replacements that should be carried out on the HTML contents
   * of this panel's view
   */
  getContentReplacements(): ReplacementTuple[] {
    return [
      ["stylefile", this.getAssetsFileResource("style.css")],
      ["jsfile", this.getAssetsFileResource("memory.bundle.js")],
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

    // --- Make sure we get rid of the listener when our editor is closed.
    webviewPanel.onDidDispose(() => {
        // TODO: Dispose here
    });
  }

  /**
   * Process view command
   * @param viewCommand Command notification to process
   */
  processViewCommand(viewCommand: ViewCommand): void {
    switch (viewCommand.command) {
        // TODO: Implement commands
    }
  }
}
