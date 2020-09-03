import * as vscode from "vscode";

import {
  EditorProviderBase,
  ReplacementTuple,
  ViewCommand,
} from "../editor-base";
import { onFrameInfoChanged } from "../../emulator/notifier";
import {
  communicatorInstance,
  RegisterData,
} from "../../emulator/communicator";
import { getAssetsFileResource } from "../../extension-paths";

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
      ["stylefile", getAssetsFileResource("style.css")],
      ["jsfile", getAssetsFileResource("memory.bundle.js")],
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

    let refreshCounter = 0;
    this.toDispose(
      webviewPanel,
      onFrameInfoChanged(async () => {
        refreshCounter++;
        if (refreshCounter % 10 !== 0) {
          return;
        }
        this.refreshViewPort(webviewPanel);
      })
    );
    // --- Make sure we get rid of the listener when our editor is closed.
    webviewPanel.onDidDispose(() => {
      super.disposePanel(webviewPanel);
    });
  }

  /**
   * Process view command
   * @param panel The WebviewPanel that should process a message from its view
   * @param viewCommand Command notification to process
   */
  async processViewCommand(
    panel: vscode.WebviewPanel,
    viewCommand: ViewCommand
  ): Promise<void> {
    switch (viewCommand.command) {
      case "refresh":
        // --- Send breakpoint info to the view
        this.sendInitialStateToView(panel);
        let registers: RegisterData | null = null;
        try {
          registers = await communicatorInstance.getRegisters();
        } catch (err) {
          // --- This error is intentionally ignored
        }
        panel.webview.postMessage({
          viewNotification: "doRefresh",
          registers,
        });
        break;
      case "changeView":
        await this.refreshViewPort(panel);
        break;
    }
  }

  /**
   * Refresh the viewport of the specified panel
   * @param panel Panel to refresh
   */
  async refreshViewPort(panel: vscode.WebviewPanel): Promise<void> {
    try {
      const regData = await communicatorInstance.getRegisters();
      panel.webview.postMessage({
        viewNotification: "registers",
        registers: regData,
      });

      panel.webview.postMessage({
        viewNotification: "refreshViewPort",
      });
    } catch (err) {
      // --- This exception in intentionally ignored
    }
  }
}
